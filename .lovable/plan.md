
## Recommendation

Skip Part 1 (chat) — your existing `/chat` already has channels, DMs, presence, realtime, bot messages, threads-capable schema, and the `dailyreports` system channel. Rewriting it to match the spec's `chat_channels`/`chat_messages` would regress working features for no user-visible gain.

Skip the spec's new `org_members`/`team_invites` tables — `org_memberships` + `org_invites` already cover this, with policies and the `handle_new_user` trigger that auto-accepts invites on signup.

Build the parts that are genuinely missing and high-value:

## Scope this turn

### 1. Onboarding flow (Part 2) — net-new

- Add `onboarding_completed BOOLEAN DEFAULT false` to `profiles`.
- New route `/onboarding` (4 steps with progress indicator).
  - **Step 1 — Workspace**: org name + description. Creates row in `orgs`. `handle_new_org` trigger already inserts owner into `org_memberships`. Auto-creates `general`, `announcements`, `vision-briefs` channels via existing `channels` table.
  - **Step 2 — Invite team**: up to 4 email fields. Inserts into existing `org_invites` (uses existing `TeamInvitesPanel` send path). Skip allowed.
  - **Step 3 — Connect Google**: reuse existing Google OAuth wiring in Settings → Connections. "Connect" button + skip.
  - **Step 4 — Meet Vision**: copy + mock Vision bubble, CTAs to `/` or `/chat`. Sets `onboarding_completed = true`.
- Add a guard in `AppShell`: if `session && !profile.onboarding_completed && !activeOrg`, redirect to `/onboarding`. Skip guard if user already has org memberships (returning user / invited member).

### 2. Subscription tiers (Part 3 subset) — net-new

- Migration: add to `orgs`:
  - `subscription_tier TEXT DEFAULT 'solo'` (solo|team|growth|enterprise)
  - `subscription_status TEXT DEFAULT 'trialing'` (trialing|active|past_due|canceled)
  - `trial_ends_at TIMESTAMPTZ DEFAULT now() + interval '14 days'`
- New hook `src/hooks/useFeatureAccess.ts` reading `activeOrg.subscription_tier` against gate map:
  - `team_chat`, `agents`, `vision_unlimited` → team+
  - `social`, `admin_dashboard` → growth+
- New `<UpgradeModal />` component (reuses glass design tokens) — opens when a gated feature is hit. CTA "Upgrade — $79/mo" links to `/settings/billing` (placeholder; Stripe later).
- Do NOT wire gates into existing pages this turn — just ship the hook + modal so future code can opt in. Wiring gates into Chat/Agents/Social risks breaking your active workflows.

### 3. Nav reorder

Move Chat to position 3 in `src/components/visi/Sidebar.tsx`:
`Dashboard → Vision → Chat → Inbox → Tasks → Grants → Calendar → Social → Agents → Bookings → Contacts → ...`

## Explicitly NOT doing

- No new `chat_channels`/`chat_messages`/`chat_members`/`org_members`/`team_invites` tables.
- No rewrite of `/chat`, `ChannelList`, `MessageList`, DMs, or bot system.
- No `/vision` slash command inside chat (Vision already has its own page).
- No `/invite/:token` route — your `handle_new_user` trigger already auto-accepts pending `org_invites` matching the signup email, which is the working pattern.
- No Stripe — billing page is a placeholder; Stripe is the next prompt per your spec.
- No feature-gate wiring into existing modules (hook + modal only).

## Files to add / change

**New**
- `src/pages/Onboarding.tsx`
- `src/components/onboarding/Step1Workspace.tsx`
- `src/components/onboarding/Step2Invites.tsx`
- `src/components/onboarding/Step3Google.tsx`
- `src/components/onboarding/Step4Vision.tsx`
- `src/hooks/useFeatureAccess.ts`
- `src/components/billing/UpgradeModal.tsx`

**Edit**
- `src/App.tsx` — add `/onboarding` route
- `src/components/visi/AppShell.tsx` — first-login redirect guard
- `src/components/visi/Sidebar.tsx` — Chat to position 3
- `src/contexts/OrgContext.tsx` — expose `subscription_tier` on Org type (read-through)

**Migration**
- `profiles.onboarding_completed`
- `orgs.subscription_tier` / `subscription_status` / `trial_ends_at`

Confirm and I'll ship it.
