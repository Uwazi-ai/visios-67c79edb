// Access rules and server-side guardrails. Covers the five cases the build
// brief requires, then each guardrail with a near-miss that must still pass.
import { reporter } from './helpers.mjs';
import { startBrain } from './harness.mjs';

const { check } = reporter();
const { pg, http, rpc, call } = await startBrain();
const count = async (table) => (await pg.query(`select count(*)::int c from brain.${table}`)).rows[0].c;
const MONEY = 'Financials are handled by Myke manually.';
const ID = '11111111-1111-4111-8111-111111111111';

const job = (extra = {}) => ({
  title: 'Research five funders', instructions: 'List five funders with links.',
  venture: 'uwazi', domain: 'funding', assigned_to: 'grok', ...extra,
});
const mkJob = async (extra) => (await call('kova', 'create_job', job(extra))).data.id;

// ---- required: grok, chatgpt, muse, stevie are rejected from every admin tool ----
{
  const ADMIN = {
    create_job: job(),
    review_item: { type: 'task', id: ID, action: 'approve' },
    record_approval: { approval_id: ID, approver: 'myke', decision: 'approved' },
    update_lead: { lead_id: ID, stage: 'lost' },
    log_decision: { decision: 'd', reasoning: 'r', venture: 'uwazi' },
    get_daily_digest: {},
    get_pipeline_stats: {},
  };
  for (const agent of ['grok', 'chatgpt', 'muse', 'stevie']) {
    const results = [];
    for (const [tool, args] of Object.entries(ADMIN)) results.push([tool, await call(agent, tool, args)]);
    const leaked = results.filter(([, r]) => r.ok || !/admin tool\. Only kova/.test(r.message)).map(([t]) => t);
    check(leaked.length === 0, `${agent} is rejected from all ${results.length} admin tools${leaked.length ? ` (leaked: ${leaked})` : ''}`);
    const listed = (await rpc(agent, 'tools/list')).result.tools.map((t) => t.name);
    check(Object.keys(ADMIN).every((t) => !listed.includes(t)), `${agent} is not shown the admin tools`);
  }
  check((await count('jobs')) === 0 && (await count('decisions')) === 0, 'the rejected admin calls wrote nothing');
  const empty = await call('grok', 'create_job', {});
  check(!empty.ok && /admin tool/.test(empty.message), 'the admin check runs before argument validation');
  const rejected = (await pg.query(`select count(*)::int c from brain.activity where result_status = 'rejected' and agent <> 'kova'`)).rows[0].c;
  check(rejected === 29, `every rejected admin call is in the audit log (${rejected})`);
}

// ---- required: a financial job is rejected ----
{
  const cases = [
    ['Send the invoice to the client', 'Attach the PDF.'],
    ['Venue booking', 'Process the payment for the venue deposit.'],
    ['Vendor setup', 'Transfer funds to the vendor.'],
    ['Site update', 'Rewrite the pricing page.'],
    ['Store launch', 'Set up Stripe checkout for the store.'],
    ['Catering', 'Pay the caterer on Friday.'],
    ['Accounts', 'Log in to online banking and download statements.'],
    ['Cleanup', 'Issue a refund to the attendee.'],
  ];
  const wrong = [];
  for (const [title, instructions] of cases) {
    const r = await call('kova', 'create_job', job({ title, instructions }));
    if (r.ok || r.message !== MONEY) wrong.push(title);
  }
  check(wrong.length === 0, `a financial job is rejected with the fixed message, ${cases.length} phrasings${wrong.length ? ` (missed: ${wrong})` : ''}`);
  check((await count('jobs')) === 0, 'no financial job was stored');

  const fine = [
    ['Volunteer day', 'Coordinate the shift at the food bank.'],
    ['Tone pass', 'Pay attention to the voice rules in the ontology.'],
    ['Handoff', 'Run a knowledge transfer session with the parish team.'],
    ['Funder scan', 'Find grants that fund civic education.'],
  ];
  const blocked = [];
  for (const [title, instructions] of fine) {
    if (!(await call('kova', 'create_job', job({ title, instructions }))).ok) blocked.push(title);
  }
  check(blocked.length === 0, `ordinary jobs with money-adjacent words still pass${blocked.length ? ` (blocked: ${blocked})` : ''}`);
}

// ---- required: a post_draft job cannot complete without approval ----
let postJob;
{
  postJob = await mkJob({ title: 'Draft a LinkedIn post', instructions: 'One draft about Civic Compass.', domain: 'social', action_type: 'post_draft' });
  await call('grok', 'claim_job', { job_id: postJob });
  const none = await call('grok', 'complete_job', { job_id: postJob, result: 'Draft ready.', result_links: [] });
  check(!none.ok && /needs approval/.test(none.message), 'a post_draft job cannot complete with no approval request');
  const ask = await call('grok', 'request_approval', { job_id: postJob, action_type: 'post_draft', details: { draft: 'Find your civic persona.' }, risk_level: 'low' });
  const pending = await call('grok', 'complete_job', { job_id: postJob, result: 'Draft ready.', result_links: [] });
  check(!pending.ok && /pending/.test(pending.message), 'a post_draft job cannot complete while approval is pending');
  const self = await call('grok', 'record_approval', { approval_id: ask.data.approval_id, approver: 'myke', decision: 'approved' });
  check(!self.ok, 'the agent cannot approve its own request');
  const status = (await pg.query('select status from brain.jobs where id = $1', [postJob])).rows[0].status;
  check(status === 'needs_approval', 'the job is still waiting');
  await call('kova', 'record_approval', { approval_id: ask.data.approval_id, approver: 'myke', decision: 'approved' });
  const done = await call('grok', 'complete_job', { job_id: postJob, result: 'Draft ready.', result_links: [] });
  check(done.ok, 'it completes once myke approves');
  // The database refuses too, even if the tool layer were bypassed.
  const raw = await mkJob({ title: 'Draft a thread', instructions: 'One draft thread.', domain: 'social', action_type: 'post_draft' });
  let dbRefused = false;
  try { await pg.query(`update brain.jobs set status = 'done' where id = $1`, [raw]); } catch { dbRefused = true; }
  check(dbRefused, 'the database also refuses to complete it without approval');
}

// ---- required: family_approver cannot approve a non-family item ----
{
  const biz = await mkJob({ title: 'Email the board update', instructions: 'Draft the update.', domain: 'clients', action_type: 'send', assigned_to: 'stevie' });
  await call('stevie', 'claim_job', { job_id: biz });
  const ask = await call('stevie', 'request_approval', { job_id: biz, action_type: 'send', details: { draft: 'Board update.' }, risk_level: 'medium' });
  const no = await call('kova', 'record_approval', { approval_id: ask.data.approval_id, approver: 'family_approver', decision: 'approved' });
  check(!no.ok && /family-domain/.test(no.message) && /needs Myke/.test(no.message), 'family_approver cannot approve a non-family item');
  const deny = await call('kova', 'record_approval', { approval_id: ask.data.approval_id, approver: 'family_approver', decision: 'denied' });
  check(!deny.ok, 'family_approver cannot deny a non-family item either');
  const still = (await pg.query('select status, approver from brain.approvals where id = $1', [ask.data.approval_id])).rows[0];
  check(still.status === 'pending' && still.approver === null, 'the approval is still pending');

  const cart = await mkJob({ title: 'Weekly grocery cart', instructions: 'Build the cart for review.', venture: 'household', domain: 'family', assigned_to: 'muse', action_type: 'buy' });
  await call('muse', 'claim_job', { job_id: cart });
  const cartAsk = await call('muse', 'request_approval', { job_id: cart, action_type: 'buy', details: { store: 'Hy-Vee', items: ['milk'], est_total: 12 }, risk_level: 'low' });
  const yes = await call('kova', 'record_approval', { approval_id: cartAsk.data.approval_id, approver: 'family_approver', decision: 'approved' });
  check(yes.ok && yes.data.approver === 'family_approver', 'family_approver can approve a family cart');

  // money rule on carts: est_total is allowed, a finished purchase is not
  const claim = await call('muse', 'complete_job', { job_id: cart, result: 'Order placed and paid.', result_links: [] });
  check(!claim.ok && claim.message.startsWith(MONEY), 'no tool can mark a purchase complete');
  const ok = await call('muse', 'complete_job', { job_id: cart, result: 'Cart is ready for review at Hy-Vee.', result_links: ['https://example.test/cart'] });
  check(ok.ok, 'a buy job completes as a cart for review');
}

// ---- required: a job targeting an RPS Office account is blocked ----
{
  const before = await count('jobs');
  const byVenture = await call('kova', 'create_job', job({ title: 'Draft a recap post', instructions: 'One post about the roundtable.', venture: 'rps-office', domain: 'social', action_type: 'post_draft' }));
  check(!byVenture.ok && /RPS Office/.test(byVenture.message), 'a social job for the RPS Office venture is blocked');
  const byText = await call('kova', 'create_job', job({ title: 'Reply to comments', instructions: 'Draft replies on the Mayor Pro Tem Instagram account.', domain: 'social', action_type: 'reply_batch' }));
  check(!byText.ok && /RPS Office/.test(byText.message), 'a job that names an RPS Office account is blocked');
  const byAction = await call('kova', 'create_job', job({ title: 'Recap post', instructions: 'Draft a post for the City of KC page.', venture: 'rps-office', domain: 'content', action_type: 'post_draft' }));
  check(!byAction.ok, 'a post_draft job for the office is blocked outside the social domain too');
  check((await count('jobs')) === before, 'no blocked job was stored');
  const allowed = await call('kova', 'create_job', job({ title: 'Roundtable one-pager', instructions: 'Draft the From Feedback to Action one-pager.', venture: 'rps-office', domain: 'content', assigned_to: 'stevie' }));
  check(allowed.ok, 'non-social RPS Office content is allowed with venture rps-office');
}

// ---- social: drafts only ----
{
  const send = await call('kova', 'create_job', job({ title: 'Post it', instructions: 'Share the update.', domain: 'social', action_type: 'send' }));
  const live = await call('kova', 'create_job', job({ title: 'Launch post', instructions: 'Publish the post to LinkedIn at 9am.', domain: 'social', action_type: 'post_draft' }));
  check(!send.ok && !live.ok && /drafts only/.test(live.message), 'social jobs that send or publish are refused');
  const scout = await call('kova', 'create_job', job({ title: 'Scout funder posts', instructions: 'Find three posts from funders this week.', domain: 'social' }));
  check(scout.ok, 'social scouting with no outside action is allowed');
}

// ---- exclusions: journal and the campaign stay out ----
{
  const before = await count('findings');
  const finding = (body, extra = {}) => ({ title: 'Note', body, source_urls: [], venture: 'personal', ...extra });
  const campaign = await call('grok', 'log_finding', finding('A new poll in the Ryana for Mayor race.'));
  check(!campaign.ok && /campaign content stays out/.test(campaign.message), 'campaign content is refused');
  const tagged = await call('grok', 'log_finding', finding('Volunteer signups are up.', { title: 'R4M field update' }));
  const venture = await call('grok', 'log_finding', finding('x', { venture: 'ryana-campaign' }));
  check(!tagged.ok && !venture.ok && /venture/.test(venture.message), 'campaign tags and a campaign venture are refused');
  const journal = await call('stevie', 'log_finding', finding('Journal entry: today I felt behind.'));
  const hash = await call('stevie', 'propose_task', { title: 'Reflect #journal', details: 'Write about the week.', venture: 'personal', priority: 3 });
  check(!journal.ok && !hash.ok && /Journal content stays out/.test(journal.message), 'journal content is refused');
  check((await count('findings')) === before && (await count('tasks')) === 0, 'nothing excluded was stored');
  const press = await call('grok', 'log_finding', finding('Two local journalists asked about the Uwazi email campaign.', { venture: 'uwazi' }));
  check(press.ok, 'the words journalists and campaign alone do not trip the exclusion');
  const read = await call('grok', 'search_brain', { query: 'Ryana for Mayor' });
  check(read.ok && read.data.count === 0, 'reads are not screened, and find nothing');
}

// ---- minors: first names and logistics only ----
{
  const fam = (title, instructions, extra = {}) => call('kova', 'create_job', job({ title, instructions, venture: 'household', domain: 'family', assigned_to: 'muse', ...extra }));
  const school = await fam('School check', "Pull Sam's report card and summarize it.");
  const health = await fam('Appointments', 'Track the allergy medication refills.');
  const where = await fam('Pickup', 'Use location history to see where he was after school.');
  check(!school.ok && !health.ok && !where.ok && /first names and logistics only/.test(school.message), 'family jobs about school records, health or location history are refused');
  const elsewhere = await call('kova', 'create_job', job({ title: 'Calendar', instructions: "Add Sam's doctor visit to the calendar.", domain: 'day-to-day', assigned_to: 'stevie' }));
  check(!elsewhere.ok, 'the rule follows Sam outside the family domain');
  const ride = await fam('Thursday pickup', 'Pick up Sam from practice at 5pm and plan dinner.');
  check(ride.ok, 'first names and logistics are allowed');
  await call('muse', 'claim_job', { job_id: ride.data.id });
  const keys = await call('muse', 'request_approval', { job_id: ride.data.id, action_type: 'other', details: { child: 'Sam', last_name: 'X', school_name: 'Y' }, risk_level: 'low' });
  check(!keys.ok && /first names and logistics only/.test(keys.message), 'approval details cannot carry last name or school fields');
}

// ---- money rule on approvals ----
{
  const id = await mkJob({ title: 'Book the studio', instructions: 'Hold a two hour slot for the podcast.', domain: 'content', action_type: 'book', assigned_to: 'stevie' });
  await call('stevie', 'claim_job', { job_id: id });
  const pay = await call('stevie', 'request_approval', { job_id: id, action_type: 'book', details: { slot: 'Friday 2pm', note: 'Payment due at booking.' }, risk_level: 'medium' });
  const card = await call('stevie', 'request_approval', { job_id: id, action_type: 'book', details: { slot: 'Friday 2pm', card_number: 'on file' }, risk_level: 'medium' });
  check(!pay.ok && pay.message === MONEY && !card.ok && card.message === MONEY, 'approval requests about payment are refused');
  const ok = await call('stevie', 'request_approval', { job_id: id, action_type: 'book', details: { slot: 'Friday 2pm', place: 'Studio B' }, risk_level: 'low' });
  check(ok.ok, 'a plain booking request goes through');
}

// ---- audit log ----
{
  const row = (await pg.query(`select args_summary from brain.activity where tool = 'request_approval' and result_status = 'ok' order by id desc limit 1`)).rows[0];
  check(/slot,place/.test(row.args_summary) && !/Studio B/.test(row.args_summary), 'the audit log keeps detail keys, not detail values');
  const long = await call('grok', 'log_finding', { title: 'Long', body: 'x'.repeat(5000), source_urls: [], venture: 'uwazi' });
  const size = (await pg.query(`select length(args_summary) n from brain.activity order by id desc limit 1`)).rows[0].n;
  check(long.ok && size < 600, 'long arguments are clipped in the audit log');
  let locked = false;
  try { await pg.query('delete from brain.activity'); } catch { locked = true; }
  check(locked, 'the audit log cannot be edited');
  const ghost = await call('grok', 'drop_everything', {});
  const logged = (await pg.query(`select result_status from brain.activity where tool = 'drop_everything'`)).rows[0];
  check(!ghost.ok && logged?.result_status === 'rejected', 'unknown tools are refused and logged');
}

// ---- transport details ----
{
  const res = await http('POST', '', { token: 'token-grok', body: [
    { jsonrpc: '2.0', id: 1, method: 'ping' },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_priorities', arguments: {} } },
  ] });
  const replies = await res.json();
  check(replies.length === 2 && replies[1].result.isError === false, 'a JSON-RPC batch gets one reply per request');
  const garbage = await http('POST', '', { token: 'token-grok', body: undefined });
  check(garbage.status === 400, 'a body that is not JSON gets a parse error');
}

// ---- rate limit: 60 writes per hour per agent ----
{
  const fresh = await startBrain();
  let okCount = 0;
  for (let i = 0; i < 60; i++) {
    const r = await fresh.call('grok', 'log_finding', { title: `Finding ${i}`, body: 'b', source_urls: [], venture: 'uwazi' });
    if (r.ok) okCount++;
  }
  const over = await fresh.call('grok', 'log_finding', { title: 'One too many', body: 'b', source_urls: [], venture: 'uwazi' });
  check(okCount === 60 && !over.ok && /Rate limit reached: 60 writes per hour/.test(over.message), 'the 61st write in an hour is refused');
  const stored = (await fresh.pg.query('select count(*)::int c from brain.findings')).rows[0].c;
  check(stored === 60, 'the refused write was not stored');
  check((await fresh.call('grok', 'get_priorities')).ok, 'reads still work at the limit');
  check((await fresh.call('muse', 'log_finding', { title: 'Mine', body: 'b', source_urls: [], venture: 'household' })).ok, 'the limit is per agent');
  await fresh.pg.exec(`alter table brain.activity disable trigger activity_append_only;
    update brain.activity set created_at = now() - interval '61 minutes' where agent = 'grok';
    alter table brain.activity enable trigger activity_append_only;`);
  check((await fresh.call('grok', 'log_finding', { title: 'Later', body: 'b', source_urls: [], venture: 'uwazi' })).ok, 'writes resume once the hour has passed');
}
