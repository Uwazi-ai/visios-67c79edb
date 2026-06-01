# Custom MCP for Claude Desktop — Team-wide VisiOS access

## What exists today

There's already a working MCP server at `supabase/functions/visi-mcp/index.ts` (Streamable HTTP, stateless JSON-RPC) with 12 tools covering tasks, projects, notifications, approvals, activity, and KB search.

**Limitation:** it's hardcoded to a single user via two env vars (`VISI_MCP_API_KEY`, `VISI_MCP_USER_ID`). Every Claude Desktop session connected to it acts as that one user.

To make this work for the whole team and expose "everything", we need three things: per-user tokens, more tools, and a Settings UI.

---

## 1. Per-user MCP tokens (team-wide auth)

New table `mcp_tokens`:

- `user_id` → owner of the token
- `token_hash` → SHA-256 of the secret (raw token is shown once at creation, never stored)
- `token_prefix` → first 8 chars, for display ("visi_mcp_a1b2c3d4…")
- `label` → user-supplied name ("Claude Desktop — laptop")
- `last_used_at`, `created_at`, `revoked_at`

RLS: each user can only see/create/revoke their own tokens. Service role (used inside the edge function) can read all.

Edge function auth flow changes:
1. Read `Authorization: Bearer <token>` header.
2. Hash it, look up the row in `mcp_tokens` where `revoked_at IS NULL`.
3. Resolve to `user_id`; update `last_used_at`.
4. All tool handlers receive that `user_id` and scope queries to their orgs via existing `org_memberships`.

The old `VISI_MCP_API_KEY` / `VISI_MCP_USER_ID` env vars become a fallback for backwards compatibility (Myke's existing setup keeps working).

## 2. Expand tool coverage ("everything")

Add new tools alongside the existing 12, each scoped to the calling user's orgs and Google account:

**Calendar & meetings**
- `visi_get_calendar` — today/upcoming events from Google Calendar (reuses `_shared/google.ts`)
- `visi_create_calendar_event` — wraps `calendar-create-event`
- `visi_get_meeting_notes` — recent Granola notes for an attendee or date range

**Gmail**
- `visi_list_emails` — recent threads, with filters (unread, from, label)
- `visi_get_email` — full thread by id
- `visi_draft_email` — uses `ai-draft-email`
- `visi_send_email` — wraps `gmail-send`

**Contacts**
- `visi_search_contacts` — query the contacts table
- `visi_get_contact` — full contact + linked org

**Drive**
- `visi_search_drive` — searches each org's shared drive via `drive-proxy`
- `visi_read_drive_file` — pulls file content (capped at 3k chars)

**Grants (UWAZI)**
- `visi_list_grants` — opportunities + pipeline status
- `visi_get_grant_proposal` — full proposal text

**People & orgs**
- `visi_list_team` — members of the caller's orgs (uses `get_org_members`)
- `visi_list_orgs` — all orgs the caller belongs to

All new handlers live in the same `visi-mcp/index.ts` and follow the existing `handleX(admin, userId, args)` pattern.

## 3. Settings UI — `MCPTokensPanel`

New section in **Settings → Connections** (and surfaced on the new More panel where the user currently is):

- List of the user's tokens (label, prefix, last used, created, revoke button)
- "Generate new token" → modal with label input → returns the raw token **once**, with copy button and Claude Desktop config snippet preview
- Empty state shows setup instructions

Component: `src/components/settings/MCPTokensPanel.tsx`. Mounted from `ConnectionsPanel.tsx`.

## 4. Claude Desktop setup instructions (shown in UI)

Claude Desktop currently supports remote MCP only on paid plans; free Desktop needs the `mcp-remote` stdio bridge. The UI will show both options:

**Option A — Paid Claude (Pro/Team/Enterprise): Custom Connector**
- URL: `https://qzurwsqecdsgziyvnuul.supabase.co/functions/v1/visi-mcp`
- Header: `Authorization: Bearer <token>`

**Option B — Any Claude Desktop: `mcp-remote` bridge**
Snippet rendered with the user's token pre-filled:
```json
{
  "mcpServers": {
    "visios": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://qzurwsqecdsgziyvnuul.supabase.co/functions/v1/visi-mcp",
        "--header", "Authorization: Bearer <token>"
      ]
    }
  }
}
```

Saved to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

---

## Technical notes

- Migration adds `mcp_tokens` with grants for `authenticated` (own rows) + `service_role` (all), RLS policies, and a `mcp_tokens_lookup(_hash text)` SECURITY DEFINER function used only by the edge function.
- Token format: `visi_mcp_` + 32 random url-safe bytes generated client-side via `crypto.getRandomValues`, hashed server-side with `crypto.subtle.digest('SHA-256', …)` before insert.
- `visi-mcp` stays public in `supabase/config.toml` (`verify_jwt = false`) since Claude sends its own bearer token, not a Supabase JWT.
- Google-backed tools use `getFreshGoogleAccessToken(userId)` from `_shared/google.ts`; if the calling user hasn't connected Google, the tool returns a friendly error telling them to connect it in Settings.
- Org scoping for every tool: derive `allowed_org_ids = select org_id from org_memberships where user_id = $caller` and filter all queries by that set. This is what makes the same MCP server safe for multiple teammates.
- No changes to the existing 12 tools' behavior — only the auth-resolution and org-scoping layer changes.

## Files touched

- `supabase/migrations/<timestamp>_mcp_tokens.sql` (new)
- `supabase/functions/visi-mcp/index.ts` (auth + new tool handlers)
- `supabase/config.toml` (confirm `verify_jwt = false` block for `visi-mcp`)
- `src/components/settings/MCPTokensPanel.tsx` (new)
- `src/components/settings/ConnectionsPanel.tsx` (mount the new panel)
