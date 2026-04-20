

## Tasks Page Plan

Build a full Tasks page replacing the current placeholder, using the existing `tasks` table and design system.

### Scope (v1)

**Layout**: Left projects panel (200px) + main area with Board/List/My Tasks toggle in topbar.

**Three views**:
1. **Board** (default) — Kanban with 4 columns (Todo, In Progress, Done, Blocked), drag-drop via `@dnd-kit/core`, inline "+ Add task" per column.
2. **List** — Sortable table with inline edits (status, assignee, due date).
3. **My Tasks** — Filtered to current user, grouped by Due Today / This Week / Later / No Due Date.

**Task detail panel** (slide-in 280px right): editable title, status, priority, org, assignee, due date, estimate, project, description, subtasks (parent/child via `parent_task_id`), delete.

**Quick capture**: Global `T` shortcut → centered glass modal for fast add.

**Realtime**: Subscribe to `tasks` postgres_changes filtered by active org so board updates live.

**AI features (v1)**: 
- "Suggest subtasks" button → new edge function `ai-suggest-subtasks` using `google/gemini-2.5-flash` via Lovable AI.
- "Estimate time" button → new edge function `ai-estimate-task`.
- Weekly digest deferred to v2 (needs cron setup).

### Data model

Uses existing `tasks` table as-is:
- `status`: `'todo' | 'in_progress' | 'done' | 'blocked'`
- `priority`: `'urgent' | 'high' | 'normal' | 'low'`
- `parent_task_id` for subtasks
- `project_id` linked to `projects` table
- Org-scoped via RLS (already in place)

No schema changes required. Realtime: enable `tasks` in `supabase_realtime` publication via migration.

### Files

**Create**:
- `src/pages/Tasks.tsx` — main page with view toggle and routing between views
- `src/components/tasks/ProjectsPanel.tsx` — left sidebar with org-grouped projects
- `src/components/tasks/BoardView.tsx` — Kanban with `@dnd-kit/core`
- `src/components/tasks/TaskCard.tsx` — draggable card
- `src/components/tasks/ListView.tsx` — sortable table
- `src/components/tasks/MyTasksView.tsx` — grouped-by-due view
- `src/components/tasks/TaskDetailPanel.tsx` — slide-in editor with subtasks
- `src/components/tasks/QuickCaptureModal.tsx` — global `T` shortcut modal
- `src/hooks/useTasks.ts` — fetch + realtime subscription
- `supabase/functions/ai-suggest-subtasks/index.ts`
- `supabase/functions/ai-estimate-task/index.ts`

**Edit**:
- `src/App.tsx` — wire `/tasks` route to new `Tasks.tsx`
- `src/pages/EmptyPages.tsx` — remove `TasksPage` export
- `src/components/visi/AppShell.tsx` — mount global `QuickCaptureModal` (so `T` works on every page)

**Migration**:
- Add `ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;` and set `REPLICA IDENTITY FULL`.

### Dependencies

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (for Kanban drag-drop)

### Mobile

- Board view → horizontal snap-scroll columns, one visible at a time
- Task tap → full-screen sheet (reuse `Sheet` from `bottom`)
- FAB for quick capture
- My Tasks default on mobile

### Out of scope (v2)

- Rich text description editor (use plain `Textarea` for v1)
- Activity log + comments (no table for it yet)
- Linked email reference
- Swipe-to-done/delete gestures
- Weekly digest cron (n8n)

