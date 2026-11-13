-- Myke OS shared brain: guardrail fixes found in the Phase 1 review.
-- 1. The approval gate now follows the job's action type, not only the
--    needs_approval -> done transition, so it cannot be skipped.
-- 2. An approval only unlocks a job when its action type matches.
-- 3. Decided approvals are immutable.
-- 4. Review notes for findings, tasks and proposals.
-- 5. Activity rows are flagged as writes so rate limits can count them.

-- jobs: the action the job ends in, set by kova at creation ----------------
alter table brain.jobs add column action_type text
  check (action_type in ('send','post_draft','reply_batch','book','buy','deploy','other'));

create or replace function brain.gated_action(a text) returns boolean
language sql immutable as $$
  select a in ('send','post_draft','reply_batch','book','buy','deploy')
$$;

create or replace function brain.check_job_gate() returns trigger
language plpgsql as $$
declare
  completing boolean;
  needs_gate boolean;
begin
  if tg_op = 'UPDATE' then
    if new.action_type is distinct from old.action_type then
      raise exception 'job action_type cannot change after creation';
    end if;
    completing := new.status = 'done' and old.status <> 'done';
    needs_gate := coalesce(brain.gated_action(new.action_type), false)
                  or old.status = 'needs_approval';
  else
    completing := new.status = 'done';
    needs_gate := coalesce(brain.gated_action(new.action_type), false);
  end if;

  if completing and needs_gate then
    if not exists (
      select 1 from brain.approvals a
      where a.job_id = new.id
        and a.status = 'approved'
        and (new.action_type is null or a.action_type = new.action_type)
    ) then
      raise exception 'job % needs an approved request before it can complete', new.id;
    end if;
  end if;
  return new;
end $$;

drop trigger jobs_gate on brain.jobs;
create trigger jobs_gate before insert or update on brain.jobs
  for each row execute function brain.check_job_gate();

-- approvals: must match the job's action type, and lock once decided --------
create or replace function brain.check_approver_scope() returns trigger
language plpgsql as $$
declare
  job_domain text;
  job_action text;
begin
  select domain, action_type into job_domain, job_action
    from brain.jobs where id = new.job_id;

  if job_action is not null and new.action_type <> job_action then
    raise exception 'approval action_type % does not match the job action_type %',
      new.action_type, job_action;
  end if;
  if new.approver = 'family_approver' and job_domain is distinct from 'family' then
    raise exception 'family_approver can only approve family-domain items';
  end if;
  if new.status <> 'pending' and new.approver is null then
    raise exception 'a decided approval needs a human approver';
  end if;
  if new.status <> 'pending' and new.decided_at is null then
    new.decided_at := now();
  end if;
  return new;
end $$;

create or replace function brain.lock_decided_approvals() returns trigger
language plpgsql as $$
begin
  if old.status <> 'pending' then
    raise exception 'approval % is already decided and cannot change', old.id;
  end if;
  return new;
end $$;
create trigger approvals_lock before update on brain.approvals
  for each row execute function brain.lock_decided_approvals();

-- review notes ------------------------------------------------------------
alter table brain.findings  add column review_note text, add column reviewed_at timestamptz;
alter table brain.tasks     add column review_note text, add column reviewed_at timestamptz;
alter table brain.proposals add column review_note text, add column reviewed_at timestamptz;

-- activity: mark writes for the per-agent hourly rate limit -----------------
alter table brain.activity add column is_write boolean not null default false;
create index activity_writes on brain.activity (agent, created_at desc) where is_write;
