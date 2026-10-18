-- 1. Purchase-order balance: an invoice must not overdraw its PO together with the invoices already committed to it.
-- 2. Who deactivated a rule, and when.
begin;

create or replace view po_check as
select
  i.id as invoice_id,
  (po.id is not null) as orden_encontrada,
  po.status as estado_orden,
  round(abs(i.amount - po.amount) / po.amount * 100, 2) as desviacion_pct,
  (i.currency = po.currency) as moneda_coincide,
  (po.vendor_id = i.vendor_id) as proveedor_coincide,
  coalesce((
    select sum(o.amount) from invoice o
    join committed_invoice c on c.id = o.id
    where o.po_number = i.po_number and o.id <> i.id and o.currency = po.currency
  ), 0) as comprometido_oc,
  round((po.amount - coalesce((
    select sum(o.amount) from invoice o
    join committed_invoice c on c.id = o.id
    where o.po_number = i.po_number and o.id <> i.id and o.currency = po.currency
  ), 0) - i.amount) / po.amount * 100, 2) as saldo_oc_despues_pct
from invoice i
left join purchase_order po on po.po_number = i.po_number;

comment on column po_check.comprometido_oc is 'Monto ya pagado o aprobado contra esta orden de compra en otras facturas, en la moneda de la orden';
comment on column po_check.saldo_oc_despues_pct is 'Porcentaje de la orden que queda libre si se paga esta factura; negativo si la orden queda sobregirada';

grant select on po_check to rules_reader;

insert into rule (id, name, natural_language, effect, overridable, origin, proposed_by, approved_by) values
  ('20000000-0000-0000-0000-000000000016', 'Supera el saldo de la orden de compra',
   'Si con esta factura la orden de compra queda sobregirada más de 5 %, escálala.',
   'ESCALATE', true, 'HUMAN', 'Sergio', 'Sergio')
on conflict (id) do nothing;

insert into rule_condition (rule_id, position, source, column_name, operator, value) values
  ('20000000-0000-0000-0000-000000000016', 1, 'po_check', 'orden_encontrada', 'EQ', 'true'),
  ('20000000-0000-0000-0000-000000000016', 2, 'po_check', 'saldo_oc_despues_pct', 'LT', '-5')
on conflict (rule_id, position) do nothing;

alter table rule add column if not exists deactivated_at timestamptz;
alter table rule add column if not exists deactivated_by text;

commit;
