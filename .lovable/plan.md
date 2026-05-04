## Capital Raise Page — Implementation Plan

Build a new `/capital-raise` page for UWAZI.AI fundraising tracking, plus a "Fundraising" section in the sidebar, two new database tables, seed data, and an edge function exposing the data to the existing Ask Uwazi RAG system.

### 1. Database (migration)

**Table: `fundraising_opportunities`**
- order_num (int), name, organization, type ('accelerator'|'vc'|'grant'), entity, target_amount (text), deadline (text), phase (1–4), urgency ('fire'|'now'|'soon'|'build'|'watch'), status (default 'not started'), notes, assigned_to, next_action, committed_amount (numeric default 0), created_at, updated_at, created_by

**Table: `fundraising_tasks`**
- opportunity_id (uuid, FK-ish), title, due_at, assigned_to, status ('open'|'done'), created_at, created_by

RLS: authenticated users can read/insert/update/delete (org-wide tool, no per-row owner restriction needed since this is admin-only). Add `update_updated_at_column` trigger.

### 2. Seed data

After migration approval, insert all 18 opportunities via the insert tool.

### 3. Edge Function: `fundraising-context`

Returns JSON: opportunities (grouped by status), totals (target/committed), open tasks by assignee, phase summary. Used by RAG.

### 4. RAG integration

Patch `supabase/functions/ai-build-context/index.ts` to also fetch fundraising summary when the user query mentions fundraising/raise/capital/opportunity keywords (or always include a compact summary if `org_id` matches UWAZI). Append into response payload as `fundraising`.

### 5. Frontend

**Sidebar (`src/components/visi/Sidebar.tsx`)**: add a "Fundraising" group label + "Capital Raise" nav item (TrendingUp icon) at appropriate spot.

**Route (`src/App.tsx`)**: `/capital-raise` → `CapitalRaise` page.

**New page `src/pages/CapitalRaise.tsx`** with sub-components in `src/components/fundraising/`:
- `StatsBar.tsx` — 4 tiles (target $2.75M, pipeline count, active apps, committed)
- `TimelineStrip.tsx` — horizontal scroll, months May/Jun/Jul/Aug/Sep–Oct/Q1'27, color-coded pills
- `FilterBar.tsx` — type / phase / entity / status filters + sort
- `OpportunityCard.tsx` — inline-editable card with all fields, type badge, urgency badge, status dropdown, "+ Add Task" button
- `TasksPanel.tsx` — tabbed section listing all fundraising tasks, filter by assignee + due
- `useFundraising.ts` hook — fetch/update opportunities and tasks with Supabase realtime

**Workflow logic**:
- on status → 'applied': prompt to create follow-up task (+14 days)
- on status → 'awarded': bump committed total (prompt for amount), trigger confetti (use `canvas-confetti` if installed, else simple CSS burst)
- on status → 'declined': mute styling + sort to bottom

### 6. Design tokens

Use existing dark glass classes plus inline hex per spec (#9bd34b, #a78bfa, #5b9cf6, #e5b84a, #e05252) for the type/urgency/status badges only — body uses existing semantic tokens.

### Technical notes
- Inline edit pattern: click field → swap to `<input>` / `<textarea>`, blur or Enter saves via `updateOpportunity(id, patch)`.
- Mobile: cards stack (grid `md:grid-cols-2 xl:grid-cols-3`, single col on mobile).
- Realtime: subscribe to both tables on the page.
- No changes to existing pages beyond sidebar + App.tsx route.

### Files to create
- `supabase/functions/fundraising-context/index.ts`
- `src/pages/CapitalRaise.tsx`
- `src/components/fundraising/{StatsBar,TimelineStrip,FilterBar,OpportunityCard,TasksPanel}.tsx`
- `src/hooks/useFundraising.ts`

### Files to edit
- `src/App.tsx` (route)
- `src/components/visi/Sidebar.tsx` (nav)
- `supabase/functions/ai-build-context/index.ts` (RAG hook)
- `supabase/config.toml` (no change — function will use default JWT verification)
