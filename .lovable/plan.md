# Dynamic Organizations System

Replace hardcoded UWAZI/BIN/CC with a fully dynamic, user-managed orgs system: create via 3-step wizard, edit, archive/restore, reorder, with real-time updates everywhere.

## 1. Schema Migration

Add to `orgs` table:
- `short_name TEXT` — used in pills/nav (max 10 chars)
- `org_type TEXT DEFAULT 'startup'`
- `success_metric TEXT` (alongside existing `success_definition`)
- `drive_folder_id TEXT`
- `pipeline_stages JSONB DEFAULT '["Prospect","Intro","Active","Champion"]'` (alongside existing `stage_labels`)
- `relationship_label TEXT DEFAULT 'Partners'`
- `display_order INTEGER DEFAULT 0`
- `is_active BOOLEAN DEFAULT true`
- `created_by UUID` (no FK to auth.users per Supabase guidelines)

Add unique index on `slug`. Backfill `short_name` and `display_order` for existing rows.

Add INSERT policy on `orgs` so authenticated users can create orgs (currently INSERT is blocked). On insert, auto-create an `org_memberships` row with role `owner` for the creator via trigger.

Add UPDATE policy refinement so creators/owners can update `is_active` and `display_order`.

Enable realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.orgs;`

## 2. New Frontend Modules

**`src/lib/orgColors.ts`** — exported `ORG_PALETTE` array (10 named colors + custom hex support). Replaces hardcoded `ORG_COLORS` slug map in `src/lib/orgs.ts` (kept as legacy fallback for any pre-existing rows without color set).

**`src/components/orgs/OrgPill.tsx`** — small reusable pill using `org.color` (hex) + `short_name`.

**`src/components/orgs/OrgColorPicker.tsx`** — 10 swatches + custom hex input + live preview pill.

**`src/components/orgs/SlugInput.tsx`** — debounced uniqueness check via Supabase, ✓/✗ feedback, suggests `${slug}-2` if taken.

**`src/components/orgs/AddOrgWizard.tsx`** — 3-step modal (Dialog on desktop, full-screen Sheet on mobile). Reused for Edit (pre-filled, "Save" instead of "Create").
- Step 1: Name, Short Name (auto from first word), Slug (auto, real-time check), Color picker, Org Type radio
- Step 2: Description, 3 priorities, success metric, Drive folder ID + Verify button (calls existing edge function or Drive gateway)
- Step 3: Relationship label, 4 pipeline stage inputs, quick-fill template buttons
- On create: insert org → membership trigger handles owner row → confetti (`canvas-confetti` if available, else simple CSS) → toast → switch active tab to new org
- On edit: update only changed fields

**`src/components/orgs/OrgTabBar.tsx`** — dynamic horizontal tab bar with drag-to-reorder (using `@dnd-kit/core` if installed, else native HTML5 drag) on desktop. Each tab shows colored dot + name. Trailing `[+ Add Org]` tab + top-right `[+ Add Org]` button.

**`src/components/orgs/ArchivedOrgsList.tsx`** — bottom-of-page list of `is_active = false` orgs with Restore button.

**`src/components/orgs/ArchiveOrgPanel.tsx`** — danger-zone panel (only renders if 2+ active orgs); requires typing org name to confirm.

## 3. Refactor `OrganizationsTab`

Replace existing implementation:
- Use `OrgTabBar` instead of inline pill buttons
- Add `[+ Add Org]` button top-right + `[⚙️ Edit Org]` button per active org
- Show priorities, success, pipeline stages as before but read from new fields (with fallback to old `priorities`/`stage_labels`)
- Append `ArchiveOrgPanel` (when 2+ active) and `ArchivedOrgsList` at bottom
- Empty state: if 0 active orgs, show centered "Add your first organization" CTA

## 4. Global Realtime Org Context

Update `src/contexts/OrgContext.tsx`:
- Filter `orgs` to `is_active = true`, order by `display_order`
- Subscribe to `postgres_changes` on `public.orgs` → call `refreshOrgs()`
- Expose `archivedOrgs` separately for the settings page (one-shot fetch on demand)
- Keep "all" pseudo-tab for owners

Update `src/components/visi/OrgSwitcher.tsx`:
- Use `org.short_name || org.name` for label
- Use `org.color` directly (hex) — drop `ORG_COLORS[slug]` lookup as primary; keep as fallback only

Update `src/lib/orgDetect.ts` references to `ORG_COLORS` if any (read-only, leave domain map intact).

## 5. Reorder

Desktop: drag handle (⠿) on each tab in `OrgTabBar`. On drop, batch-update `display_order` for affected orgs.

Mobile: `[Reorder ↕]` toggle → vertical list with drag handles → `[Done]` saves.

## 6. Mobile

`AddOrgWizard` renders as full-screen Sheet on mobile (`useIsMobile`). Sticky bottom CTA with `pb-[env(safe-area-inset-bottom)]`. Header shows "Step N of 3".

## 7. Confetti

Add `canvas-confetti` via `bun add canvas-confetti`.

## Technical Notes

- Slug uniqueness: client check is advisory; DB unique index is the source of truth (catch error and show message).
- Membership: a Postgres trigger `AFTER INSERT ON orgs` inserts `org_memberships(user_id = NEW.created_by, org_id = NEW.id, role = 'owner')`. This avoids requiring the client to do a second insert (current RLS on `org_memberships` blocks client INSERT entirely).
- Existing `priorities` / `stage_labels` columns are kept for backwards compatibility; new code reads `pipeline_stages` first then falls back.
- All UI uses existing semantic tokens (`var(--text-primary)`, `.glass`, `.btn-primary`, `.input-glass`) per design memory.
- Org detection (`src/lib/orgDetect.ts` domain map) is unchanged — that's metadata-driven, not affected by this UI.

## Files

Created:
- `src/lib/orgColors.ts`
- `src/components/orgs/OrgPill.tsx`
- `src/components/orgs/OrgColorPicker.tsx`
- `src/components/orgs/SlugInput.tsx`
- `src/components/orgs/AddOrgWizard.tsx`
- `src/components/orgs/OrgTabBar.tsx`
- `src/components/orgs/ArchiveOrgPanel.tsx`
- `src/components/orgs/ArchivedOrgsList.tsx`
- migration file

Edited:
- `src/components/settings/tabs/OrganizationsTab.tsx`
- `src/contexts/OrgContext.tsx`
- `src/components/visi/OrgSwitcher.tsx`

Dependency: `canvas-confetti`
