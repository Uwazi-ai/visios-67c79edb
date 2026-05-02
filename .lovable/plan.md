# Visi OS Settings — Master Control Center

Scope is large (8 tabs, multiple integrations, danger zone, mobile reflow). Shipping in clear phases so the page is usable after each phase. Every save uses existing `profiles`, `orgs`, `integrations`, `ai_training`, and a new `push_subscriptions` table.

## Architecture

- New route stays at `/settings`. Replace current `Settings.tsx` with `SettingsLayout` shell that renders a left sidebar (220px) + scrollable content panel.
- Each tab is its own component in `src/components/settings/tabs/` so the file stays maintainable: `ProfileTab`, `OrganizationsTab`, `ConnectionsTab`, `VisionAITab`, `DigitalCardTab`, `NotificationsTab`, `PrivacyTab`, `AccountTab`.
- A single `useSettingsCompletion()` hook computes per-tab status (`complete | warning | empty` + count) and feeds the sidebar dots.
- Save pattern helper `useAutoSave` (500ms debounce for text, immediate for toggles, manual for complex forms) writes to Supabase and emits a toast.
- Add `Settings` link with `Gear` icon at the bottom of the main app sidebar (`src/components/visi/Sidebar.tsx`).

## Database changes (one migration up front)

```sql
alter table profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table orgs add column if not exists description text;
alter table orgs add column if not exists priorities jsonb not null default '[]'::jsonb;
alter table orgs add column if not exists success_definition text;
alter table orgs add column if not exists stage_labels jsonb not null default '[]'::jsonb;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table push_subscriptions enable row level security;
create policy "Push: self all" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Reuses existing `integrations` (one row per provider with `vision_enabled`, `metadata`, `status`) and `user_integration_secrets` (encrypted tokens for Slack / Jira / Confluence / Twilio / Fathom / Granola).

## Phase plan (each phase ships independently)

1. Layout + sidebar nav + completion dots + `Settings` entry in main sidebar.
2. Profile tab (avatar upload to `avatars` bucket, all fields, Preferences JSONB).
3. Organizations tab (3 sub-tabs, color picker, Drive folder verify via `calendar-list-events`-style edge, stage labels).
4. Connections tab — Google Workspace tile (reuse current ConnectionsPanel logic, expand toggles for Gmail / Calendar / Drive sub-features, Sync Now buttons).
5. Slack tile via Lovable connector (`standard_connectors--connect slack`), channel whitelist stored in `integrations.metadata`.
6. Jira + Confluence tiles (API token form → encrypted store in `user_integration_secrets`, project/space whitelist, new edge functions `jira-test-connection`, `confluence-test-connection`).
7. Twilio + Fathom + Granola tiles (token forms, masked inputs, test buttons).
8. Vision AI tab (default persona, full data-source toggle grid bound to `integrations.vision_enabled`, voice training → `ai_training`, Business Context per org, Morning Brief settings, conversation history controls + Clear All).
9. Digital Card tab — embed existing MyCardSettings UI in two-column layout with live phone-frame preview and QR.
10. Notifications tab (in-app/email/push toggles → `profiles.notification_prefs`; PWA push subscribe flow writing to `push_subscriptions`).
11. Privacy tab + Export data edge function `export-user-data` returning a ZIP signed URL.
12. Account tab (plan info, API usage from a new `usage_events` query, change password via `supabase.auth.updateUser`, Switch/Disconnect Google).
13. Danger Zone (Reset Settings, Clear Contacts, Delete Account — typed confirmation modals; delete account via new edge function `delete-account` using service role).
14. Test Connection buttons across all tiles + completion-indicator polish.
15. Mobile reflow: sidebar → horizontal scroll tab strip; ensure 16px input font; verify in preview.

## Design notes

- All styling via existing tokens / utility classes (`.glass`, `.glass-active`, `.btn-primary`, `.input-glass`, `.nav-item`, `var(--text-primary)`). Connected tiles get a 3px green left border via `border-l-[3px] border-[hsl(var(--success))]`; disconnected gets red.
- Completion dots: `●` green = `hsl(var(--success))`, `⚠` amber = `hsl(var(--warning))` with count.
- Toggles use existing shadcn `Switch`. API tokens use `<Input type="password">` with eye toggle. Confirmations via shadcn `AlertDialog`.
- All copy lives inline in each tab component — no i18n layer.

## Out of scope for this build

- Real billing / plan management (just display placeholder plan info).
- Real Claude usage tracking infrastructure (display zeros until usage table exists).
- Building the Fathom/Granola sync workers (UI + token storage only; sync edge functions stubbed).

Confirm and I'll start with Phase 1 (layout + sidebar + completion dots + Settings entry in main nav) and the migration.
