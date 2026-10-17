-- One row the worker updates after every IMAP poll, so the API can show "Correo conectado".
create table worker_heartbeat (
  id               int primary key default 1 check (id = 1),
  email_checked_at timestamptz,
  email_ok         boolean
);
alter table worker_heartbeat enable row level security;
revoke all on worker_heartbeat from anon, authenticated;
