import { freshDb, reporter } from './helpers.mjs';

const db = await freshDb();
const { ok, check, expectErr } = reporter();

const job = async (cols, vals) =>
  (await db.query(`insert into brain.jobs(title,instructions,venture,domain,assigned_to,${cols}) values('t','i','myke-labs','content','grok',${vals}) returning id`)).rows[0].id;

// A gated job cannot reach done by skipping needs_approval.
const post = await job('action_type,status', `'post_draft','claimed'`);
await expectErr(db, `update brain.jobs set status='done' where id='${post}'`, 'post_draft job cannot complete without approval');

// Bouncing through needs_approval and back does not help either.
await db.exec(`update brain.jobs set status='needs_approval' where id='${post}'`);
await db.exec(`update brain.jobs set status='claimed' where id='${post}'`);
await expectErr(db, `update brain.jobs set status='done' where id='${post}'`, 'gate holds after leaving needs_approval');

// A gated job cannot be inserted already done.
await expectErr(db, `insert into brain.jobs(title,instructions,venture,domain,assigned_to,action_type,status) values('t','i','uwazi','content','grok','send','done')`, 'gated job cannot be created as done');

// An approval must match the job's action type.
await expectErr(db, `insert into brain.approvals(job_id,action_type,requested_by,approver,status) values('${post}','other','grok','myke','approved')`, 'mismatched approval type rejected');

// A pending request does not open the gate; an approved matching one does.
const appr = (await db.query(`insert into brain.approvals(job_id,action_type,requested_by) values('${post}','post_draft','grok') returning id`)).rows[0].id;
await expectErr(db, `update brain.jobs set status='done' where id='${post}'`, 'pending approval does not open the gate');
await db.exec(`update brain.approvals set status='approved', approver='myke' where id='${appr}'`);
await db.exec(`update brain.jobs set status='done' where id='${post}'`);
ok('matching approved request opens the gate');

// Decided approvals are locked.
await expectErr(db, `update brain.approvals set status='denied' where id='${appr}'`, 'decided approval cannot change');

// A job's action type is fixed at creation.
const sendJob = await job('action_type', `'send'`);
await expectErr(db, `update brain.jobs set action_type='other' where id='${sendJob}'`, 'action_type cannot change');

// A denied request keeps the gate shut.
const denied = (await db.query(`insert into brain.approvals(job_id,action_type,requested_by) values('${sendJob}','send','grok') returning id`)).rows[0].id;
await db.exec(`update brain.approvals set status='denied', approver='myke' where id='${denied}'`);
await expectErr(db, `update brain.jobs set status='done' where id='${sendJob}'`, 'denied approval keeps the gate shut');

// Ungated work completes freely.
const research = await job('action_type', `'other'`);
await db.exec(`update brain.jobs set status='done' where id='${research}'`);
const plain = await job('status', `'claimed'`);
await db.exec(`update brain.jobs set status='done' where id='${plain}'`);
ok('ungated jobs complete without approval');

// Review notes and the write flag exist.
await db.exec(`insert into brain.findings(title,body,venture,submitted_by) values('f','b','uwazi','grok')`);
await db.exec(`update brain.findings set status='dismissed', review_note='duplicate', reviewed_at=now()`);
ok('review note stored on a finding');
await db.exec(`insert into brain.activity(agent,tool,result_status,is_write) values('grok','log_finding','ok',true),('grok','get_ontology','ok',false)`);
const writes = (await db.query(`select count(*)::int c from brain.activity where agent='grok' and is_write and created_at > now() - interval '1 hour'`)).rows[0].c;
check(writes === 1, 'rate limit counts writes only');
