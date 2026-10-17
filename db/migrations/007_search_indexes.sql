-- Directorio search at scale (10k invoices, 5k purchase orders a month). Not applied automatically.
begin;

create extension if not exists pg_trgm;

create index if not exists vendor_name_trgm_idx on vendor using gin (name gin_trgm_ops);
create index if not exists vendor_tax_id_trgm_idx on vendor using gin (tax_id gin_trgm_ops);
create index if not exists purchase_order_po_number_trgm_idx on purchase_order using gin (po_number gin_trgm_ops);
create index if not exists purchase_order_description_trgm_idx on purchase_order using gin (description gin_trgm_ops);
create index if not exists purchase_order_vendor_idx on purchase_order (vendor_id);
create index if not exists invoice_po_number_idx on invoice (po_number) where po_number is not null;
create index if not exists invoice_received_idx on invoice (received_at desc);

commit;
