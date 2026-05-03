# Mobile-First Visi OS + Team Access

This is a large, multi-area change. I'll break it into phases so we can ship and verify each before moving on, rather than dumping everything in one untested mega-commit.

## Phase 1 — Foundations (ship first)
1. **Global CSS & viewport**
   - Add `--safe-top` / `--safe-bottom` vars, 16px input font-size (prevents iOS zoom), `overscroll-behavior: none`, `.page-content` bottom padding to `index.css`.
   - Update `index.html` viewport meta to include `viewport-fit=cover`, `user-scalable=no`, and `apple-mobile-web-app-status-bar-style=black-translucent`.
2. **Bottom tab bar (`BottomNav`)** — `md:hidden`, fixed bottom, safe-area padding, 5 tabs (Home, Vision, Inbox, Contacts, More). Live unread + review-queue badges. "More" opens a `BottomSheet`.
3. **Reusable `BottomSheet`** component (framer-motion) — drag handle, backdrop, spring animation, optional title, full-height variant.
4. **Mobile top bar + hamburger drawer** — refactor `Topbar` so on mobile it shows `[☰] Visi OS [🔍 ➕ 🔔]` at 56px + safe-top. `Sidebar` becomes an off-canvas drawer on mobile (uses existing `Sheet` or framer-motion).
5. **AppShell wiring** — render `BottomNav` (mobile), keep desktop `Sidebar`; ensure `<main>` uses `.page-content` so content isn't hidden behind the tab bar. Replace existing `MobileTabbar` with new `BottomNav`.
6. Install `framer-motion`.

**Verify:** test at 375×812 + 1336×900, confirm tab bar, drawer open/close, no content clipped, inputs don't trigger iOS zoom.

## Phase 2 — Page mobile layouts
7. **Dashboard** — `grid-cols-1 md:grid-cols-2`, collapsible morning brief (3-line clamp + Read more), horizontal-scroll org pills, ➕ in topbar opens QuickCapture as BottomSheet on mobile.
8. **Vision Chat** — full-screen on mobile, persona picker → BottomSheet, keyboard-aware input using `visualViewport`, swipe-right opens history drawer.
9. **Contacts** — push-navigation pattern: list → tap → full-screen detail with `[← Contacts]`. Swipe-left row reveals `[Draft Email] [Mark Stale]`. Engagement board horizontally scrollable.
10. **Inbox** — same push-navigation + swipe-left `[Draft] [Archive]`.
11. **Settings** — iOS-style single-column list on mobile; tapping a section pushes a full-screen sub-page; back chevron returns. Desktop unchanged.
12. **Calendar** — agenda view on mobile (horizontal date strip + event cards → BottomSheet for prep).
13. **Knowledge** — list view on mobile, upload via BottomSheet.

**Verify:** walk each page at 375×812.

## Phase 3 — Gestures
14. **`SwipeableRow`** wrapper (framer-motion drag) for Contacts/Inbox lists.
15. **Pull-to-refresh** hook using touch events; spinning Vision circle as indicator on list pages.
16. **Swipe-right-to-go-back** on push-navigated detail screens.
17. **Touch target audit** — sweep buttons/inputs/nav items to `min-h-[44px]` / `h-12`.

## Phase 4 — Team access layer
18. **DB migration**
    - `team_members` table (id, user_id, org_id, role enum, invited_by, invited_at, accepted_at, status, unique(user_id, org_id)).
    - Reuse existing `app_role` enum where possible; add `team_role` only if needed.
    - RLS: self-read own membership; org owners manage team. Mirror existing org-membership patterns.
    - Note: existing tables already use `is_org_member()` against `org_memberships`. To avoid a parallel access system, the simplest correct path is to **treat `team_members` as the invite/onboarding ledger** and on `accepted_at` insert into `org_memberships`. This keeps every existing RLS policy working unchanged. (Confirm before migrating — alternative is to rewrite all RLS to union both tables.)
19. **Settings → Team tab** — list members + pending invites; `[+ Invite]` opens BottomSheet/modal with email + org checkboxes + role; on send, INSERT to `team_members` (status='pending') and send invite email via Resend (requires Resend connector — will prompt if missing).
20. **Invite acceptance flow** — `/invite/:token` page → after auth, marks `accepted_at`, inserts `org_memberships` row, status='active'.

**Verify:** invite an email, accept in incognito, confirm new user sees only their org's data.

## Technical Notes
- Reuse existing design tokens (`var(--bg-glass-1)`, `.glass`, `.btn-primary`, `OrgPill`). No new color literals.
- Existing `MobileTabbar` is replaced by `BottomNav` to avoid duplication.
- `Sheet` from shadcn already exists — use it for drawer + bottom sheet where possible to avoid an extra dependency, but framer-motion is needed for swipe/drag/push gestures.
- `freshSignIn` and version-migration logic stay intact.
- `.page-content` class will be applied in `AppShell`'s `<main>` so every routed page benefits without per-page edits.

## Files (high-level)
- **New:** `src/components/visi/BottomNav.tsx`, `src/components/visi/MobileTopbar.tsx`, `src/components/ui/bottom-sheet.tsx`, `src/components/mobile/SwipeableRow.tsx`, `src/components/mobile/PushScreen.tsx`, `src/hooks/usePullToRefresh.ts`, `src/hooks/useKeyboardInset.ts`, `src/components/settings/tabs/TeamTab.tsx`, `src/pages/InviteAccept.tsx`, plus per-page mobile detail screens as needed.
- **Edited:** `index.html`, `src/index.css`, `src/components/visi/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `Dashboard.tsx`, `Vision.tsx`, `Contacts.tsx`, `Inbox.tsx`, `Settings.tsx`, `Calendar.tsx`, `Knowledge.tsx`, `App.tsx` (route for /invite, /more if needed), supabase migration, `MobileTabbar.tsx` (deleted/replaced).

## Open Questions (need your call before I start)
1. **Team access model:** Should `team_members` write through to `org_memberships` on accept (preserves all existing RLS — recommended), or do you want me to rewrite every table's RLS to also check `team_members`? The first is dramatically less risky.
2. **Invite emails:** Use Resend (needs the connector connected — I'll prompt for the API key) or just generate a copyable invite link for now?
3. **Scope of v1:** Want me to ship **Phase 1 only** in this turn (foundations + tab bar + drawer + bottom sheet, working everywhere) and then do Phases 2–4 in follow-ups? That gives you something testable today instead of a 3-hour monolith. Strongly recommended.