# Vision Context Engine — Implementation Plan

A large multi-system build. Shipping in phases so each part is verifiable. This plan covers scope, schema, edge functions, UI, and ordering.

## Scope summary

Build the data layer that lets Vision see, in every conversation:
Gmail, Google Calendar, Google Drive, Contacts, Tasks, Slack, Jira, Confluence, Knowledge Base — each user sees only their own data, org-scoped, with per-source toggles.

## Schema changes (one migration)

There is no `integrations` table today. Create one:

```sql
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_id uuid,
  provider text not null,            -- 'google'|'slack'|'jira'|'confluence'
  status text not null default 'connected',
  vision_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  -- google: { gmail_enabled, calendar_enabled, drive_enabled, drive_folder_ids[] }
  -- slack: { team_id, channels[], bot_token_ref }
  -- jira/confluence: { domain, email }
  last_synced_at timestamptz,
  last_kb_sync_at timestamptz,
  kb_doc_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, org_id)
);
-- RLS: self-only read/write
```

Extend `kb_documents`:
```sql
alter table kb_documents
  add column if not exists external_id text,
  add column if not exists full_text text,
  add column if not exists source_integration text;
create unique index if not exists kb_docs_external_id_idx
  on kb_documents(user_id, external_id) where external_id is not null;
```

Secrets stored server-side (never in metadata): per-user Slack/Jira/Confluence tokens go in a `user_integration_secrets` table with RLS self-only, columns `(user_id, provider, token, refresh_token)`.

## Edge functions

New:
- `vision-context` — intent classifier (Lovable AI: openai/gpt-5-mini, JSON mode) + parallel fetchers; returns `{ emails, calendar, drive, contacts, tasks, slack, kb }`. Called from Vision before each message.
- `slack-oauth-callback` + `slack-sync` (every 30 min via pg_cron)
- `jira-sync` (every 2h)
- `confluence-sync` (every 6h)

Extend:
- `_shared/google.ts` already has `getFreshGoogleAccessToken` — reuse for Gmail/Calendar/Drive fetchers inside `vision-context` (no separate google-proxy needed; we already have gmail/calendar functions to model after).
- `Vision.tsx` send flow → call `vision-context` first, pass result into system prompt builder, then stream Claude.

Scheduled jobs registered via `supabase--insert` (pg_cron + pg_net), not migration.

## System prompt

New `src/lib/visionPrompt.ts` exporting `buildVisionSystemPrompt(persona, context, profile)` matching the spec format with sections for emails/calendar/tasks/contacts/drive/slack/kb. Vision rule: never say "Claude".

## UI

1. **Settings → Connections tab** (`src/pages/Settings.tsx` + new `src/components/settings/ConnectionsPanel.tsx`):
   - 3-col grid of tiles: Gmail, Calendar, Drive, Contacts, Tasks, Slack, KB, Jira, Confluence
   - Each tile: status dot, last synced, vision toggle, manage button
   - Google tile group has 3 sub-toggles
   - Drive tile has org-folder ID inputs
   - Slack/Jira/Confluence tiles have connect modals (token inputs)
2. **Vision header "What I Can See"** button (`Eye` icon) → popover listing connected sources with counts.
3. **Citation chips** in Vision messages: parse `[gmail:THREADID|label]`, `[drive:FILEID|label]`, `[kb:DOCID|label]`, `[jira:KEY|label]`, `[slack:CHANNEL|label]` and render as clickable chips. Tell Vision in the system prompt to emit these tokens.

## Implementation order (multi-message — start with foundation)

This message ships **Phase 1** so the rest has something to build on:

1. Migration: `integrations`, `user_integration_secrets`, `kb_documents` columns + RLS
2. `vision-context` edge function with intent classifier + parallel fetchers (Gmail, Calendar, Contacts, Tasks, KB; Drive/Slack/Jira return null until configured)
3. `src/lib/visionPrompt.ts` system prompt builder
4. Wire `Vision.tsx` to call `vision-context` and use the new prompt
5. Settings → Connections tab with Google sub-toggles, Vision toggles, KB tile (read-only counts). Slack/Jira/Confluence tiles show "Coming soon" connect buttons that will be activated in Phase 2.
6. "What I Can See" popover in Vision header
7. Basic citation chip rendering

**Phase 2 (next message after you confirm Phase 1 works):** Slack OAuth, Jira sync, Confluence sync, pg_cron jobs, Drive folder content extraction, full citation routing.

## Notes / decisions

- Use Lovable AI (`openai/gpt-5-mini`, response_format json) for intent classification — no Anthropic Haiku call needed, no extra key.
- Drive/Gmail/Calendar fetchers call Google APIs directly inside `vision-context` using the existing `getFreshGoogleAccessToken` helper — avoids adding a new proxy.
- All fetches wrapped in `Promise.allSettled` so one failing source never blocks Vision.
- Vision keeps working exactly as today if `vision-context` fails — we fall back to the existing prompt.

Ready to ship Phase 1 on approval.
