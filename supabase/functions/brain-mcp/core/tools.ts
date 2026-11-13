// The brain-mcp tool set. Each tool has a description written for an AI
// reader, a strict Zod schema, an access level, and a handler.
//
// Access levels:
//   read         any agent
//   write        any agent, inbox and own-job writes only
//   admin_read   kova only
//   admin_write  kova only
// The kova check, the rate limit, the exclusion screen and the audit log all
// live in callTool below, so no handler can skip them.

import { z } from "zod/v4";
import { asServiceRole } from "./db.ts";
import type { Db, Queryable, Row } from "./db.ts";
import {
  GATED_ACTIONS,
  Rejection,
  screenExclusions,
  screenMinors,
  screenMoney,
  screenPurchaseClaim,
  screenSocial,
} from "./guardrails.ts";

export const AGENTS = ["kova", "grok", "chatgpt", "muse", "stevie"] as const;
export const ADMIN_AGENT = "kova";
const VENTURES = [
  "personal", "uwazi", "bic", "culture-club", "myke-labs", "kova", "consulting",
  "rps-office", "all-in-favor", "higher-ground", "household", "system",
] as const;
const DOMAINS = [
  "content", "social", "research", "agents", "startups", "funding", "clients",
  "job-search", "day-to-day", "family",
] as const;
const ACTION_TYPES = ["send", "post_draft", "reply_batch", "book", "buy", "deploy", "other"] as const;
const STAGES = [
  "signal", "qualified", "researched", "outreach", "follow-up", "call", "proposal",
  "signed", "nurture", "lost",
] as const;
const TRACKS = ["consulting", "uwazi"] as const;
const WRITES_PER_HOUR = 60;

type Access = "read" | "write" | "admin_read" | "admin_write";
type Ctx = { agent: string; q: Queryable };

interface Tool {
  name: string;
  access: Access;
  description: string;
  schema: z.ZodType;
  // deno-lint-ignore no-explicit-any
  handler: (ctx: Ctx, args: any) => Promise<unknown>;
}

// shared field builders -------------------------------------------------------
const text = (max: number) => z.string().trim().min(1).max(max);
const venture = z.enum(VENTURES).describe("Which venture this belongs to. Use system for cross-venture items.");
const priority = z.int().min(1).max(3).describe("1 is most urgent, 3 is least.");
const uuid = (what: string) => z.uuid().describe(`The ${what} id, as returned by another brain tool.`);
const urls = z.array(z.url()).max(10);

const toJson = (v: unknown) => JSON.stringify(v);

async function one(q: Queryable, sql: string, params: unknown[]): Promise<Row | undefined> {
  return (await q.query(sql, params))[0];
}

async function ownJob(ctx: Ctx, jobId: string, verb: string): Promise<Row> {
  const job = await one(ctx.q, "select * from brain.jobs where id = $1::uuid for update", [jobId]);
  if (!job) throw new Rejection(`No job with id ${jobId}. Call get_my_jobs to see your jobs.`);
  if (job.assigned_to !== ctx.agent) {
    throw new Rejection(`This job is assigned to ${job.assigned_to}. Only the assignee can ${verb} it.`);
  }
  return job;
}

const isFamily = (job: { domain?: unknown; venture?: unknown }) =>
  job.domain === "family" || job.venture === "household";

// tools -----------------------------------------------------------------------
export const TOOLS: Tool[] = [
  // ---- read: any agent ----
  {
    name: "get_ontology",
    access: "read",
    description:
      "Read Myke's ontology, the reviewed source of truth about his ventures, roles, brands, rules and voice. " +
      "Call with no arguments to get the table of contents (slug, title, venture, version). " +
      "Call with section_slug to get one full section as markdown. Use this before writing anything about Myke or his work.",
    schema: z.strictObject({
      section_slug: z.string().trim().regex(/^[a-z0-9-]+$/).optional()
        .describe("A slug from the table of contents, for example hard-rules-and-separations. Omit for the table of contents."),
    }),
    async handler({ q }, a) {
      if (!a.section_slug) {
        const sections = await q.query(
          "select slug, title, venture, version, updated_at, length(body) as chars from brain.sections order by position, slug",
        );
        return { sections, hint: "Call get_ontology with a section_slug to read one section." };
      }
      const section = await one(q,
        "select slug, title, venture, body, version, updated_at from brain.sections where slug = $1::text",
        [a.section_slug]);
      if (!section) {
        const slugs = (await q.query("select slug from brain.sections order by position, slug")).map((r) => r.slug);
        throw new Rejection(`No section with slug ${a.section_slug}. Valid slugs: ${slugs.join(", ")}.`);
      }
      return section;
    },
  },
  {
    name: "search_brain",
    access: "read",
    description:
      "Full-text search across ontology sections, findings, tasks, decisions and leads. " +
      "Use it when you do not know which section or record holds the answer. " +
      "Returns up to 20 hits with type, id, title, a snippet and status. " +
      "Sections and decisions are reviewed truth. Findings and tasks show their review status, so treat new or proposed items as unverified.",
    schema: z.strictObject({
      query: text(200).describe("Plain words to search for. Quotes and OR are supported."),
      venture: venture.optional(),
    }),
    handler({ q }, a) {
      const headline = (col: string) => `ts_headline('english', ${col}, s.tsq, 'MaxWords=40, MinWords=15')`;
      return q.query(
        `with s as (select websearch_to_tsquery('english', $1::text) as tsq)
         select type, id, title, snippet, venture, status from (
           select 'section' as type, slug as id, title, ${headline("body")} as snippet, venture,
                  'truth' as status, ts_rank(search, s.tsq) as rank
             from brain.sections, s where search @@ s.tsq
           union all
           select 'decision', id::text, left(decision, 120), ${headline("coalesce(reasoning, decision)")}, venture,
                  'truth', ts_rank(search, s.tsq)
             from brain.decisions, s where search @@ s.tsq
           union all
           select 'finding', id::text, title, ${headline("body")}, venture, status, ts_rank(search, s.tsq)
             from brain.findings, s where search @@ s.tsq
           union all
           select 'task', id::text, title, ${headline("coalesce(details, title)")}, venture, status, ts_rank(search, s.tsq)
             from brain.tasks, s where search @@ s.tsq
           union all
           select 'lead', id::text, org, ${headline("signal")}, track, stage, ts_rank(search, s.tsq)
             from brain.leads, s where search @@ s.tsq
         ) r
         where ($2::text is null or venture = $2::text)
         order by rank desc limit 20`,
        [a.query, a.venture ?? null],
      ).then((hits) => ({ hits, count: hits.length }));
    },
  },
  {
    name: "get_priorities",
    access: "read",
    description:
      "List approved open tasks, most urgent first (priority 1 to 3, then due date). " +
      "Use it to learn what Myke wants done now. Returns id, title, details, venture, priority, due_date and who proposed each task.",
    schema: z.strictObject({}),
    handler: ({ q }) =>
      q.query(
        `select id, title, details, venture, priority, due_date::text as due_date, proposed_by
           from brain.tasks where status = 'approved'
          order by priority, due_date nulls last, created_at`,
      ).then((tasks) => ({ tasks })),
  },
  {
    name: "get_my_jobs",
    access: "read",
    description:
      "List the jobs assigned to you that are queued, claimed or waiting on approval, most urgent first. " +
      "Call this at the start of a session to find your work. Each job includes instructions, action_type and, " +
      "when it is waiting on approval, the latest approval status.",
    schema: z.strictObject({}),
    handler: ({ q, agent }) =>
      q.query(
        `select j.id, j.title, j.instructions, j.venture, j.domain, j.action_type, j.status, j.priority,
                j.due_at, j.claimed_at,
                (select a.status from brain.approvals a where a.job_id = j.id
                  order by a.created_at desc limit 1) as approval_status
           from brain.jobs j
          where j.assigned_to = $1::text and j.status in ('queued', 'claimed', 'needs_approval')
          order by j.priority, j.due_at nulls last, j.created_at`,
        [agent],
      ).then((jobs) => ({ jobs })),
  },
  {
    name: "get_pipeline",
    access: "read",
    description:
      "List leads in the pipeline, optionally filtered by track (consulting or uwazi) and stage. " +
      "Use it to see where each lead stands and what the next step is. Returns up to 100 leads ordered by next step due date.",
    schema: z.strictObject({
      track: z.enum(TRACKS).optional(),
      stage: z.enum(STAGES).optional(),
    }),
    handler: ({ q }, a) =>
      q.query(
        `select id, track, org, contact_name, contact_role, source_url, signal, fit_score, stage,
                next_step, next_step_due::text as next_step_due, last_touch_at, owner_agent, notes
           from brain.leads
          where ($1::text is null or track = $1::text) and ($2::text is null or stage = $2::text)
          order by next_step_due nulls last, updated_at desc limit 100`,
        [a.track ?? null, a.stage ?? null],
      ).then((leads) => ({ leads })),
  },
  {
    name: "list_pending",
    access: "read",
    description:
      "List everything waiting on review: new findings, proposed tasks, open ontology proposals and pending approvals. " +
      "Use it to see what is in the inbox before adding something that may already be there.",
    schema: z.strictObject({}),
    async handler({ q }) {
      return {
        findings: await q.query(
          "select id, title, venture, submitted_by, created_at from brain.findings where status = 'new' order by created_at desc limit 50"),
        tasks: await q.query(
          "select id, title, venture, priority, due_date::text as due_date, proposed_by from brain.tasks where status = 'proposed' order by priority, created_at limit 50"),
        proposals: await q.query(
          "select id, section_slug, reason, proposed_by, created_at from brain.proposals where status = 'open' order by created_at limit 50"),
        approvals: await q.query(
          `select a.id, a.job_id, j.title as job_title, j.domain, a.action_type, a.risk_level, a.details,
                  a.requested_by, a.created_at
             from brain.approvals a join brain.jobs j on j.id = a.job_id
            where a.status = 'pending' order by a.created_at limit 50`),
      };
    },
  },

  // ---- read: the search and fetch pair ChatGPT deep research looks for ----
  {
    name: "search",
    access: "read",
    description:
      "Search the brain and get a short list of matching records. Same search as search_brain, in the simple shape research clients expect. " +
      "Returns results with id, title and url. Pass an id to fetch to read the full record.",
    schema: z.strictObject({ query: text(200).describe("Plain words to search for.") }),
    async handler(ctx, a) {
      const found = await BY_NAME.get("search_brain")!.handler(ctx, { query: a.query }) as { hits: Row[] };
      return {
        results: found.hits.map((h) => ({
          id: `${h.type}:${h.id}`,
          title: `${h.title} (${h.type}, ${h.status})`,
          url: `brain://${h.type}/${h.id}`,
        })),
      };
    },
  },
  {
    name: "fetch",
    access: "read",
    description:
      "Read one full record from the brain by the id that search returned, for example section:core-identity. " +
      "Returns id, title, text, url and metadata. Metadata includes the review status, so treat anything not marked truth, accepted or approved as unverified.",
    schema: z.strictObject({
      id: z.string().trim().regex(/^(section|decision|finding|task|lead):[A-Za-z0-9-]+$/)
        .describe("An id from search, in the form type:id."),
    }),
    async handler({ q }, a) {
      const [type, key] = a.id.split(":") as [string, string];
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
      const queries: Record<string, string> = {
        section: "select title, body as text, venture, 'truth' as status, version::text as detail from brain.sections where slug = $1::text",
        decision: "select left(decision, 120) as title, decision || E'\\n\\nReasoning: ' || coalesce(reasoning, '') as text, venture, 'truth' as status, decided_at::text as detail from brain.decisions where id = $1::uuid",
        finding: "select title, body || E'\\n\\nSources: ' || array_to_string(source_urls, ', ') as text, venture, status, submitted_by as detail from brain.findings where id = $1::uuid",
        task: "select title, coalesce(details, '') as text, venture, status, proposed_by as detail from brain.tasks where id = $1::uuid",
        lead: "select org as title, signal || E'\\n\\nNext step: ' || coalesce(next_step, 'none') as text, track as venture, stage as status, source_url as detail from brain.leads where id = $1::uuid",
      };
      const row = type === "section" || isUuid ? await one(q, queries[type], [key]) : undefined;
      if (!row) throw new Rejection(`No record with id ${a.id}. Call search to get valid ids.`);
      return {
        id: a.id,
        title: row.title,
        text: row.text,
        url: `brain://${type}/${key}`,
        metadata: { type, venture: row.venture, status: row.status, detail: row.detail },
      };
    },
  },

  // ---- write: any agent, inbox only ----
  {
    name: "log_finding",
    access: "write",
    description:
      "Add a finding to the inbox: something you learned that Myke or Kova should see, with its sources. " +
      "It stays unverified until Kova accepts it. Returns the new finding id.",
    schema: z.strictObject({
      title: text(200),
      body: text(8000).describe("What you found and why it matters. Plain text or markdown."),
      source_urls: urls.describe("Where this came from. Use an empty list only if there is no link."),
      venture,
    }),
    handler: ({ q, agent }, a) =>
      one(q,
        `insert into brain.findings (title, body, source_urls, venture, submitted_by)
         values ($1::text, $2::text, array(select jsonb_array_elements_text($3::text::jsonb)), $4::text, $5::text)
         returning id, status`,
        [a.title, a.body, toJson(a.source_urls), a.venture, agent]),
  },
  {
    name: "propose_task",
    access: "write",
    description:
      "Propose a task for Myke's list. It is created as proposed and only becomes real work when Kova approves it. " +
      "Returns the new task id.",
    schema: z.strictObject({
      title: text(200),
      details: text(4000),
      venture,
      priority,
      due_date: z.iso.date().optional().describe("Optional due date as YYYY-MM-DD."),
    }),
    handler: ({ q, agent }, a) =>
      one(q,
        `insert into brain.tasks (title, details, venture, priority, due_date, proposed_by)
         values ($1::text, $2::text, $3::text, $4::int, $5::date, $6::text) returning id, status`,
        [a.title, a.details, a.venture, a.priority, a.due_date ?? null, agent]),
  },
  {
    name: "propose_ontology_edit",
    access: "write",
    description:
      "Propose a replacement body for one ontology section. Nothing changes until Kova approves it. " +
      "Read the section with get_ontology first and send the full new body, not a diff. Returns the proposal id.",
    schema: z.strictObject({
      section_slug: z.string().trim().regex(/^[a-z0-9-]+$/),
      proposed_body: text(40000).describe("The complete new markdown body for the section."),
      reason: text(1000).describe("Why this change is correct, with a source if you have one."),
    }),
    async handler({ q, agent }, a) {
      const exists = await one(q, "select 1 from brain.sections where slug = $1::text", [a.section_slug]);
      if (!exists) {
        const slugs = (await q.query("select slug from brain.sections order by position, slug")).map((r) => r.slug);
        throw new Rejection(`No section with slug ${a.section_slug}. Valid slugs: ${slugs.join(", ")}.`);
      }
      return one(q,
        `insert into brain.proposals (section_slug, proposed_body, reason, proposed_by)
         values ($1::text, $2::text, $3::text, $4::text) returning id, status`,
        [a.section_slug, a.proposed_body, a.reason, agent]);
    },
  },
  {
    name: "log_lead",
    access: "write",
    description:
      "Add a lead to the pipeline at the signal stage. Use track consulting for client work and uwazi for funders and partners. " +
      "If the same org and source were already logged, the existing lead is returned instead of a duplicate. Returns the lead id.",
    schema: z.strictObject({
      track: z.enum(TRACKS),
      org: text(200),
      contact_name: text(120).optional(),
      contact_role: text(200).describe("The contact's role or title. Say unknown if you do not have it."),
      source_url: z.url().describe("The public page where you saw the signal."),
      signal: text(2000).describe("What they said or did that makes them a lead."),
    }),
    async handler({ q, agent }, a) {
      const existing = await one(q,
        "select id, stage, owner_agent from brain.leads where track = $1::text and lower(org) = lower($2::text) and source_url = $3::text",
        [a.track, a.org, a.source_url]);
      if (existing) return { ...existing, duplicate: true, note: "This lead was already logged. No new row was created." };
      return one(q,
        `insert into brain.leads (track, org, contact_name, contact_role, source_url, signal, owner_agent)
         values ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text) returning id, stage`,
        [a.track, a.org, a.contact_name ?? null, a.contact_role, a.source_url, a.signal, agent]);
    },
  },
  {
    name: "claim_job",
    access: "write",
    description:
      "Claim a queued job that is assigned to you, so everyone can see you are working on it. " +
      "Only the assignee can claim. Returns the job with its full instructions.",
    schema: z.strictObject({ job_id: uuid("job") }),
    async handler(ctx, a) {
      const job = await ownJob(ctx, a.job_id, "claim");
      if (job.status !== "queued") {
        throw new Rejection(`This job is ${job.status}, not queued. Only queued jobs can be claimed.`);
      }
      return one(ctx.q,
        `update brain.jobs set status = 'claimed', claimed_at = now() where id = $1::uuid
         returning id, title, instructions, venture, domain, action_type, status, due_at`,
        [a.job_id]);
    },
  },
  {
    name: "complete_job",
    access: "write",
    description:
      "Mark your job done and record the result. Jobs that send, post a draft, reply, book, buy or deploy need an approved " +
      "request first, so call request_approval and wait for the decision. A buy job ends with a cart for review, never a purchase. " +
      "Returns the finished job.",
    schema: z.strictObject({
      job_id: uuid("job"),
      result: text(8000).describe("What you did and what you produced."),
      result_links: urls.describe("Links to the work product. Use an empty list if there are none."),
    }),
    async handler(ctx, a) {
      const job = await ownJob(ctx, a.job_id, "complete");
      if (job.status !== "claimed" && job.status !== "needs_approval") {
        throw new Rejection(`This job is ${job.status}. Claim it with claim_job before completing it.`);
      }
      const gated = GATED_ACTIONS.includes(job.action_type as string);
      if (gated || job.status === "needs_approval") {
        const latest = await one(ctx.q,
          `select status from brain.approvals
            where job_id = $1::uuid and ($2::text is null or action_type = $2::text)
            order by (status = 'approved') desc, created_at desc limit 1`,
          [a.job_id, job.action_type ?? null]);
        if (!latest) {
          throw new Rejection(
            `This job needs approval before it can complete. Call request_approval with action_type ${job.action_type ?? "other"} and wait for the decision.`);
        }
        if (latest.status !== "approved") {
          throw new Rejection(`The approval for this job is ${latest.status}. It cannot complete until a human approves it.`);
        }
      }
      if (job.action_type === "buy") screenPurchaseClaim([a.result]);
      screenMinors({ family: isFamily(job), value: a });
      return one(ctx.q,
        `update brain.jobs set status = 'done', result = $2::text,
                result_links = array(select jsonb_array_elements_text($3::text::jsonb))
          where id = $1::uuid returning id, title, status, result, result_links`,
        [a.job_id, a.result, toJson(a.result_links)]);
    },
  },
  {
    name: "block_job",
    access: "write",
    description:
      "Mark your job blocked when you cannot finish it, and say what is in the way. " +
      "Kova sees blocked jobs in the daily digest. Returns the blocked job.",
    schema: z.strictObject({
      job_id: uuid("job"),
      reason: text(2000).describe("What is blocking you and what would unblock it."),
    }),
    async handler(ctx, a) {
      const job = await ownJob(ctx, a.job_id, "block");
      if (job.status === "done" || job.status === "blocked") {
        throw new Rejection(`This job is already ${job.status}.`);
      }
      return one(ctx.q,
        "update brain.jobs set status = 'blocked', block_reason = $2::text where id = $1::uuid returning id, title, status, block_reason",
        [a.job_id, a.reason]);
    },
  },
  {
    name: "request_approval",
    access: "write",
    description:
      "Ask a human to approve an action on your job before you take it. Required for send, post_draft, reply_batch, book, buy and deploy. " +
      "Put everything the approver needs in details. For buy, details must hold store and items, and may hold quantities, est_total and cart_url. " +
      "The job moves to needs_approval. Returns the approval id and who can approve.",
    schema: z.strictObject({
      job_id: uuid("job"),
      action_type: z.enum(ACTION_TYPES),
      details: z.record(z.string(), z.unknown())
        .describe("A JSON object describing exactly what will happen: the draft text, the recipient, the cart, the deploy target."),
      risk_level: z.enum(["low", "medium", "high"]),
    }),
    async handler(ctx, a) {
      const job = await ownJob(ctx, a.job_id, "request approval for");
      if (job.status !== "claimed" && job.status !== "needs_approval") {
        throw new Rejection(`This job is ${job.status}. Claim it with claim_job before requesting approval.`);
      }
      if (job.action_type && job.action_type !== a.action_type) {
        throw new Rejection(`This job's action_type is ${job.action_type}. Request approval with that action_type.`);
      }
      if (toJson(a.details).length > 20000) {
        throw new Rejection("details is too large. Keep it under 20,000 characters and link to long content instead.");
      }
      if (a.action_type === "buy") {
        const d = a.details as Row;
        if (typeof d.store !== "string" || !Array.isArray(d.items) || d.items.length === 0) {
          throw new Rejection("For a buy request, details needs store (text) and items (a non-empty list). est_total and cart_url are optional.");
        }
      }
      screenMoney(a.details);
      screenPurchaseClaim(a.details);
      screenSocial({ domain: job.domain as string, venture: job.venture as string, action_type: a.action_type, text: a.details });
      screenMinors({ family: isFamily(job), value: a.details });

      const approvers = job.domain === "family" ? ["myke", "family_approver"] : ["myke"];
      const pending = await one(ctx.q,
        "select id from brain.approvals where job_id = $1::uuid and status = 'pending'", [a.job_id]);
      if (pending) {
        return { approval_id: pending.id, status: "pending", can_approve: approvers,
          note: "A request for this job is already pending. No new request was created." };
      }
      const approval = await one(ctx.q,
        `insert into brain.approvals (job_id, action_type, details, risk_level, requested_by)
         values ($1::uuid, $2::text, $3::text::jsonb, $4::text, $5::text) returning id`,
        [a.job_id, a.action_type, toJson(a.details), a.risk_level, ctx.agent]);
      await ctx.q.query("update brain.jobs set status = 'needs_approval' where id = $1::uuid", [a.job_id]);
      return { approval_id: approval!.id, status: "pending", can_approve: approvers,
        note: "Wait for the decision. Check get_my_jobs for approval_status, then call complete_job." };
    },
  },

  // ---- admin: kova only ----
  {
    name: "create_job",
    access: "admin_write",
    description:
      "Create a job and assign it to one agent. Kova only. Set action_type when the job ends in an action on the outside world " +
      "(send, post_draft, reply_batch, book, buy, deploy), which makes human approval mandatory before it can complete. " +
      "Money work is refused. Returns the new job.",
    schema: z.strictObject({
      title: text(200),
      instructions: text(8000).describe("Everything the assignee needs. They cannot ask follow-up questions."),
      venture,
      domain: z.enum(DOMAINS),
      assigned_to: z.enum(AGENTS),
      action_type: z.enum(ACTION_TYPES).optional()
        .describe("The outside action this job ends in, if any. Omit or use other for research and internal work."),
      priority: priority.default(2),
      due_at: z.iso.datetime({ offset: true }).optional().describe("Optional deadline as an ISO 8601 timestamp with offset."),
    }),
    handler({ q }, a) {
      const body = [a.title, a.instructions];
      screenMoney(body);
      screenSocial({ domain: a.domain, venture: a.venture, action_type: a.action_type, text: body });
      screenMinors({ family: isFamily(a), value: body });
      return one(q,
        `insert into brain.jobs (title, instructions, venture, domain, assigned_to, action_type, priority, due_at, created_by)
         values ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::int, $8::timestamptz, 'kova')
         returning id, title, assigned_to, status, action_type, priority, due_at`,
        [a.title, a.instructions, a.venture, a.domain, a.assigned_to, a.action_type ?? null, a.priority, a.due_at ?? null]);
    },
  },
  {
    name: "review_item",
    access: "admin_write",
    description:
      "Review an inbox item. Kova only. Findings take accept or dismiss. Tasks take approve or reject, and done once an approved task is finished. " +
      "Proposals take approve or reject. Approving a proposal replaces the section body and bumps its version. Returns the item's new state.",
    schema: z.strictObject({
      type: z.enum(["finding", "task", "proposal"]),
      id: uuid("item"),
      action: z.enum(["approve", "reject", "accept", "dismiss", "done"]),
      note: text(1000).optional().describe("Optional reason, stored with the item."),
    }),
    async handler({ q }, a) {
      const rules: Record<string, Record<string, { from: string; to: string }>> = {
        finding: { accept: { from: "new", to: "accepted" }, dismiss: { from: "new", to: "dismissed" } },
        task: {
          approve: { from: "proposed", to: "approved" },
          reject: { from: "proposed", to: "rejected" },
          done: { from: "approved", to: "done" },
        },
        proposal: { approve: { from: "open", to: "approved" }, reject: { from: "open", to: "rejected" } },
      };
      const rule = rules[a.type][a.action];
      if (!rule) {
        throw new Rejection(`A ${a.type} cannot take the action ${a.action}. Valid actions: ${Object.keys(rules[a.type]).join(", ")}.`);
      }
      const table = { finding: "brain.findings", task: "brain.tasks", proposal: "brain.proposals" }[a.type as string]!;
      const item = await one(q, `select * from ${table} where id = $1::uuid for update`, [a.id]);
      if (!item) throw new Rejection(`No ${a.type} with id ${a.id}. Call list_pending to see open items.`);
      if (item.status !== rule.from) {
        throw new Rejection(`This ${a.type} is ${item.status}. The action ${a.action} needs it to be ${rule.from}.`);
      }
      let section: Row | undefined;
      if (a.type === "proposal" && a.action === "approve") {
        section = await one(q,
          "update brain.sections set body = $2::text where slug = $1::text returning slug, version",
          [item.section_slug, item.proposed_body]);
      }
      const updated = await one(q,
        `update ${table} set status = $2::text, review_note = $3::text, reviewed_at = now()
          where id = $1::uuid returning id, status, review_note`,
        [a.id, rule.to, a.note ?? null]);
      return section ? { ...updated, section } : updated;
    },
  },
  {
    name: "record_approval",
    access: "admin_write",
    description:
      "Record a human's decision on a pending approval. Kova only, and only after the human actually decided. " +
      "approver is myke or family_approver. family_approver can decide family-domain items only. A decision cannot be changed afterward. " +
      "Returns the decided approval and the job it unlocks.",
    schema: z.strictObject({
      approval_id: uuid("approval"),
      approver: z.enum(["myke", "family_approver"]).describe("The human who made the decision."),
      decision: z.enum(["approved", "denied"]),
    }),
    async handler({ q }, a) {
      const approval = await one(q,
        `select a.id, a.status, a.job_id, j.domain, j.title
           from brain.approvals a join brain.jobs j on j.id = a.job_id
          where a.id = $1::uuid for update of a`,
        [a.approval_id]);
      if (!approval) throw new Rejection(`No approval with id ${a.approval_id}. Call list_pending to see pending approvals.`);
      if (approval.status !== "pending") {
        throw new Rejection(`This approval is already ${approval.status}. Decisions cannot be changed.`);
      }
      if (a.approver === "family_approver" && approval.domain !== "family") {
        throw new Rejection(`The family approver can only approve family-domain items. This job is in the ${approval.domain} domain, so it needs Myke.`);
      }
      const decided = await one(q,
        "update brain.approvals set status = $2::text, approver = $3::text where id = $1::uuid returning id, status, approver, decided_at",
        [a.approval_id, a.decision, a.approver]);
      return { ...decided, job_id: approval.job_id, job_title: approval.title,
        note: a.decision === "approved"
          ? "The assignee can now finish the work and call complete_job."
          : "The job stays in needs_approval. The assignee can block it or request approval again with changes." };
    },
  },
  {
    name: "update_lead",
    access: "admin_write",
    description:
      "Update a lead's stage, fit score, next step or notes. Kova only. Send only the fields that change. " +
      "notes replaces the existing notes. Returns the updated lead.",
    schema: z.strictObject({
      lead_id: uuid("lead"),
      stage: z.enum(STAGES).optional(),
      fit_score: z.int().min(1).max(10).optional(),
      next_step: text(500).optional(),
      next_step_due: z.iso.date().optional().describe("YYYY-MM-DD."),
      notes: text(4000).optional(),
    }),
    async handler({ q }, a) {
      const { lead_id, ...changes } = a;
      if (Object.keys(changes).length === 0) {
        throw new Rejection("Nothing to update. Send at least one of stage, fit_score, next_step, next_step_due, notes.");
      }
      const lead = await one(q,
        `update brain.leads set
                stage = coalesce($2::text, stage), fit_score = coalesce($3::int, fit_score),
                next_step = coalesce($4::text, next_step), next_step_due = coalesce($5::date, next_step_due),
                notes = coalesce($6::text, notes), last_touch_at = now()
          where id = $1::uuid
          returning id, org, track, stage, fit_score, next_step, next_step_due::text as next_step_due, notes`,
        [lead_id, a.stage ?? null, a.fit_score ?? null, a.next_step ?? null, a.next_step_due ?? null, a.notes ?? null]);
      if (!lead) throw new Rejection(`No lead with id ${lead_id}. Call get_pipeline to find it.`);
      return lead;
    },
  },
  {
    name: "log_decision",
    access: "admin_write",
    description:
      "Record a decision Myke made, with the reasoning, so every agent works from it. Kova only. " +
      "Decisions are reviewed truth and show up in search_brain. Returns the decision id.",
    schema: z.strictObject({
      decision: text(1000),
      reasoning: text(4000),
      venture,
    }),
    handler: ({ q }, a) =>
      one(q,
        "insert into brain.decisions (decision, reasoning, venture) values ($1::text, $2::text, $3::text) returning id, decided_at",
        [a.decision, a.reasoning, a.venture]),
  },
  {
    name: "get_daily_digest",
    access: "admin_read",
    description:
      "Summarize the last 24 hours for Myke's brief. Kova only. Returns jobs done, jobs currently blocked, pending approvals, " +
      "new findings and pipeline movement.",
    schema: z.strictObject({}),
    async handler({ q }) {
      const since = "now() - interval '24 hours'";
      return {
        window_hours: 24,
        done: await q.query(
          `select id, title, assigned_to, venture, result, result_links, updated_at from brain.jobs
            where status = 'done' and updated_at > ${since} order by updated_at desc`),
        blocked: await q.query(
          "select id, title, assigned_to, venture, block_reason, updated_at from brain.jobs where status = 'blocked' order by updated_at desc"),
        pending_approvals: await q.query(
          `select a.id, a.job_id, j.title as job_title, j.domain, a.action_type, a.risk_level, a.requested_by, a.created_at
             from brain.approvals a join brain.jobs j on j.id = a.job_id
            where a.status = 'pending' order by a.created_at`),
        new_findings: await q.query(
          `select id, title, venture, submitted_by, created_at from brain.findings
            where status = 'new' and created_at > ${since} order by created_at desc`),
        pipeline_movement: await q.query(
          `select l.id as lead_id, l.org, l.track, e.from_stage, e.to_stage, e.created_at
             from brain.lead_events e join brain.leads l on l.id = e.lead_id
            where e.created_at > ${since} order by e.created_at desc`),
      };
    },
  },
  {
    name: "get_pipeline_stats",
    access: "admin_read",
    description:
      "Pipeline numbers for one week. Kova only. Pass any date in the week you want, or omit it for the current week (weeks start Monday). " +
      "Returns current counts by track and stage, new leads that week and stage moves that week.",
    schema: z.strictObject({
      week: z.iso.date().optional().describe("Any date inside the week, as YYYY-MM-DD. Omit for this week."),
    }),
    async handler({ q }, a) {
      const start = "date_trunc('week', coalesce($1::date, current_date)::timestamp)";
      const inWeek = (col: string) => `${col} >= ${start} and ${col} < ${start} + interval '7 days'`;
      const p = [a.week ?? null];
      const week = await one(q, `select ${start}::date::text as week_start`, p);
      return {
        week_start: week!.week_start,
        by_stage: await q.query(
          "select track, stage, count(*)::int as leads from brain.leads group by track, stage order by track, stage"),
        new_leads: await q.query(
          `select track, count(*)::int as leads from brain.leads where ${inWeek("created_at")} group by track order by track`, p),
        stage_moves: await q.query(
          `select l.track, e.from_stage, e.to_stage, count(*)::int as moves
             from brain.lead_events e join brain.leads l on l.id = e.lead_id
            where e.from_stage is not null and ${inWeek("e.created_at")}
            group by l.track, e.from_stage, e.to_stage order by l.track, moves desc`, p),
      };
    },
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
const isAdmin = (t: Tool) => t.access.startsWith("admin");
const isWrite = (t: Tool) => t.access.endsWith("write");

/** The tools an agent may call, in MCP tools/list shape. */
export function listTools(agent: string) {
  return TOOLS.filter((t) => !isAdmin(t) || agent === ADMIN_AGENT).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.schema),
    annotations: {
      readOnlyHint: !isWrite(t),
      destructiveHint: false,
      idempotentHint: !isWrite(t),
      openWorldHint: false,
    },
  }));
}

// Short, secret-free record of a call for the audit log.
function summarize(args: unknown): string {
  const clip = (_k: string, v: unknown) =>
    typeof v === "string" && v.length > 60 ? `${v.slice(0, 60)}...` : v;
  let out: string;
  try {
    const shaped = args && typeof args === "object" && "details" in args
      ? { ...(args as Row), details: `{${Object.keys((args as Row).details ?? {}).join(",")}}` }
      : args;
    out = JSON.stringify(shaped, clip) ?? "";
  } catch {
    out = "[unserializable]";
  }
  return out.length > 500 ? `${out.slice(0, 500)}...` : out;
}

export interface ToolResult {
  status: "ok" | "rejected" | "error";
  /** JSON-serializable data on ok, a plain message otherwise. */
  payload: unknown;
}

/** Runs one tool call with every server-side check, then writes the audit row. */
export async function callTool(db: Db, agent: string, name: string, rawArgs: unknown): Promise<ToolResult> {
  const tool = BY_NAME.get(name);
  let result: ToolResult;
  try {
    if (!tool) {
      throw new Rejection(`Unknown tool ${name}. Call tools/list to see the tools you can use.`);
    }
    if (isAdmin(tool) && agent !== ADMIN_AGENT) {
      throw new Rejection(`${name} is an admin tool. Only kova can call it. You are ${agent}.`);
    }
    const parsed = tool.schema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((i) => `- ${i.path.length ? i.path.join(".") : "arguments"}: ${i.message}`)
        .join("\n");
      throw new Rejection(`Invalid arguments for ${name}. Fix these and call again:\n${problems}`);
    }
    if (isWrite(tool)) screenExclusions(parsed.data);

    const payload = await asServiceRole(db, async (q) => {
      if (isWrite(tool)) {
        const used = await one(q,
          `select count(*)::int as c from brain.activity
            where agent = $1::text and is_write and result_status = 'ok'
              and created_at > now() - interval '1 hour'`,
          [agent]);
        if ((used!.c as number) >= WRITES_PER_HOUR) {
          throw new Rejection(`Rate limit reached: ${WRITES_PER_HOUR} writes per hour for ${agent}. Wait and try again later.`);
        }
      }
      return tool.handler({ agent, q }, parsed.data);
    });
    result = { status: "ok", payload };
  } catch (e) {
    if (e instanceof Rejection) {
      result = { status: "rejected", payload: e.message };
    } else {
      console.error(`brain-mcp ${name} failed:`, e);
      result = { status: "error", payload: "Internal error. The call was not applied. Try again, and block the job if it keeps failing." };
    }
  }

  try {
    await asServiceRole(db, (q) =>
      q.query(
        `insert into brain.activity (agent, tool, args_summary, result_status, is_write)
         values ($1::text, $2::text, $3::text, $4::text, $5::boolean)`,
        [agent, name.slice(0, 80), summarize(rawArgs), result.status, tool ? isWrite(tool) : false],
      ));
  } catch (e) {
    console.error("brain-mcp could not write the activity log:", e);
  }
  return result;
}
