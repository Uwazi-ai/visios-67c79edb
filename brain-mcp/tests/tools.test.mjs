// One block per tool: the normal path, then the failures an agent is most
// likely to hit. Everything goes through the real HTTP handler.
import { reporter } from './helpers.mjs';
import { startBrain } from './harness.mjs';

const { check } = reporter();
const { pg, call } = await startBrain();
const rows = async (sql, params = []) => (await pg.query(sql, params)).rows;
const NO_ID = '11111111-1111-4111-8111-111111111111';

await pg.query(`insert into brain.sections (slug, title, venture, body, position) values
  ('core-identity', 'CORE IDENTITY', 'personal', 'Myke builds civic tech in Kansas City.', 1),
  ('consulting-practice', 'CONSULTING PRACTICE', 'consulting', 'Technical and hands-on. Fractional CTO work.', 2)`);

const mkJob = async (extra = {}) =>
  (await call('kova', 'create_job', {
    title: 'Research five funders', instructions: 'List five funders with links.',
    venture: 'uwazi', domain: 'funding', assigned_to: 'grok', ...extra,
  })).data;

// ---- get_ontology ----
{
  const toc = await call('muse', 'get_ontology');
  check(toc.ok && toc.data.sections.map((s) => s.slug).join() === 'core-identity,consulting-practice', 'get_ontology: table of contents in reading order');
  check(toc.data.sections[0].body === undefined && toc.data.sections[0].chars > 0, 'get_ontology: table of contents carries sizes, not bodies');
  const one = await call('muse', 'get_ontology', { section_slug: 'consulting-practice' });
  check(one.ok && one.data.version === 1 && /Fractional CTO/.test(one.data.body), 'get_ontology: returns one section with its version');
  const missing = await call('muse', 'get_ontology', { section_slug: 'nope' });
  check(!missing.ok && /core-identity, consulting-practice/.test(missing.message), 'get_ontology: unknown slug lists the valid ones');
  const bad = await call('muse', 'get_ontology', { section_slug: 'Not A Slug' });
  check(!bad.ok && /section_slug/.test(bad.message), 'get_ontology: malformed slug is a validation error');
}

// ---- log_finding ----
let findingId;
{
  const f = await call('grok', 'log_finding', {
    title: 'Knight Foundation opens civic tech call', body: 'A new funding round for civic information tools.',
    source_urls: ['https://example.test/knight', 'https://example.test/thread'], venture: 'uwazi',
  });
  findingId = f.data?.id;
  const [row] = await rows('select submitted_by, status, source_urls from brain.findings where id = $1', [findingId]);
  check(f.ok && row.submitted_by === 'grok' && row.status === 'new', 'log_finding: stored as new under the caller identity');
  check(row.source_urls.length === 2 && row.source_urls[1] === 'https://example.test/thread', 'log_finding: source urls are stored as a list');
  const bad = await call('grok', 'log_finding', { title: 'x', body: 'y', source_urls: ['not a url'], venture: 'uwazi' });
  check(!bad.ok && /source_urls\.0/.test(bad.message), 'log_finding: a bad url is named by position');
  const spoof = await call('grok', 'log_finding', { title: 'x', body: 'y', source_urls: [], venture: 'uwazi', submitted_by: 'kova' });
  check(!spoof.ok && /submitted_by/.test(spoof.message), 'log_finding: an agent cannot pass its own identity');
}

// ---- propose_task ----
const taskIds = {};
{
  const a = await call('stevie', 'propose_task', { title: 'Ship store build', details: 'Submit to both stores.', venture: 'uwazi', priority: 2, due_date: '2026-12-01' });
  const b = await call('grok', 'propose_task', { title: 'Reply to funder', details: 'Answer the intro email.', venture: 'uwazi', priority: 1 });
  const c = await call('muse', 'propose_task', { title: 'Plan the week', details: 'Meals and rides.', venture: 'household', priority: 3 });
  Object.assign(taskIds, { a: a.data?.id, b: b.data?.id, c: c.data?.id });
  const [row] = await rows('select status, proposed_by, due_date::text d from brain.tasks where id = $1', [taskIds.a]);
  check(a.ok && row.status === 'proposed' && row.proposed_by === 'stevie' && row.d === '2026-12-01', 'propose_task: created as proposed under the caller');
  const bad = await call('grok', 'propose_task', { title: 't', details: 'd', venture: 'uwazi', priority: 5, due_date: 'tomorrow' });
  check(!bad.ok && /priority/.test(bad.message) && /due_date/.test(bad.message), 'propose_task: bad priority and date are both reported');
}

// ---- propose_ontology_edit ----
let proposalId, rejectedProposalId;
{
  const p = await call('chatgpt', 'propose_ontology_edit', { section_slug: 'consulting-practice', proposed_body: 'Technical and hands-on. Packaged pricing only.', reason: 'Myke moved off hourly.' });
  proposalId = p.data?.id;
  rejectedProposalId = (await call('grok', 'propose_ontology_edit', { section_slug: 'core-identity', proposed_body: 'Wrong.', reason: 'Guess.' })).data?.id;
  const [section] = await rows(`select body, version from brain.sections where slug = 'consulting-practice'`);
  check(p.ok && p.data.status === 'open' && /Fractional CTO/.test(section.body) && section.version === 1, 'propose_ontology_edit: the section does not change on proposal');
  const missing = await call('chatgpt', 'propose_ontology_edit', { section_slug: 'nope', proposed_body: 'x', reason: 'y' });
  check(!missing.ok && /Valid slugs/.test(missing.message), 'propose_ontology_edit: unknown section is refused');
}

// ---- log_lead ----
let leadId;
{
  const l = await call('grok', 'log_lead', { track: 'consulting', org: 'Acme Health', contact_name: 'Dana', contact_role: 'COO', source_url: 'https://example.test/acme', signal: 'Posted that they need an AI readiness audit.' });
  leadId = l.data?.id;
  const [row] = await rows('select owner_agent, stage from brain.leads where id = $1', [leadId]);
  check(l.ok && row.owner_agent === 'grok' && row.stage === 'signal', 'log_lead: starts at signal, owned by the caller');
  const dup = await call('muse', 'log_lead', { track: 'consulting', org: 'ACME HEALTH', contact_role: 'COO', source_url: 'https://example.test/acme', signal: 'Same post.' });
  check(dup.ok && dup.data.duplicate && dup.data.id === leadId && (await rows('select 1 from brain.leads')).length === 1, 'log_lead: a duplicate returns the existing lead');
  await call('grok', 'log_lead', { track: 'uwazi', org: 'Democracy Fund', contact_role: 'unknown', source_url: 'https://example.test/df', signal: 'New civic infrastructure grant.' });
  const bad = await call('grok', 'log_lead', { track: 'sales', org: 'X', contact_role: 'Y', source_url: 'https://example.test/x', signal: 's' });
  check(!bad.ok && /track/.test(bad.message), 'log_lead: an unknown track is refused');
}

// ---- create_job ----
{
  const job = await mkJob({ due_at: '2026-11-20T17:00:00-06:00' });
  const [row] = await rows('select created_by, priority, action_type, status from brain.jobs where id = $1', [job.id]);
  check(row.created_by === 'kova' && row.priority === 2 && row.action_type === null && row.status === 'queued', 'create_job: queued, priority 2 and ungated by default');
  check(new Date(job.due_at).toISOString() === '2026-11-20T23:00:00.000Z', 'create_job: the deadline keeps its timezone');
  const bad = await call('kova', 'create_job', { title: 't', instructions: 'i', venture: 'uwazi', domain: 'funding', assigned_to: 'gemini' });
  check(!bad.ok && /assigned_to/.test(bad.message), 'create_job: an unknown agent is refused');
  const naive = await call('kova', 'create_job', { title: 't', instructions: 'i', venture: 'uwazi', domain: 'funding', assigned_to: 'grok', due_at: '2026-11-20 17:00' });
  check(!naive.ok && /due_at/.test(naive.message), 'create_job: a deadline without an offset is refused');
}

// ---- get_my_jobs / claim_job ----
let jobId;
{
  await pg.query('delete from brain.jobs');
  jobId = (await mkJob({ priority: 1 })).id;
  await mkJob({ assigned_to: 'stevie', title: 'Deploy docs site' });
  const mine = await call('grok', 'get_my_jobs');
  check(mine.ok && mine.data.jobs.length === 1 && mine.data.jobs[0].instructions.includes('five funders'), 'get_my_jobs: only the caller\'s jobs, with instructions');
  const notMine = await call('muse', 'claim_job', { job_id: jobId });
  check(!notMine.ok && /assigned to grok/.test(notMine.message), 'claim_job: only the assignee can claim');
  const claimed = await call('grok', 'claim_job', { job_id: jobId });
  check(claimed.ok && claimed.data.status === 'claimed', 'claim_job: a queued job becomes claimed');
  const again = await call('grok', 'claim_job', { job_id: jobId });
  check(!again.ok && /claimed, not queued/.test(again.message), 'claim_job: a claimed job cannot be claimed again');
  const missing = await call('grok', 'claim_job', { job_id: NO_ID });
  check(!missing.ok && /No job with id/.test(missing.message), 'claim_job: an unknown id is refused');
}

// ---- complete_job ----
{
  const fresh = (await mkJob()).id;
  const unclaimed = await call('grok', 'complete_job', { job_id: fresh, result: 'Done', result_links: [] });
  check(!unclaimed.ok && /claim_job/.test(unclaimed.message), 'complete_job: an unclaimed job cannot complete');
  const other = await call('stevie', 'complete_job', { job_id: jobId, result: 'Done', result_links: [] });
  check(!other.ok && /Only the assignee/.test(other.message), 'complete_job: only the assignee can complete');
  const done = await call('grok', 'complete_job', { job_id: jobId, result: 'Five funders listed.', result_links: ['https://example.test/list'] });
  const [row] = await rows('select status, result, result_links from brain.jobs where id = $1', [jobId]);
  check(done.ok && row.status === 'done' && row.result_links[0] === 'https://example.test/list', 'complete_job: an ungated job completes and stores its result');
  const mine = await call('grok', 'get_my_jobs');
  check(mine.data.jobs.every((j) => j.id !== jobId), 'get_my_jobs: finished jobs drop off the list');
}

// ---- block_job ----
{
  const id = (await mkJob()).id;
  const other = await call('stevie', 'block_job', { job_id: id, reason: 'x' });
  check(!other.ok, 'block_job: only the assignee can block');
  const blocked = await call('grok', 'block_job', { job_id: id, reason: 'The funder list is behind a login.' });
  check(blocked.ok && blocked.data.status === 'blocked' && /behind a login/.test(blocked.data.block_reason), 'block_job: records the reason');
  const again = await call('grok', 'block_job', { job_id: id, reason: 'x' });
  const finished = await call('grok', 'block_job', { job_id: jobId, reason: 'x' });
  check(!again.ok && !finished.ok, 'block_job: blocked and done jobs cannot be blocked');
}

// ---- request_approval ----
let approvalId, sendJob;
{
  sendJob = (await mkJob({ title: 'Email the funder intro', instructions: 'Draft the intro note.', domain: 'clients', action_type: 'send' })).id;
  const early = await call('grok', 'request_approval', { job_id: sendJob, action_type: 'send', details: { to: 'a funder' }, risk_level: 'medium' });
  check(!early.ok && /claim_job/.test(early.message), 'request_approval: the job must be claimed first');
  await call('grok', 'claim_job', { job_id: sendJob });
  const mismatch = await call('grok', 'request_approval', { job_id: sendJob, action_type: 'other', details: {}, risk_level: 'low' });
  check(!mismatch.ok && /action_type is send/.test(mismatch.message), 'request_approval: the action must match the job');
  const ask = await call('grok', 'request_approval', { job_id: sendJob, action_type: 'send', details: { to: 'a funder', draft: 'Hello from UWAZI.' }, risk_level: 'medium' });
  approvalId = ask.data?.approval_id;
  const [job] = await rows('select status from brain.jobs where id = $1', [sendJob]);
  const [appr] = await rows('select requested_by, status, details from brain.approvals where id = $1', [approvalId]);
  check(ask.ok && job.status === 'needs_approval' && appr.requested_by === 'grok' && appr.details.draft === 'Hello from UWAZI.', 'request_approval: stores the details and moves the job to needs_approval');
  check(ask.data.can_approve.join() === 'myke', 'request_approval: a non-family job names myke as the approver');
  const dup = await call('grok', 'request_approval', { job_id: sendJob, action_type: 'send', details: { to: 'x' }, risk_level: 'low' });
  check(dup.ok && dup.data.approval_id === approvalId && (await rows('select 1 from brain.approvals')).length === 1, 'request_approval: a second request returns the pending one');
  const mine = await call('grok', 'get_my_jobs');
  check(mine.data.jobs.find((j) => j.id === sendJob)?.approval_status === 'pending', 'get_my_jobs: shows the approval status');

  const cart = (await mkJob({ title: 'Weekly grocery cart', instructions: 'Build the cart for review.', venture: 'household', domain: 'family', assigned_to: 'muse', action_type: 'buy' })).id;
  await call('muse', 'claim_job', { job_id: cart });
  const thin = await call('muse', 'request_approval', { job_id: cart, action_type: 'buy', details: { note: 'groceries' }, risk_level: 'low' });
  check(!thin.ok && /store/.test(thin.message) && /items/.test(thin.message), 'request_approval: a buy request needs store and items');
  const full = await call('muse', 'request_approval', { job_id: cart, action_type: 'buy', details: { store: 'Hy-Vee', items: ['milk', 'eggs'], quantities: [1, 2], est_total: 42.5, cart_url: 'https://example.test/cart' }, risk_level: 'low' });
  check(full.ok && full.data.can_approve.join() === 'myke,family_approver', 'request_approval: a family cart can go to myke or family_approver');
}

// ---- list_pending ----
{
  const p = await call('stevie', 'list_pending');
  check(p.ok && p.data.findings.length === 1 && p.data.tasks.length === 3 && p.data.proposals.length === 2 && p.data.approvals.length === 2,
    'list_pending: shows new findings, proposed tasks, open proposals and pending approvals');
  check(p.data.approvals[0].job_title === 'Email the funder intro' && p.data.approvals[0].details.draft, 'list_pending: approvals carry the job title and details');
}

// ---- review_item ----
{
  const wrong = await call('kova', 'review_item', { type: 'finding', id: findingId, action: 'approve' });
  check(!wrong.ok && /accept, dismiss/.test(wrong.message), 'review_item: a wrong action lists the valid ones');
  const acc = await call('kova', 'review_item', { type: 'finding', id: findingId, action: 'accept', note: 'Good lead.' });
  check(acc.ok && acc.data.status === 'accepted' && acc.data.review_note === 'Good lead.', 'review_item: accepts a finding with a note');
  const twice = await call('kova', 'review_item', { type: 'finding', id: findingId, action: 'dismiss' });
  check(!twice.ok && /is accepted/.test(twice.message), 'review_item: a reviewed finding cannot be reviewed again');

  const early = await call('kova', 'review_item', { type: 'task', id: taskIds.a, action: 'done' });
  check(!early.ok && /needs it to be approved/.test(early.message), 'review_item: a task cannot be done before it is approved');
  await call('kova', 'review_item', { type: 'task', id: taskIds.a, action: 'approve' });
  await call('kova', 'review_item', { type: 'task', id: taskIds.b, action: 'approve' });
  const rej = await call('kova', 'review_item', { type: 'task', id: taskIds.c, action: 'reject', note: 'Not now.' });
  check(rej.ok && rej.data.status === 'rejected', 'review_item: approves and rejects tasks');

  const ok = await call('kova', 'review_item', { type: 'proposal', id: proposalId, action: 'approve' });
  const [section] = await rows(`select body, version from brain.sections where slug = 'consulting-practice'`);
  check(ok.ok && ok.data.section.version === 2 && /Packaged pricing only/.test(section.body), 'review_item: approving a proposal replaces the section and bumps the version');
  await call('kova', 'review_item', { type: 'proposal', id: rejectedProposalId, action: 'reject' });
  const [core] = await rows(`select body, version from brain.sections where slug = 'core-identity'`);
  check(core.version === 1 && /civic tech/.test(core.body), 'review_item: a rejected proposal leaves the section alone');
  const missing = await call('kova', 'review_item', { type: 'task', id: NO_ID, action: 'approve' });
  check(!missing.ok && /No task with id/.test(missing.message), 'review_item: an unknown id is refused');
}

// ---- get_priorities ----
{
  const p = await call('chatgpt', 'get_priorities');
  check(p.ok && p.data.tasks.map((t) => t.title).join('|') === 'Reply to funder|Ship store build', 'get_priorities: approved tasks only, most urgent first');
  await call('kova', 'review_item', { type: 'task', id: taskIds.b, action: 'done' });
  const after = await call('chatgpt', 'get_priorities');
  check(after.data.tasks.length === 1 && after.data.tasks[0].due_date === '2026-12-01', 'get_priorities: done tasks drop off');
}

// ---- record_approval ----
{
  const missing = await call('kova', 'record_approval', { approval_id: NO_ID, approver: 'myke', decision: 'approved' });
  check(!missing.ok && /No approval with id/.test(missing.message), 'record_approval: an unknown id is refused');
  const who = await call('kova', 'record_approval', { approval_id: approvalId, approver: 'kova', decision: 'approved' });
  check(!who.ok && /approver/.test(who.message), 'record_approval: the approver must be a human');
  const denied = await call('kova', 'record_approval', { approval_id: approvalId, approver: 'myke', decision: 'denied' });
  check(denied.ok && denied.data.status === 'denied' && denied.data.approver === 'myke' && denied.data.decided_at, 'record_approval: records a denial with who and when');
  const flip = await call('kova', 'record_approval', { approval_id: approvalId, approver: 'myke', decision: 'approved' });
  check(!flip.ok && /already denied/.test(flip.message), 'record_approval: a decision cannot be changed');
  const blockedDone = await call('grok', 'complete_job', { job_id: sendJob, result: 'Sent', result_links: [] });
  check(!blockedDone.ok && /denied/.test(blockedDone.message), 'complete_job: a denied job cannot complete');
  const retry = await call('grok', 'request_approval', { job_id: sendJob, action_type: 'send', details: { to: 'a funder', draft: 'Shorter note.' }, risk_level: 'low' });
  await call('kova', 'record_approval', { approval_id: retry.data.approval_id, approver: 'myke', decision: 'approved' });
  const done = await call('grok', 'complete_job', { job_id: sendJob, result: 'Draft approved and queued for Myke.', result_links: [] });
  check(retry.ok && done.ok, 'request_approval: a denied job can ask again and complete once approved');
}

// ---- get_pipeline / update_lead ----
{
  const all = await call('stevie', 'get_pipeline');
  const uwazi = await call('stevie', 'get_pipeline', { track: 'uwazi' });
  check(all.ok && all.data.leads.length === 2 && uwazi.data.leads.length === 1 && uwazi.data.leads[0].org === 'Democracy Fund', 'get_pipeline: filters by track');
  const empty = await call('kova', 'update_lead', { lead_id: leadId });
  check(!empty.ok && /Nothing to update/.test(empty.message), 'update_lead: needs at least one change');
  const up = await call('kova', 'update_lead', { lead_id: leadId, stage: 'outreach', fit_score: 9, next_step: 'Send the audit one-pager', next_step_due: '2026-11-18' });
  check(up.ok && up.data.stage === 'outreach' && up.data.fit_score === 9 && up.data.next_step_due === '2026-11-18', 'update_lead: changes only the fields sent');
  const staged = await call('stevie', 'get_pipeline', { stage: 'outreach' });
  check(staged.data.leads.length === 1 && staged.data.leads[0].last_touch_at, 'get_pipeline: filters by stage and shows the last touch');
  const score = await call('kova', 'update_lead', { lead_id: leadId, fit_score: 11 });
  const missing = await call('kova', 'update_lead', { lead_id: NO_ID, stage: 'lost' });
  check(!score.ok && !missing.ok && /No lead with id/.test(missing.message), 'update_lead: a bad score and an unknown lead are refused');
}

// ---- log_decision / search_brain ----
{
  const d = await call('kova', 'log_decision', { decision: 'Move consulting to packaged offers', reasoning: 'Hourly work does not scale past one person.', venture: 'consulting' });
  check(d.ok && d.data.id, 'log_decision: records the decision');
  const s = await call('muse', 'search_brain', { query: 'packaged' });
  const types = s.data.hits.map((h) => `${h.type}:${h.status}`);
  check(s.ok && types.includes('decision:truth') && types.includes('section:truth'), 'search_brain: finds decisions and sections and marks them truth');
  const f = await call('muse', 'search_brain', { query: 'Knight Foundation' });
  check(f.data.hits[0].type === 'finding' && f.data.hits[0].status === 'accepted', 'search_brain: findings carry their review status');
  const l = await call('muse', 'search_brain', { query: 'readiness audit', venture: 'consulting' });
  const none = await call('muse', 'search_brain', { query: 'readiness audit', venture: 'bic' });
  check(l.data.hits.some((h) => h.type === 'lead') && none.data.count === 0, 'search_brain: finds leads and filters by venture');
  const t = await call('muse', 'search_brain', { query: 'store build' });
  check(t.data.hits[0].type === 'task', 'search_brain: finds tasks');
  const blank = await call('muse', 'search_brain', { query: '   ' });
  check(!blank.ok && /query/.test(blank.message), 'search_brain: an empty query is refused');
}

// ---- get_daily_digest / get_pipeline_stats ----
{
  const d = await call('kova', 'get_daily_digest');
  check(d.ok && d.data.done.length === 2 && d.data.blocked.length === 1 && d.data.pending_approvals.length === 1, 'get_daily_digest: done, blocked and pending approvals');
  check(d.data.new_findings.length === 0 && d.data.pipeline_movement.some((m) => m.from_stage === 'signal' && m.to_stage === 'outreach'), 'get_daily_digest: only unreviewed findings, plus pipeline movement');
  const s = await call('kova', 'get_pipeline_stats');
  const total = s.data.by_stage.reduce((n, r) => n + r.leads, 0);
  check(s.ok && total === 2 && s.data.new_leads.length === 2 && s.data.stage_moves[0].moves === 1, 'get_pipeline_stats: counts by stage, new leads and moves this week');
  const old = await call('kova', 'get_pipeline_stats', { week: '2025-01-08' });
  check(old.ok && old.data.week_start === '2025-01-06' && old.data.new_leads.length === 0 && old.data.stage_moves.length === 0, 'get_pipeline_stats: a past week starts on its Monday and is empty');
  const bad = await call('kova', 'get_pipeline_stats', { week: 'last week' });
  check(!bad.ok && /week/.test(bad.message), 'get_pipeline_stats: a bad date is refused');
}

// ---- search / fetch (the pair ChatGPT deep research looks for) ----
{
  const { rpc } = await startBrain().then(async (b) => {
    await b.pg.query(`insert into brain.sections (slug, title, venture, body, position) values ('core-identity', 'CORE IDENTITY', 'personal', 'Myke builds civic tech in Kansas City.', 1)`);
    return b;
  });
  const s = await call('chatgpt', 'search', { query: 'packaged' });
  check(s.ok && s.data.results.length >= 2 && s.data.results.every((r) => r.id && r.title && r.url), 'search: every result has id, title and url');
  const sectionHit = s.data.results.find((r) => r.id === 'section:consulting-practice');
  const f = await call('chatgpt', 'fetch', { id: sectionHit.id });
  check(f.ok && /Packaged pricing only/.test(f.data.text) && f.data.url === 'brain://section/consulting-practice' && f.data.metadata.status === 'truth', 'fetch: returns the full section with its status');
  const decision = s.data.results.find((r) => r.id.startsWith('decision:'));
  const fd = await call('chatgpt', 'fetch', { id: decision.id });
  check(fd.ok && /Reasoning: Hourly work/.test(fd.data.text), 'fetch: returns a decision with its reasoning');
  const finding = (await call('chatgpt', 'search', { query: 'Knight Foundation' })).data.results[0];
  const ff = await call('chatgpt', 'fetch', { id: finding.id });
  check(ff.ok && /Sources: https:\/\/example\.test\/knight/.test(ff.data.text) && ff.data.metadata.status === 'accepted', 'fetch: a finding carries its sources and review status');
  const missing = await call('chatgpt', 'fetch', { id: `task:${NO_ID}` });
  const junk = await call('chatgpt', 'fetch', { id: 'section:x; drop table' });
  const notUuid = await call('chatgpt', 'fetch', { id: 'lead:abc' });
  check(!missing.ok && !junk.ok && !notUuid.ok && /No record with id/.test(notUuid.message), 'fetch: unknown and malformed ids are refused cleanly');
  const raw = await rpc('chatgpt', 'tools/call', { name: 'search', arguments: { query: 'civic' } });
  check(raw.result.structuredContent?.results?.length === 1 && raw.result.content[0].type === 'text', 'search: results come back as structured content and as text');
}
