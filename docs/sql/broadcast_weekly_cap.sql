-- docs/sql/broadcast_weekly_cap.sql — 8 Nov 2026
-- One mail per person per 7 days across every list (owner, 8 Nov 2026).
-- A broadcast now records such a person as skipped with skip_reason = 'recently_mailed'
-- ⇒ src/lib/broadcast/enqueue.ts. The old check only allowed three reasons, and the
-- Stop button already writes 'cancelled', which that check never listed either.
--
-- ⚠️ RUN THIS ON THE LIVE DATABASE BEFORE THE CODE IS DEPLOYED — otherwise a broadcast
-- with anyone mailed this week fails to queue. Safe to run twice.

do $$
declare c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'broadcast_sends'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%skip_reason%'
  loop
    execute format('alter table broadcast_sends drop constraint %I', c);
  end loop;
end $$;

alter table broadcast_sends
  add constraint broadcast_sends_skip_reason_check
  check (skip_reason in ('unsubscribed', 'hard_bounce', 'complaint', 'cancelled', 'recently_mailed'));

-- Check: should list the five reasons.
select pg_get_constraintdef(oid) from pg_constraint where conname = 'broadcast_sends_skip_reason_check';
