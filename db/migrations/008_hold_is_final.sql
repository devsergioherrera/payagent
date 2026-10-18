-- Frenar (HOLD) is final: only ESCALATE waits for a human.
alter table decision drop constraint if exists decision_check;
update decision d set status = 'FINAL'
 where d.outcome = 'HOLD' and d.status = 'PENDING_HUMAN'
   and not exists (select 1 from approval a where a.decision_id = d.id);

alter table decision add constraint decision_outcome_status_check check (
     (outcome = 'ESCALATE' and status in ('PENDING_HUMAN', 'RESOLVED'))
  or (outcome in ('PAY', 'HOLD') and status = 'FINAL')
  or (outcome = 'HOLD' and status = 'RESOLVED')  -- only keeps old resolved rows valid
);
