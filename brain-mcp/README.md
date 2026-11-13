# brain-mcp

The shared brain for Myke OS, as a remote MCP server on Supabase. Five agents connect to it. They never talk to each other. They read and write the brain.

| Identity | Client | Access |
|---|---|---|
| `kova` | claude.ai custom connector | Admin. All 23 tools. |
| `stevie` | Claude Code | 16 tools |
| `grok` | grok.com custom connector | 16 tools |
| `chatgpt` | ChatGPT Developer mode | 16 tools |
| `muse` | Muse custom connector | 16 tools |

## Layout

```
supabase/functions/brain-mcp/      the edge function (this is what deploys)
  index.ts                         Deno entry: Postgres and token checks
  core/server.ts                   MCP transport and OAuth discovery
  core/tools.ts                    the tools, access checks, rate limit, audit log
  core/guardrails.ts               money, social, exclusion and minors rules
brain-mcp/
  supabase/migrations/             three SQL files, applied by hand, in order
  scripts/seed.mjs                 builds the ontology seed
  scripts/inspect.sh               post-deploy check with the MCP Inspector
  seed/                            gitignored: the ontology and the seed SQL
  tests/                           214 checks, run with npm test
```

This repo is public. The ontology, the build brief and the generated seed live in `brain-mcp/seed/`, which is gitignored. Never commit them. No family member is named anywhere in the repo: the second approver is the role `family_approver`, and minors' names live only in a secret.

## Deploy

Project ref: `qzurwsqecdsgziyvnuul`
Function URL after deploy: `https://qzurwsqecdsgziyvnuul.supabase.co/functions/v1/brain-mcp`

Do the steps in this order. The function fails against a database that has no `brain` schema, so the migrations come first.

### 1. Check the OAuth server settings

In the Supabase dashboard, open **Authentication > OAuth Server**.

- OAuth 2.1 server: enabled.
- Authorization path: `/.lovable/oauth/consent`. This is the consent page the Kova app already has. Leave it as it is if it is already set.
- Dynamic client registration: enabled. Each MCP client registers itself the first time it connects.

Under **Authentication > URL Configuration**, the Site URL must be the live Kova app, because the consent page is served from there.

### 2. Apply the migrations

Open the **SQL Editor** and run these three files, one at a time, in order:

```
brain-mcp/supabase/migrations/20261112000000_brain_init.sql
brain-mcp/supabase/migrations/20261112000100_brain_guardrails.sql
brain-mcp/supabase/migrations/20261112000200_brain_identities.sql
```

They create a private `brain` schema. They do not touch `public`, `visi-mcp` or any existing Kova table.

### 3. Check the database role

The function runs every statement as `service_role`. In the SQL Editor, run:

```sql
select pg_has_role(current_user, 'service_role', 'member') as can_switch,
       (select rolbypassrls from pg_roles where rolname = 'service_role') as bypasses_rls;
```

Both must be `true`. If `can_switch` is `false`, run `grant service_role to postgres;` and check again.

### 4. Create the five agent accounts

In **Authentication > Users**, choose **Add user** five times. Give each agent its own email address and a strong password, and tick auto-confirm. Save the passwords in your password manager.

Copy each new user's UID, then map them to agents in the SQL Editor:

```sql
insert into brain.identities (auth_user_id, agent) values
  ('<kova user uid>',    'kova'),
  ('<stevie user uid>',  'stevie'),
  ('<grok user uid>',    'grok'),
  ('<chatgpt user uid>', 'chatgpt'),
  ('<muse user uid>',    'muse');
```

An account that is not in this table gets a 403 from brain-mcp. Your own Kova login is not an agent and will be refused, which is intended.

### 5. Seed the ontology

Put `myke-shaw-ontology.md` in `brain-mcp/seed/`, then:

```bash
cd brain-mcp && npm install && npm run seed
```

This prints the section list and writes `brain-mcp/seed/sections.sql`. Paste that file into the SQL Editor and run it. The seed is safe to run again: it updates sections in place and bumps a version only when a body changed.

The seed script removes the campaign, financial figures, pricing, journal and relationship details, and phone numbers. It stops with an error if any of those are still present.

### 6. Deploy the function

```bash
npx supabase login
npx supabase functions deploy brain-mcp --project-ref qzurwsqecdsgziyvnuul
```

`supabase/config.toml` already sets `verify_jwt = false` for brain-mcp. The function checks tokens itself, and the discovery endpoints must be reachable before sign-in.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_DB_URL` to every edge function.

Set one secret yourself, in **Edge Functions > Secrets**: `BRAIN_PROTECTED_NAMES`, a comma separated list of the first names of any minors. It makes the minors rule follow those names outside the family domain. The names are kept in the secret so they never appear in this public repo. Without it, the rule still applies to everything in the family domain.

Note: this repo syncs with Lovable, which may deploy functions under `supabase/functions/` when a branch reaches `main`. Do steps 1 to 5 before merging.

## Test the deployment

### Script

```bash
BRAIN_URL=https://qzurwsqecdsgziyvnuul.supabase.co/functions/v1/brain-mcp \
SUPABASE_URL=https://qzurwsqecdsgziyvnuul.supabase.co \
SUPABASE_ANON_KEY=<publishable key> \
BRAIN_EMAIL=<an agent account email> \
bash brain-mcp/scripts/inspect.sh
```

It asks for that account's password, then checks:

1. A call with no token gets a 401 that points to the sign-in metadata.
2. OAuth discovery works and dynamic client registration is on.
3. The account can sign in.
4. `tools/list` through the MCP Inspector shows 23 tools for kova or 16 for any other agent.
5. `get_ontology`, `get_my_jobs` and `search` work.
6. A task tagged as journal content is refused.

The script only reads, plus one write that the server must refuse. It does not change the brain. Run it once as kova and once as another agent.

### Inspector UI

```bash
npx @modelcontextprotocol/inspector
```

Choose transport **Streamable HTTP**, enter the function URL, and connect. The Inspector runs the same OAuth flow the real clients use, so this is the best single test that sign-in works end to end.

## Connect each client

One rule applies to every client. When the browser opens to sign in, **sign in as that agent's account, not as yourself**. The consent page uses whatever Kova session the browser already has, so use a private window or sign out of Kova first. If you approve as the wrong account, the client gets the wrong identity or a 403.

After connecting, ask the client to call `get_my_jobs`. The server's greeting also says "You are signed in as ..." so you can confirm the identity.

### claude.ai, identity `kova`

1. Open claude.ai, then **Settings > Connectors**.
2. Choose **Add custom connector**.
3. Name: `Brain`. URL: the function URL.
4. Choose **Connect**. In the sign-in window, sign in as the kova account and approve.
5. Confirm the connector lists 23 tools.

### Claude Code on the M2 Pro, identity `stevie`

```bash
claude mcp add --transport http brain https://qzurwsqecdsgziyvnuul.supabase.co/functions/v1/brain-mcp
```

Then start `claude`, run `/mcp`, pick `brain`, and choose to authenticate. Sign in as the stevie account in the browser window.

### grok.com, identity `grok`

1. Open grok.com/connectors.
2. Choose **New Connector**, then **Custom**.
3. Enter the function URL.
4. Complete the sign-in as the grok account.

Not verified: xAI's documentation says to "complete any required authentication" but does not say which OAuth features Grok supports. There is one public report of a remote OAuth server failing in Grok before the sign-in screen appeared. If that happens, see the fallback section.

### ChatGPT Developer mode, identity `chatgpt`

1. Open **Settings > Connectors** (some screens call these Apps), then **Advanced**, and turn on **Developer mode**. This needs a paid plan and the web app.
2. Choose **Create**. Enter a name and the function URL.
3. Authentication: **OAuth**.
4. Save. Sign in as the chatgpt account when the window opens.

How ChatGPT uses it:
- Deep research can only read, and it looks for tools named `search` and `fetch`. brain-mcp provides both, on top of the full read set.
- In normal chats, ChatGPT asks you to confirm each write. The write tools are small and say plainly what they do, so those prompts are easy to judge.
- Agent mode does not use custom connectors.

### Muse, identity `muse`

Meta has no official documentation for this that I could find. Third-party guides describe two routes: add a custom connector by URL in Muse's settings, or give Muse the URL in a chat and ask it to connect. Both are said to use Streamable HTTP with OAuth, which is what brain-mcp speaks.

1. Add a custom connector with the function URL, by whichever route your Muse build offers.
2. Sign in as the muse account when asked.

Not verified. Treat the first connection as the test.

### If a client cannot complete OAuth

Stop. Do not put a token in the URL, and do not share another agent's account.

No fallback is built. The safest one, if it is needed, is a long random token per agent, sent only in the `Authorization` header, stored hashed in `brain.identities`, and revocable by deleting the row. It would work only for a client that lets you set a custom header. A client that supports neither OAuth nor custom headers cannot connect directly, and its work would have to be relayed through Kova. Building this is a decision for Myke.

## How the rules are enforced

All of this is code on the server, not prompt text.

| Rule | Where |
|---|---|
| Admin tools are kova only | `callTool` in `core/tools.ts`, before arguments are read |
| Money jobs and approvals are refused with `Financials are handled by Myke manually.` | `screenMoney`, `screenPurchaseClaim` |
| Gated actions (send, post_draft, reply_batch, book, buy, deploy) need an approved request | `complete_job`, plus a database trigger |
| The family approver decides family items only | `record_approval`, plus a database trigger |
| Social work is drafts only, never on RPS Office or campaign accounts | `screenSocial` |
| Journal and campaign content stay out | `screenExclusions`, on every write |
| Family items carry first names and logistics only | `screenMinors` |
| 60 writes per hour per agent | `callTool` |
| Every call is logged | `brain.activity`, append-only |

The text screens are keyword based. They catch tagged and obvious cases, not every paraphrase. They cannot reliably spot a last name in free text.

## Operating notes

- **See what happened:** `select * from brain.activity order by id desc limit 50;`
- **Add or move an agent account:** change the row in `brain.identities`. Valid agent names are fixed in the first migration.
- **Cut off an agent:** delete its row from `brain.identities`. Its next call gets a 403.
- **Change the ontology:** edit the file, run `npm run seed`, run the new `sections.sql`. Or let agents call `propose_ontology_edit` and have Kova approve.
- **Optional settings:** `BRAIN_MCP_PUBLIC_URL` overrides the public URL in the sign-in metadata. `BRAIN_DB_POOL_MAX` sets the connection pool size (default 3).
- **Remove everything:** delete the function, then `drop schema brain cascade;`. Nothing else depends on it.

## Tests

```bash
cd brain-mcp && npm install && npm test
```

214 checks across six files. They run the real request handler against an in-memory Postgres, so they cover the tools and rules but not the live OAuth flow. `scripts/inspect.sh` covers that after deploy.

Type-check the function from its own folder, so Deno picks up its import map:

```bash
cd supabase/functions/brain-mcp && deno check index.ts
```
