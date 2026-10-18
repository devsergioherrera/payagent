-- History invoices cited the same purchase orders as the test cases, so rule 16 (PO overdraft) saw those
-- orders as already consumed and escalated invoices that should pay. History now uses its own, closed POs.
begin;
insert into purchase_order (id, vendor_id, po_number, amount, currency, description, status)
select ('30000000-0000-0000-0000-0000000009' || lpad(row_number() over (order by i.issue_date)::text, 2, '0'))::uuid,
       i.vendor_id, 'PO-09' || lpad(row_number() over (order by i.issue_date)::text, 2, '0'),
       i.amount, i.currency, 'Orden de septiembre (historial)', 'CLOSED'
from invoice i where i.source = 'SEED' and i.po_number is not null
on conflict (po_number) do nothing;
update invoice i set po_number = p.po_number
from purchase_order p
where i.source = 'SEED' and i.po_number is not null and p.po_number like 'PO-09%'
  and p.vendor_id = i.vendor_id and p.amount = i.amount and p.currency = i.currency;
commit;
