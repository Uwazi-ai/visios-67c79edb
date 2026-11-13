// End-to-end smoke test: auth, discovery, the MCP handshake and one full job
// from creation to approved completion. The per-tool suite is in tools.test.mjs.
import { reporter } from './helpers.mjs';
import { startBrain } from './harness.mjs';

const { check } = reporter();
const { pg, http, rpc, call } = await startBrain();

// auth and discovery
let res = await http('POST', '', { body: {} });
check(res.status === 401 && /resource_metadata="https:\/\/example\.test\/functions\/v1\/brain-mcp\/\.well-known\/oauth-protected-resource"/.test(res.headers.get('WWW-Authenticate') ?? ''),
  'no token gets 401 with a resource metadata pointer');
res = await http('POST', '', { token: 'not-a-real-token', body: {} });
check(res.status === 401, 'bad token gets 401');
res = await http('POST', '', { token: 'token-stranger', body: {} });
check(res.status === 403, 'signed-in account that is not an agent gets 403');
res = await http('GET', '/.well-known/oauth-protected-resource');
const meta = await res.json();
check(res.status === 200 && meta.authorization_servers[0] === 'https://example.test/auth/v1' && meta.resource.endsWith('/brain-mcp'),
  'protected resource metadata names the authorization server');
res = await http('GET', '/.well-known/oauth-authorization-server');
check(res.status === 200 && (await res.json()).issuer === 'https://example.test/auth/v1', 'authorization server metadata is passed through');
res = await http('GET');
check(res.status === 405, 'GET on the MCP endpoint is refused');

// handshake
const init = await rpc('grok', 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
check(init.result.protocolVersion === '2025-06-18' && init.result.serverInfo.name === 'brain-mcp' && /signed in as grok/.test(init.result.instructions),
  'initialize negotiates the version and names the caller');
res = await http('POST', '', { token: 'token-grok', body: { jsonrpc: '2.0', method: 'notifications/initialized' } });
check(res.status === 202, 'notifications get 202 with no body');
const grokTools = (await rpc('grok', 'tools/list')).result.tools;
const kovaTools = (await rpc('kova', 'tools/list')).result.tools;
check(grokTools.length === 16 && kovaTools.length === 23, `tools/list shows 16 tools to agents and 23 to kova (got ${grokTools.length}, ${kovaTools.length})`);
check(kovaTools.every((t) => t.inputSchema.type === 'object' && t.description.length > 40), 'every tool has a schema and a description');
check(grokTools.filter((t) => t.annotations.readOnlyHint).length === 8, 'the eight read tools are marked read-only');
check(!JSON.stringify(kovaTools).includes('—'), 'no em dashes in tool text');
const unknown = await rpc('grok', 'resources/list');
check(unknown.error?.code === -32601, 'unsupported methods return a JSON-RPC error');

// reads
await pg.query(`insert into brain.sections (slug, title, venture, body, position) values ('core-identity', 'CORE IDENTITY', 'personal', 'Myke builds civic tech in Kansas City.', 1)`);
const toc = await call('chatgpt', 'get_ontology');
check(toc.ok && toc.data.sections[0].slug === 'core-identity', 'get_ontology returns the table of contents');
const section = await call('chatgpt', 'get_ontology', { section_slug: 'core-identity' });
check(section.ok && section.data.body.includes('civic tech'), 'get_ontology returns one section');
const hits = await call('chatgpt', 'search_brain', { query: 'civic' });
check(hits.ok && hits.data.hits[0].type === 'section' && hits.data.hits[0].status === 'truth', 'search_brain finds it and labels it truth');

// one job, start to finish
const denied = await call('grok', 'create_job', { title: 'x', instructions: 'y', venture: 'uwazi', domain: 'content', assigned_to: 'grok' });
check(!denied.ok && /admin tool/.test(denied.message), 'a non-admin cannot create a job');
const job = await call('kova', 'create_job', {
  title: 'Draft a LinkedIn post on Civic Compass', instructions: 'Write one draft post. Do not post it.',
  venture: 'uwazi', domain: 'social', assigned_to: 'grok', action_type: 'post_draft', priority: 1,
});
check(job.ok && job.data.status === 'queued', 'kova creates a job');
const id = job.data.id;
const mine = await call('grok', 'get_my_jobs');
check(mine.ok && mine.data.jobs.length === 1 && mine.data.jobs[0].id === id, 'the assignee sees the job');
check(!(await call('stevie', 'claim_job', { job_id: id })).ok, 'another agent cannot claim it');
check((await call('grok', 'claim_job', { job_id: id })).ok, 'the assignee claims it');
const early = await call('grok', 'complete_job', { job_id: id, result: 'Draft ready', result_links: [] });
check(!early.ok && /request_approval/.test(early.message), 'completion is refused before approval, with the next step named');
const ask = await call('grok', 'request_approval', { job_id: id, action_type: 'post_draft', details: { draft: 'Find your civic persona.' }, risk_level: 'low' });
check(ask.ok && ask.data.can_approve.join() === 'myke', 'approval is requested and names who can approve');
const pending = await call('kova', 'list_pending');
check(pending.ok && pending.data.approvals.length === 1, 'the request shows up in list_pending');
const decide = await call('kova', 'record_approval', { approval_id: ask.data.approval_id, approver: 'myke', decision: 'approved' });
check(decide.ok && decide.data.status === 'approved', 'kova records the approval');
const done = await call('grok', 'complete_job', { job_id: id, result: 'Draft ready for Myke', result_links: ['https://example.test/draft'] });
check(done.ok && done.data.status === 'done', 'the job completes after approval');

// pipeline and admin reads
const lead = await call('grok', 'log_lead', { track: 'consulting', org: 'Acme', contact_role: 'CTO', source_url: 'https://example.test/post', signal: 'Asked for an AI readiness audit.' });
const dup = await call('grok', 'log_lead', { track: 'consulting', org: 'ACME', contact_role: 'CTO', source_url: 'https://example.test/post', signal: 'again' });
check(lead.ok && dup.ok && dup.data.duplicate === true && dup.data.id === lead.data.id, 'a repeated lead returns the existing one');
const moved = await call('kova', 'update_lead', { lead_id: lead.data.id, stage: 'qualified', fit_score: 8 });
check(moved.ok && moved.data.stage === 'qualified', 'kova moves a lead');
const digest = await call('kova', 'get_daily_digest');
check(digest.ok && digest.data.done.length === 1 && digest.data.pipeline_movement.length === 2, 'the daily digest reports the finished job and the pipeline movement');
const stats = await call('kova', 'get_pipeline_stats');
check(stats.ok && stats.data.by_stage[0].leads === 1 && stats.data.stage_moves[0].to_stage === 'qualified', 'pipeline stats count stages and moves');

// errors an AI can act on
const bad = await call('grok', 'log_finding', { title: 'T', body: 'B', venture: 'nope', extra: 1 });
check(!bad.ok && /venture/.test(bad.message) && /source_urls/.test(bad.message) && /extra/.test(bad.message), 'validation errors name every bad field');

// audit
const log = (await pg.query(`select agent, tool, result_status, is_write from brain.activity order by id`)).rows;
check(log.length > 15 && log.some((r) => r.result_status === 'rejected') && log.every((r) => r.agent), `every call is in the activity log (${log.length} rows)`);
