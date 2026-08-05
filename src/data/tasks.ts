import { ANY_ORG } from "@/lib/AppState";

/**
 * Tasks — one number model for the list, the board and the Gantt.
 *
 * Every task stores `start` and `len` as **day offsets** from a single
 * epoch. Nothing stores a date string. The list derives its due date from
 * the same two integers the bar is drawn from, so a row can never say
 * Thursday while its bar sits on Friday — the usual failure when a project
 * tool keeps a `due_date` column next to Gantt coordinates and lets them
 * drift apart.
 *
 * Replace with:
 *   select id, project_id, title, assignee, priority, done,
 *          (start_on - :epoch) as start, (end_on - start_on + 1) as len
 *   from tasks where project_id = any(:projects);
 * Keep the offsets integer and everything below is unchanged.
 */

/** Days shown on the timeline axis. */
export const AXIS_DAYS = 14;
/** Where "now" sits on that axis: four days of history, ten ahead. */
export const TODAY_INDEX = 4;

/** Midnight of the axis' first day. Recomputed per session, never stored. */
export function epochDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - TODAY_INDEX);
  return d;
}

export function dateForOffset(offset: number): Date {
  const d = epochDate();
  d.setDate(d.getDate() + offset);
  return d;
}

export interface Project {
  id: string;
  name: string;
  /** Workspace id, or ANY_ORG for work that belongs to no single venture. */
  org: string;
  lead: string;
}

export interface Person {
  name: string;
  initials: string;
  color: string;
}

export type Priority = "high" | "medium" | "low";

export interface Task {
  id: string;
  project: string;
  title: string;
  assignee: string;
  priority: Priority;
  /** Day offset of the first working day, from the axis epoch. */
  start: number;
  /** Length in days, inclusive. Due date = start + len - 1. */
  len: number;
  /** Tasks that must finish before this one starts. */
  deps?: string[];
  done?: boolean;
}

/** select id, name, org, lead from projects where archived is false; */
export const PROJECTS: Project[] = [
  { id: "voting", name: "Voting Hub", org: "uwazi", lead: "Mira Khan" },
  { id: "preseed", name: "Pre-seed raise", org: "raia", lead: "Myke" },
  { id: "hooptea", name: "Hoop Tea activation", org: "cc", lead: "Devon Rios" },
  { id: "ascend", name: "Ascend cohort 3", org: "bin", lead: "Alex Sutter" },
  { id: "handoff", name: "1Flock handoff", org: "1flock", lead: "Myke" },
];

export const PEOPLE: Record<string, Person> = {
  Myke: { name: "Myke", initials: "MY", color: "var(--sw-blue)" },
  "Mira Khan": { name: "Mira Khan", initials: "MK", color: "var(--sw-violet)" },
  "Devon Rios": { name: "Devon Rios", initials: "DR", color: "var(--sw-teal)" },
  "Alex Sutter": { name: "Alex Sutter", initials: "AS", color: "var(--sw-amber)" },
  "Priya Nandi": { name: "Priya Nandi", initials: "PN", color: "var(--sw-magenta)" },
};

/**
 * Offsets are hand-set so the fixtures read like a real plan: overlapping
 * work, a few things already late, and dependency chains long enough that
 * the critical path is not simply the longest bar.
 */
export const TASKS: Task[] = [
  // Voting Hub — the chain that decides the launch date.
  { id: "v1", project: "voting", title: "Scrape county ballot feeds", assignee: "Mira Khan", priority: "high", start: 0, len: 3, done: true },
  { id: "v2", project: "voting", title: "Normalise precinct schema", assignee: "Mira Khan", priority: "high", start: 3, len: 3, deps: ["v1"] },
  { id: "v3", project: "voting", title: "Verify against Secretary of State records", assignee: "Devon Rios", priority: "high", start: 6, len: 3, deps: ["v2"] },
  { id: "v4", project: "voting", title: "Ship the lookup page", assignee: "Myke", priority: "high", start: 9, len: 4, deps: ["v3"] },
  { id: "v5", project: "voting", title: "Write the methodology note", assignee: "Priya Nandi", priority: "low", start: 5, len: 2 },
  { id: "v6", project: "voting", title: "Accessibility pass on the ballot table", assignee: "Devon Rios", priority: "medium", start: 2, len: 2, done: true },

  // Pre-seed raise — money work, front-loaded and slipping.
  { id: "r1", project: "preseed", title: "Finalise the data room", assignee: "Myke", priority: "high", start: 0, len: 4, done: true },
  { id: "r2", project: "preseed", title: "Rebuild the model with Q2 actuals", assignee: "Priya Nandi", priority: "high", start: 2, len: 3, deps: ["r1"] },
  { id: "r3", project: "preseed", title: "Send the Wexler follow-up", assignee: "Myke", priority: "high", start: 3, len: 1, deps: ["r2"] },
  { id: "r4", project: "preseed", title: "Partner meeting — Alder Fund", assignee: "Myke", priority: "medium", start: 7, len: 1, deps: ["r3"] },
  { id: "r5", project: "preseed", title: "Reference calls for diligence", assignee: "Mira Khan", priority: "medium", start: 8, len: 3, deps: ["r4"] },

  // Hoop Tea activation — event work, hard external deadline.
  { id: "h1", project: "hooptea", title: "Lock the venue contract", assignee: "Devon Rios", priority: "high", start: 1, len: 2, done: true },
  { id: "h2", project: "hooptea", title: "Confirm caterer headcount", assignee: "Devon Rios", priority: "high", start: 3, len: 1, deps: ["h1"] },
  { id: "h3", project: "hooptea", title: "Brand the pour stations", assignee: "Alex Sutter", priority: "medium", start: 5, len: 3, deps: ["h1"] },
  { id: "h4", project: "hooptea", title: "Run of show + staffing grid", assignee: "Priya Nandi", priority: "medium", start: 8, len: 2, deps: ["h2", "h3"] },
  { id: "h5", project: "hooptea", title: "Activation day", assignee: "Devon Rios", priority: "high", start: 11, len: 1, deps: ["h4"] },

  // Ascend cohort 3 — programme ops.
  { id: "a1", project: "ascend", title: "Close applications", assignee: "Alex Sutter", priority: "high", start: 0, len: 2, done: true },
  { id: "a2", project: "ascend", title: "Score the shortlist", assignee: "Alex Sutter", priority: "high", start: 2, len: 4, deps: ["a1"] },
  { id: "a3", project: "ascend", title: "Schedule founder interviews", assignee: "Priya Nandi", priority: "medium", start: 6, len: 3, deps: ["a2"] },
  { id: "a4", project: "ascend", title: "Send cohort offers", assignee: "Alex Sutter", priority: "high", start: 9, len: 2, deps: ["a3"] },
  { id: "a5", project: "ascend", title: "Book the mentor sessions", assignee: "Mira Khan", priority: "low", start: 4, len: 5 },

  // 1Flock handoff — shipping someone else's problem back to them.
  { id: "f1", project: "handoff", title: "Freeze the feature branch", assignee: "Myke", priority: "medium", start: 1, len: 1, done: true },
  { id: "f2", project: "handoff", title: "Document the deploy path", assignee: "Mira Khan", priority: "high", start: 2, len: 3, deps: ["f1"] },
  { id: "f3", project: "handoff", title: "Transfer domain and DNS", assignee: "Myke", priority: "high", start: 6, len: 2, deps: ["f2"] },
  { id: "f4", project: "handoff", title: "Walkthrough with their team", assignee: "Devon Rios", priority: "medium", start: 10, len: 2, deps: ["f3"] },
];

/** Due date = the last day the bar covers. Derived, never stored. */
export const dueOffset = (t: Task) => t.start + t.len - 1;

export const isOverdue = (t: Task) => !t.done && dueOffset(t) < TODAY_INDEX;

/** Started but not finished, judged by the same offsets the bar uses. */
export const isActive = (t: Task) => !t.done && t.start <= TODAY_INDEX;

export type Column = "todo" | "doing" | "done";

/**
 * Board columns are derived from the dates, not a separate status field.
 * A status column that can disagree with the schedule is a second source of
 * truth, and it is always the one that goes stale.
 */
export function columnOf(t: Task): Column {
  if (t.done) return "done";
  return t.start <= TODAY_INDEX ? "doing" : "todo";
}

export const COLUMN_LABEL: Record<Column, string> = {
  todo: "To do",
  doing: "In progress",
  done: "Done",
};

/**
 * Critical path, computed rather than flagged by hand.
 *
 * The longest dependency chain by duration through each project's graph.
 * A hand-set `critical: true` is a comment that stops being true the first
 * time an estimate changes; this cannot drift because it reads the same
 * offsets everything else does.
 */
export function criticalPath(tasks: Task[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const longest = new Map<string, number>();
  const cameFrom = new Map<string, string | undefined>();

  const walk = (id: string, seen: Set<string>): number => {
    const cached = longest.get(id);
    if (cached !== undefined) return cached;
    const task = byId.get(id);
    if (!task || seen.has(id)) return 0; // a cycle is bad data, not a crash
    seen.add(id);

    let bestLen = 0;
    let bestFrom: string | undefined;
    for (const dep of task.deps ?? []) {
      if (!byId.has(dep)) continue;
      const depLen = walk(dep, seen);
      if (depLen > bestLen) {
        bestLen = depLen;
        bestFrom = dep;
      }
    }
    seen.delete(id);
    longest.set(id, bestLen + task.len);
    cameFrom.set(id, bestFrom);
    return bestLen + task.len;
  };

  const path = new Set<string>();
  const projects = new Set(tasks.map((t) => t.project));
  for (const project of projects) {
    const members = tasks.filter((t) => t.project === project);
    let tail: string | undefined;
    let best = 0;
    for (const t of members) {
      const total = walk(t.id, new Set());
      if (total > best) {
        best = total;
        tail = t.id;
      }
    }
    // A single unblocked task is not a "critical path", it is just a task.
    if (tail && (byId.get(tail)?.deps?.length ?? 0) > 0) {
      let cursor: string | undefined = tail;
      while (cursor) {
        path.add(cursor);
        cursor = cameFrom.get(cursor);
      }
    }
  }
  return path;
}

export const projectOrg = (projectId: string) =>
  PROJECTS.find((p) => p.id === projectId)?.org ?? ANY_ORG;
