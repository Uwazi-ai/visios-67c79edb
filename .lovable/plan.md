## Tasks Page — Asana-Style Rebuild

A complete rebuild of `/tasks` into a full project management workspace with 4 view modes, projects sidebar, task detail panel, subtasks, sections, AI generation, and drag-and-drop. Existing `tasks` table stays — we'll extend it (the spec says `items`, but this project uses `tasks` already with most needed columns; switching tables would orphan all existing data).

---

### Important reconciliations with the existing codebase

The spec was written against an `items` table, but this project already has a richer `tasks` table with `project_id`, `parent_task_id`, `assignee_id`, `status`, `priority`, `due_at`, `description`, `estimate_mins`, plus a working `task_activity` log and trigger. Reusing `tasks` preserves all current data and the Vision/Tasks integration. Only the additive columns and new tables are needed.

Also: the existing `projects` table is minimal (`id, org_id, name, description, status`). We'll extend it rather than recreate.

---

### Phase 1 — Schema (one migration)

Extend `projects`:
- `emoji TEXT DEFAULT '📋'`
- `is_archived BOOLEAN DEFAULT false`
- `display_order INTEGER DEFAULT 0`
- `created_by UUID`

Extend `tasks`:
- `section_id UUID REFERENCES task_sections(id)`
- `start_date TIMESTAMPTZ`
- `sort_order INTEGER DEFAULT 0`
- `completed_at TIMESTAMPTZ` (auto-set via trigger when status flips to/from `done`)
- Widen status check to allow `review` (currently todo/in_progress/done/blocked)

New tables (RLS via `is_org_member` on parent project's org):
- `task_sections` (project_id, name, display_order, is_collapsed)
- `task_comments` (task_id, user_id, content)
- `task_attachments` (task_id, name, url, source, drive_file_id)

Skip new `task_activity` table — already exists and the trigger already logs status/priority/assignee/due changes. We'll reuse it.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE projects, tasks, task_sections, task_comments`.

---

### Phase 2 — Layout shell

- New `src/pages/Tasks.tsx` (replaces existing) with 3-pane layout: ProjectsSidebar (240px) | Main | TaskDetailPanel (360px slide-in).
- Hooks: `useProjects`, `useSections`, `useTasksV2` (extends existing `useTasks` with sections + subtasks tree), `useTaskDetail`.
- All hooks subscribe to Supabase Realtime.

### Phase 3 — Projects sidebar
- `ProjectsSidebar.tsx`: orgs from `useOrg`, projects grouped by org with org color accent, Quick Filters (All / Due Today / Overdue / High Priority / Completed) computed from cached tasks, [+ New Project] modal with emoji picker + template seeding (Blank / Sprint / Launch / Client / Personal — templates create predefined sections).
- Hover row → `[⋮]` menu: Edit, Duplicate, Archive, Delete.

### Phase 4 — List view (default, ship first)
- `ListView.tsx` with collapsible sections, inline-edit cells (assignee popover, date picker, priority/status dropdowns), subtask indent + collapse, checkbox complete with strikethrough animation.
- Quick add row at bottom of each section. Enter = new task below, Tab = subtask, Space = toggle complete, Esc = close panel.
- Row hover `[⋮]`: Edit / Duplicate / Add subtask / Move section / Delete.

### Phase 5 — Task detail panel
- `TaskDetailPanel.tsx` (slide-in 360px desktop, full-screen bottom sheet mobile) with inline-edit fields (auto-save), description (Tiptap), subtasks list, attachments (Drive picker stub + upload to existing `chat-attachments` bucket initially), Vision suggestion (calls existing `claude-proxy` with task context), activity feed merging `task_activity` + `task_comments`, comment composer.

### Phase 6 — Board view
- `BoardView.tsx` rebuilt with `@dnd-kit` (already installed) — columns by status, draggable cards, [+ Add column] creates a new status value (stored on project as `custom_statuses jsonb` — added in same migration if we want this, otherwise fixed 5).
- Card: title, assignee avatar, due, priority border, subtask count.

### Phase 7 — Timeline (Gantt) view
- `TimelineView.tsx`: simple SVG/CSS grid Gantt. Sections as rows, bars span `start_date`→`due_at`. Drag bar = move dates, drag right edge = resize. Today line. Week/Month/Quarter zoom. Unscheduled tray below.

### Phase 8 — Calendar view
- `CalendarView.tsx`: monthly grid, task chips colored by priority, drag chip → update `due_at`, click empty day → quick add.

### Phase 9 — View tabs, filter/sort/group bar, progress bar
- `ViewTabBar.tsx`, `FilterBar.tsx` (chips for active filters), `ProjectProgressBar.tsx`.

### Phase 10 — AI features
- Vision suggestion in detail panel: reuse `claude-proxy` edge function, prompt with task + recent contact interactions + KB hits.
- New edge function `ai-extract-tasks` (Lovable AI Gateway, `openai/gpt-5-mini`, JSON output) for "Generate from Meeting Notes" modal.
- Reuse existing `ai-suggest-subtasks` for the full Add Task form's subtask suggestions.

### Phase 11 — Polish
- Tiptap rich-text descriptions (`@tiptap/react`, `@tiptap/starter-kit`).
- Keyboard shortcuts (global `useTasksKeyboard` hook on /tasks).
- Mobile: hamburger drawer for sidebar, swipe-row actions (reuse `framer-motion`), FAB, bottom-sheet detail panel.
- Task full-page route `/tasks/:id` (renders detail panel inline at full width).

---

### Tech notes
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` (`sortable` not yet installed — add).
- Rich text: `@tiptap/react @tiptap/pm @tiptap/starter-kit` (add).
- All colors via existing semantic tokens + `ORG_COLORS` from `src/lib/orgs.ts`. No hardcoded hex except priority indicators.
- Realtime: subscribe per active project; debounce optimistic updates 200ms before PATCH.
- All RLS via existing `is_org_member` helper — no new policies invented.

---

### Scope question

This is ~25 new components, 1 migration, 1 edge function, and 4 view engines. Realistically a single turn ships **Phases 1–5 (schema + sidebar + list + detail panel)** cleanly. Board (Phase 6) is mostly already built and can come in turn 1. Timeline + Calendar + AI extras are turn 2. If you want it all in one shot, I'll ship it but each view will be functional-but-rough vs. polished.

**Suggested split:**
- **Turn 1 (this approval):** Phases 1–6 — schema, sidebar with projects/quick filters/new project modal, ListView with sections/inline edit/subtasks, TaskDetailPanel with all fields + comments + Vision suggestion + activity, refreshed BoardView, view tab bar, filter/sort/group, progress bar.
- **Turn 2:** Phases 7–11 — Timeline, Calendar, AI meeting extraction, Tiptap, keyboard shortcuts, mobile polish, full-page route.

Approve and I'll start with the migration.
