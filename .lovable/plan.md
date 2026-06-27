
## Payments: Paddle (built-in)

Run `enable_paddle_payments` (requires Pro plan + Lovable Cloud, both already in place). After enable, I'll use Lovable's `batch_create_product` to create the 6 prices (Solo/Team/Growth × monthly/annual at the spec amounts), then wire checkout + customer portal via the documented Paddle helpers. **No stripe-billing Edge Function. No STRIPE_* secrets. No webhook code** — Paddle's webhooks sync subscription status to a Lovable-managed table automatically.

## What I'm building this turn

### A. Trial banner (top of app)
- New `<TrialBanner />` mounted in `AppShell` above `Topbar`.
- Reads `orgs.subscription_status` + `trial_ends_at`. Shows "✦ X days left in trial · Upgrade →" when `trialing`. Hidden when `active`. Per-session dismiss via `sessionStorage`. Background `#2563EB`.

### B. Settings restructure to spec routes
New sub-nav: **Workspace · Team · Vision · Integrations · Billing · Account**.

- `src/pages/Settings.tsx` becomes a shell with left sub-nav + `<Outlet />`.
- Routes added: `/settings`, `/settings/workspace`, `/settings/team`, `/settings/vision`, `/settings/integrations`, `/settings/billing`, `/settings/account`.
- **Reuse existing components** where possible:
  - Workspace ← new (org name/desc/logo/timezone). Logo bucket: reuse `avatars` bucket (already public).
  - Team ← existing `TeamTab` + `TeamInvitesPanel` (already does invite/resend/revoke/role/remove with last-owner guard).
  - Vision ← existing `VisionAITab` content + new fields (display_name, persona, brief time, channel/inbox toggles, tone) backed by existing `visi_settings` table (extended via migration).
  - Integrations ← grid wrapping existing `ConnectionsPanel` (Google) + Make + Fathom + Stripe-replaced-with-Paddle billing card.
  - Billing ← **new** (current plan card, seats, upgrade cards, manage subscription button → Paddle portal, success banner from `?success=true`).
  - Account ← existing `AccountTab` + `NotificationsTab` merged with Leave-org danger zone.
- Old tabs kept reachable for backward compat under new routes (no deletion of working code).

### C. Upgrade Modal v2
- Extend existing `src/components/billing/UpgradeModal.tsx`:
  - Monthly/Annual toggle ("Save 17%" badge).
  - Side-by-side plan cards (Team + Growth from Solo; Growth only from Team).
  - Feature list per tier from gate map.
  - "Start 14-day free trial" CTA → Paddle checkout.

### D. Dashboard rewrite (`/`)
Full replacement of `src/pages/Dashboard.tsx` per spec:
- **Top row**: 4 KPI cards (Tasks Completed Today, Open Blockers, Team Active Today, Messages Sent Today) — counted from `tasks`, `messages`, `task_activity`. "Active today" = users with a `task_activity` or `messages` row today.
- **Middle 60/40**:
  - Team Pulse feed (left): merged stream from `task_activity` + `messages` (count-only, no content). 20 events, infinite scroll up.
  - Vision's Take (right): calls existing `claude-proxy` with `callType: 'brief'` and a server-side context block (task counts, blockers, idle members, overdue). Cached in `daily_briefs` table (already exists) keyed by org+4h-bucket. Refresh button forces regenerate.
- **Bottom**: By-Person table with Today/Week/Month toggle, sortable columns, status dot (green/yellow/red by last activity). Click row expands to last 5 completed + open tasks.
- Gate the whole page behind `useFeatureAccess('team_dashboard')` with simplified Solo view for Solo orgs (current `MorningBrief` + `ScheduleToday` fallback so we don't regress for Solo users).

### E. Activity tracking — reuse `task_activity`
- No new `activity_log` table.
- Extend `task_activity.kind` to include `'login'` informally (just insert rows from `AuthContext` on session establish — once per day per user).
- Messages already tracked in `messages` table; query directly.

### F. Migrations
- Extend `visi_settings`: add `display_name TEXT DEFAULT 'Vision'`, `persona_description TEXT`, `brief_time TIME DEFAULT '08:00'`, `brief_to_channel BOOLEAN DEFAULT true`, `brief_to_inbox BOOLEAN DEFAULT false`, `tone TEXT DEFAULT 'direct'`.
- Add `orgs.timezone TEXT DEFAULT 'America/Chicago'` (if missing).
- **No** `billing` table — Paddle's built-in integration manages its own.
- **No** `activity_log` table.

### G. Gate map update (`useFeatureAccess`)
Add `'team_dashboard': 'team'` to existing GATE map. Wire modal trigger from new locations only — existing pages stay un-gated to avoid surprise lockouts.

## Explicitly NOT doing

- No `stripe-billing` Edge Function.
- No `STRIPE_*` secrets.
- No `billing` table.
- No new `activity_log` table.
- No `/invite/[token]` route (trigger-based auto-accept already works).
- No changes to Vision/claude-proxy, Chat, Onboarding, Tasks, Calendar, Inbox, Knowledge, Contacts.
- Will not delete existing Settings tabs — old components still referenced from new tab structure.

## Confirm two things and I ship it

1. **Confirm Paddle.** I'll call `enable_paddle_payments`. You'll get a form for email/name/business name. After enable, I'll create products and wire checkout.
2. **Confirm Pro plan is active.** Payments requires Pro tier on this Lovable workspace. If you're not on Pro, the enable call fails — say so now and I'll skip Paddle and ship Trial banner + Settings restructure + Dashboard rewrite, leaving the Billing tab as a placeholder until Pro is enabled.

Reply "go" (or "go, not on Pro yet") and I'll execute.
