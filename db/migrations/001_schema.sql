-- FacturaYa payments agent. Postgres (Supabase). See docs/ROADMAP.md.
begin;

-- Master data -----------------------------------------------------------------

create table vendor (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  tax_id        text not null unique,
  country       text not null check (country in ('CO', 'MX', 'BR', 'US')),
  currency      text not null,
  bank_rail     text not null check (bank_rail in ('ACH', 'WIRE', 'BRE_B', 'SPEI', 'PIX')),
  bank_account  text not null,
  status        text not null default 'ALLOWED' check (status in ('ALLOWED', 'BLOCKED')),
  created_at    timestamptz not null default now()
);

create table purchase_order (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references vendor(id),
  po_number      text not null unique,
  amount         numeric(14, 2) not null check (amount > 0),
  currency       text not null,
  tolerance_pct  numeric(5, 2) not null default 5,
  description    text,
  status         text not null default 'OPEN' check (status in ('OPEN', 'CLOSED'))
);

create table budget (
  period      date primary key check (extract(day from period) = 1),
  amount_usd  numeric(14, 2) not null check (amount_usd >= 0)
);

create table fx_rate (
  currency     text primary key,
  rate_to_usd  numeric(18, 8) not null check (rate_to_usd > 0),
  as_of        date not null
);

-- Operations (unit of cost and of idempotent jobs) ------------------------------

create table operation (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('PROCESS_INVOICE', 'PROPOSE_RULES', 'CHAT', 'RULE_DRAFT')),
  status       text not null default 'RUNNING' check (status in ('RUNNING', 'DONE', 'FAILED')),
  invoice_id   uuid,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  error        text
);
-- Only one "Proponer reglas" run at a time.
create unique index operation_one_running_proposal
  on operation (type) where type = 'PROPOSE_RULES' and status = 'RUNNING';

create table llm_usage (
  id             uuid primary key default gen_random_uuid(),
  operation_id   uuid not null references operation(id),
  purpose        text not null check (purpose in ('EXTRACT', 'EXPLAIN', 'DRAFT_RULE', 'PROPOSE_RULES', 'CHAT')),
  model          text not null,
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  cost_usd       numeric(12, 6) not null default 0,
  latency_ms     int not null default 0,
  created_at     timestamptz not null default now()
);

-- Invoices and decisions ----------------------------------------------------------

create table invoice (
  id                uuid primary key default gen_random_uuid(),
  file_sha256       text not null unique,
  source            text not null check (source in ('EMAIL', 'UPLOAD', 'TEXT', 'CHAT', 'INBOX', 'SEED')),
  source_ref        text not null,
  file_path         text,
  content_type      text,
  email_message_id  text,
  email_sender      text,
  email_subject     text,
  status            text not null default 'RECEIVED'
                    check (status in ('RECEIVED', 'EXTRACTING', 'EVALUATING', 'DECIDED', 'FAILED')),
  vendor_id         uuid references vendor(id),
  vendor_name_raw   text,
  vendor_tax_id     text,
  invoice_number    text,
  po_number         text,
  bank_account      text,
  amount            numeric(14, 2),
  currency          text,
  fx_rate           numeric(18, 8),
  amount_usd        numeric(14, 2),
  issue_date        date,
  due_date          date,
  confidence        numeric(3, 2) check (confidence between 0 and 1),
  error             text,
  received_at       timestamptz not null default now()
);
create index invoice_vendor_idx on invoice (vendor_id, invoice_number);

alter table operation add constraint operation_invoice_fk foreign key (invoice_id) references invoice(id);

create table decision (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null unique references invoice(id),
  operation_id  uuid references operation(id),
  outcome       text not null check (outcome in ('PAY', 'HOLD', 'ESCALATE')),
  status        text not null check (status in ('FINAL', 'PENDING_HUMAN', 'RESOLVED')),
  explanation   text not null,
  explained_by  text not null check (explained_by in ('LLM', 'TEMPLATE')),
  decided_at    timestamptz not null default now(),
  -- PAY is final by definition; HOLD and ESCALATE wait for a human.
  check ((outcome = 'PAY') = (status = 'FINAL'))
);

create table notification (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid references invoice(id),
  kind        text not null check (kind in ('ESCALATION', 'REPLY')),
  recipient   text not null,
  status      text not null check (status in ('SENT', 'FAILED')),
  error       text,
  created_at  timestamptz not null default now()
);

-- Rules -------------------------------------------------------------------------

-- Any table or view a rule may read. `link_column` in this source equals `invoice_column` in invoice.
create table rule_source (
  name            text primary key,
  label           text not null,
  description     text not null,
  link_column     text not null,
  invoice_column  text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table rule (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  natural_language  text not null,
  effect            text not null check (effect in ('ALLOW', 'ESCALATE', 'HOLD')),
  overridable       boolean not null default true,
  origin            text not null check (origin in ('HUMAN', 'AGENT')),
  proposed_by       text not null,
  proposed_at       timestamptz not null default now(),
  approved_by       text not null,
  approved_at       timestamptz not null default now(),
  active            boolean not null default true,
  replaces_rule_id  uuid references rule(id),
  -- An ALLOW that could itself be overridden makes no sense.
  check (effect <> 'ALLOW' or overridable)
);

create table rule_condition (
  id            uuid primary key default gen_random_uuid(),
  rule_id       uuid not null references rule(id),
  position      int not null,
  source        text not null references rule_source(name),
  column_name   text not null,
  operator      text not null check (operator in
                  ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN',
                   'BETWEEN', 'NOT_BETWEEN', 'IS_NULL', 'IS_NOT_NULL')),
  -- Either a literal (jsonb: scalar, or array for IN/BETWEEN) or another column.
  value         jsonb,
  value_source  text references rule_source(name),
  value_column  text,
  unique (rule_id, position),
  check (
    (operator in ('IS_NULL', 'IS_NOT_NULL') and value is null and value_source is null)
    or (operator not in ('IS_NULL', 'IS_NOT_NULL')
        and ((value is not null) <> (value_source is not null))
        and ((value_source is null) = (value_column is null)))
  )
);

create table decision_rule_hit (
  id                     uuid primary key default gen_random_uuid(),
  decision_id            uuid not null references decision(id),
  rule_id                uuid not null references rule(id),
  rule_name              text not null,
  effect                 text not null,
  result                 text not null check (result in ('FIRED', 'PASSED', 'OVERRIDDEN', 'MISSING_DATA', 'NOT_APPLICABLE')),
  observed               jsonb,
  threshold              jsonb,
  overridden_by_rule_id  uuid references rule(id)
);
create index decision_rule_hit_decision_idx on decision_rule_hit (decision_id);

create table approval (
  id                        uuid primary key default gen_random_uuid(),
  decision_id               uuid not null unique references decision(id),
  verdict                   text not null check (verdict in ('APPROVED', 'REJECTED')),
  note                      text,
  approver                  text not null,
  created_at                timestamptz not null default now(),
  reviewed_in_operation_id  uuid references operation(id),
  check (verdict = 'APPROVED' or coalesce(trim(note), '') <> '')
);

create table rule_proposal (
  id                    uuid primary key default gen_random_uuid(),
  operation_id          uuid not null references operation(id),
  name                  text not null,
  natural_language      text not null,
  effect                text not null check (effect in ('ALLOW', 'ESCALATE', 'HOLD')),
  overridable           boolean not null default true,
  conditions            jsonb not null,
  rationale             text not null,
  evidence_invoice_ids  uuid[] not null default '{}',
  status                text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_rule_id       uuid references rule(id),
  created_at            timestamptz not null default now(),
  resolved_at           timestamptz,
  resolved_by           text
);

-- Rule sources: computed facts, one row per invoice ---------------------------------

-- An invoice counts against the month's budget once it is paid by the agent or approved by a human.
create view committed_invoice as
select i.id, i.vendor_id, i.amount_usd, i.received_at
from invoice i
join decision d on d.invoice_id = i.id
left join approval a on a.decision_id = d.id
where d.outcome = 'PAY' or a.verdict = 'APPROVED';

create view invoice_checks as
select
  i.id as invoice_id,
  exists (
    select 1 from invoice o
    where o.id <> i.id and o.received_at < i.received_at
      and o.invoice_number = i.invoice_number
      and (o.vendor_id = i.vendor_id or o.vendor_tax_id = i.vendor_tax_id)
  ) as duplicada,
  (
    select count(*) from invoice o
    where o.id <> i.id and o.received_at < i.received_at
      and o.vendor_id = i.vendor_id and o.amount = i.amount
      and o.invoice_number is distinct from i.invoice_number
      and o.issue_date between i.issue_date - 30 and i.issue_date + 30
  )::int as similares_30d,
  (
    (i.vendor_name_raw is null and i.vendor_tax_id is null)::int
    + (i.amount is null)::int + (i.currency is null)::int + (i.issue_date is null)::int
  ) as campos_faltantes,
  (current_date - i.issue_date) as dias_emision,
  (i.due_date - current_date) as dias_para_vencer
from invoice i;

-- One row per invoice. Rules check orden_encontrada first, so a missing PO never reads as NULL data.
create view po_check as
select
  i.id as invoice_id,
  (po.id is not null) as orden_encontrada,
  po.status as estado_orden,
  round(abs(i.amount - po.amount) / po.amount * 100, 2) as desviacion_pct,
  (i.currency = po.currency) as moneda_coincide,
  (po.vendor_id = i.vendor_id) as proveedor_coincide
from invoice i
left join purchase_order po on po.po_number = i.po_number;

-- Always one row per invoice: a missing budget gives NULLs, so budget rules fail closed.
create view budget_status as
select
  i.id as invoice_id,
  b.period as periodo,
  b.amount_usd as presupuesto_usd,
  coalesce((
    select sum(c.amount_usd) from committed_invoice c
    where c.id <> i.id and date_trunc('month', c.received_at) = date_trunc('month', i.received_at)
  ), 0) as comprometido_usd,
  b.amount_usd - coalesce((
    select sum(c.amount_usd) from committed_invoice c
    where c.id <> i.id and date_trunc('month', c.received_at) = date_trunc('month', i.received_at)
  ), 0) - i.amount_usd as saldo_despues_usd
from invoice i
left join budget b on b.period = date_trunc('month', i.received_at)::date;

-- Spanish descriptions: Gemini and the Rules screen read these through describe_source.
comment on column invoice.vendor_id is 'Proveedor registrado al que corresponde la factura; vacío si no está registrado';
comment on column invoice.vendor_name_raw is 'Nombre del proveedor tal como aparece en la factura';
comment on column invoice.vendor_tax_id is 'NIT, RFC o CNPJ impreso en la factura';
comment on column invoice.invoice_number is 'Número de la factura';
comment on column invoice.po_number is 'Número de orden de compra citado en la factura';
comment on column invoice.bank_account is 'Cuenta bancaria a la que pide el pago';
comment on column invoice.amount is 'Monto en la moneda original';
comment on column invoice.currency is 'Moneda original (USD, COP, MXN, BRL)';
comment on column invoice.amount_usd is 'Monto convertido a dólares';
comment on column invoice.issue_date is 'Fecha de emisión';
comment on column invoice.due_date is 'Fecha de vencimiento';
comment on column invoice.confidence is 'Confianza de la lectura del documento, de 0 a 1';
comment on column vendor.name is 'Nombre del proveedor';
comment on column vendor.tax_id is 'NIT, RFC o CNPJ registrado';
comment on column vendor.country is 'País del proveedor (CO, MX, BR, US)';
comment on column vendor.currency is 'Moneda en la que se le paga';
comment on column vendor.bank_rail is 'Medio de pago: ACH, WIRE, BRE_B, SPEI o PIX';
comment on column vendor.bank_account is 'Cuenta bancaria registrada';
comment on column vendor.status is 'ALLOWED si se le puede pagar, BLOCKED si está bloqueado';
comment on column purchase_order.po_number is 'Número de la orden de compra';
comment on column purchase_order.amount is 'Monto acordado';
comment on column purchase_order.currency is 'Moneda acordada';
comment on column purchase_order.status is 'OPEN o CLOSED';
comment on column invoice_checks.duplicada is 'Ya existe otra factura con el mismo número del mismo proveedor';
comment on column invoice_checks.similares_30d is 'Facturas del mismo proveedor y mismo monto en 30 días';
comment on column invoice_checks.campos_faltantes is 'Cuántos datos básicos faltan (proveedor, monto, moneda, fecha)';
comment on column invoice_checks.dias_emision is 'Días desde la emisión; negativo si la fecha es futura';
comment on column invoice_checks.dias_para_vencer is 'Días hasta el vencimiento; negativo si ya venció';
comment on column po_check.orden_encontrada is 'La factura cita una orden de compra que existe';
comment on column po_check.desviacion_pct is 'Diferencia porcentual entre la factura y la orden de compra';
comment on column po_check.moneda_coincide is 'La moneda de la factura es la de la orden de compra';
comment on column po_check.proveedor_coincide is 'La orden de compra es de este mismo proveedor';
comment on column po_check.estado_orden is 'Estado de la orden de compra (OPEN o CLOSED)';
comment on column budget_status.presupuesto_usd is 'Presupuesto total del mes en dólares';
comment on column budget_status.comprometido_usd is 'Dólares ya pagados o aprobados este mes, sin contar esta factura';
comment on column budget_status.saldo_despues_usd is 'Saldo del mes si se paga esta factura; negativo si no alcanza';

insert into rule_source (name, label, description, link_column, invoice_column) values
  ('invoice',        'Factura',            'Datos leídos de la factura',                         'id',         'id'),
  ('vendor',         'Proveedor',          'Proveedor registrado de la factura',                 'id',         'vendor_id'),
  ('purchase_order', 'Orden de compra',    'Orden de compra citada por la factura',              'po_number',  'po_number'),
  ('invoice_checks', 'Validaciones',       'Duplicados, fechas y datos faltantes',               'invoice_id', 'id'),
  ('po_check',       'Cruce con la orden', 'Comparación entre la factura y su orden de compra',  'invoice_id', 'id'),
  ('budget_status',  'Presupuesto',        'Presupuesto global del mes y saldo',                 'invoice_id', 'id');

-- The rule engine reads registered sources through this role only.
do $$ begin create role rules_reader nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to rules_reader;
grant select on invoice, vendor, purchase_order, invoice_checks, po_check, budget_status,
  committed_invoice, decision, approval, budget to rules_reader;
grant rules_reader to current_user;

commit;
