#!/usr/bin/env bash
# Checks a deployed brain-mcp with curl and the MCP Inspector CLI.
# It reads, and makes one write attempt that the server must refuse, so it
# never changes the brain.
#
#   BRAIN_URL=https://<ref>.supabase.co/functions/v1/brain-mcp \
#   SUPABASE_URL=https://<ref>.supabase.co \
#   SUPABASE_ANON_KEY=<publishable key> \
#   BRAIN_EMAIL=<agent account email> \
#   bash brain-mcp/scripts/inspect.sh
#
# You are asked for the agent account's password. It is sent in the request
# body to Supabase Auth and is not stored or printed.
# To skip the sign-in, pass an access token you already have as BRAIN_TOKEN.
set -euo pipefail

: "${BRAIN_URL:?Set BRAIN_URL to the brain-mcp function URL}"
BRAIN_URL="${BRAIN_URL%/}"
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILED=1; }
FAILED=0
json() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(String(($1)??''))}catch{console.log('')}})"; }

echo "== 1. Sign-in is required"
HEADERS=$(curl -s -o /dev/null -D - -X POST "$BRAIN_URL" -H 'Content-Type: application/json' -d '{}')
if grep -qi '^HTTP.* 401' <<<"$HEADERS" && grep -qi 'www-authenticate:.*resource_metadata=' <<<"$HEADERS"; then
  pass "no token gets 401 with a resource_metadata pointer"
else
  fail "expected 401 with WWW-Authenticate resource_metadata"
fi

echo "== 2. OAuth discovery"
ISSUER=$(curl -s "$BRAIN_URL/.well-known/oauth-protected-resource" | json 'j.authorization_servers[0]')
[ -n "$ISSUER" ] && pass "authorization server: $ISSUER" || fail "no authorization server in the protected resource metadata"
AS=$(curl -s "$BRAIN_URL/.well-known/oauth-authorization-server")
[ -n "$(json 'j.authorization_endpoint' <<<"$AS")" ] && pass "authorization endpoint is published" \
  || fail "authorization server metadata is missing. Is the OAuth 2.1 server enabled in Supabase?"
[ -n "$(json 'j.registration_endpoint' <<<"$AS")" ] && pass "dynamic client registration is on" \
  || echo "NOTE  dynamic client registration is off. Clients must be registered by hand in Supabase."

echo "== 3. Get a token"
if [ -z "${BRAIN_TOKEN:-}" ]; then
  : "${SUPABASE_URL:?Set SUPABASE_URL, or pass BRAIN_TOKEN}"
  : "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY, or pass BRAIN_TOKEN}"
  : "${BRAIN_EMAIL:?Set BRAIN_EMAIL to the agent account email, or pass BRAIN_TOKEN}"
  read -rs -p "Password for $BRAIN_EMAIL: " BRAIN_PASSWORD; echo
  BODY=$(BRAIN_EMAIL="$BRAIN_EMAIL" BRAIN_PASSWORD="$BRAIN_PASSWORD" node -e \
    'console.log(JSON.stringify({email:process.env.BRAIN_EMAIL,password:process.env.BRAIN_PASSWORD}))')
  BRAIN_TOKEN=$(curl -s -X POST "${SUPABASE_URL%/}/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" -H 'Content-Type: application/json' -d "$BODY" | json 'j.access_token')
  unset BRAIN_PASSWORD BODY
fi
[ -n "$BRAIN_TOKEN" ] && pass "have an access token" || { fail "sign-in failed"; exit 1; }

inspector() {
  npx -y @modelcontextprotocol/inspector --cli "$BRAIN_URL" --transport http \
    --header "Authorization: Bearer $BRAIN_TOKEN" "$@" 2>/dev/null
}

echo "== 4. MCP Inspector: tools/list"
TOOLS=$(inspector --method tools/list)
COUNT=$(json 'j.tools.length' <<<"$TOOLS")
case "$COUNT" in
  23) pass "23 tools listed, so this account is kova" ;;
  16) pass "16 tools listed, so this account is a non-admin agent" ;;
  *)  fail "expected 16 or 23 tools, got '${COUNT}'. Is this account in brain.identities?" ;;
esac

echo "== 5. MCP Inspector: read tools"
TOC=$(inspector --method tools/call --tool-name get_ontology)
SECTIONS=$(json 'JSON.parse(j.content[0].text).sections.length' <<<"$TOC")
[ "${SECTIONS:-0}" -gt 0 ] 2>/dev/null && pass "get_ontology returns $SECTIONS sections" \
  || fail "get_ontology returned no sections. Has the seed been applied?"
JOBS=$(inspector --method tools/call --tool-name get_my_jobs)
[ "$(json 'j.isError' <<<"$JOBS")" = "false" ] && pass "get_my_jobs works" || fail "get_my_jobs failed"
HITS=$(inspector --method tools/call --tool-name search --tool-arg query=civic)
[ "$(json 'j.isError' <<<"$HITS")" = "false" ] && pass "search works" || fail "search failed"

echo "== 6. MCP Inspector: guardrails refuse a write"
# A task tagged as journal content must be refused for every agent, and
# nothing is stored. The Inspector exits non-zero on a tool error, which is
# the result we want here.
REFUSED=$(inspector --method tools/call --tool-name propose_task \
  --tool-arg title="Inspector check #journal" --tool-arg details="This call must be refused." \
  --tool-arg venture=system --tool-arg priority=3 || true)
MESSAGE=$(json 'j.content[0].text' <<<"$REFUSED")
if [ "$(json 'j.isError' <<<"$REFUSED")" = "true" ] && grep -q 'Journal content' <<<"$MESSAGE"; then
  pass "refused: $MESSAGE"
else
  fail "a journal-tagged task was not refused by the exclusion rule"
fi

echo
[ "$FAILED" = 0 ] && echo "All checks passed." || { echo "Some checks failed."; exit 1; }
