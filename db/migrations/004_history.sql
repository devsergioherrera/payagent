-- History seed for V4 invoice test set
-- Fixed uuids with prefix 30000000-... for easy undo
-- Committed total (paid + approved) must be about USD 20,000
begin;

-- New purchase orders from brief section 3.1
-- PO-1007 (Bajío, MXN 30,000)
-- PO-1009 (Cloud Andinos, USD 25,000, "Licencias anuales")  
-- PO-1010 (Aurora, COP 22,000,000)
insert into purchase_order (id, vendor_id, po_number, amount, currency, description) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'PO-1007', 30000, 'MXN', ''),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'PO-1009', 25000, 'USD', 'Licencias anuales'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'PO-1010', 22000000, 'COP', '');

-- Past October invoices (SEED source) - about USD 18,000 paid by agent
-- Creating 4 invoices that will result in PAY decisions
-- Invoice 1: Comercializadora Aurora, COP 72,000,000 (~USD 18,000) - too high, let me distribute
-- Better distribution:
-- Invoice 1: Comercializadora Aurora, COP 28,000,000 (~USD 7,000)
-- Invoice 2: Servicios Cloud Andinos, USD 4,000 
-- Invoice 3: Tecnologia Paulista, BRL 30,000 (~USD 5,400)
-- Invoice 4: Logística del Bajío, MXN 120,000 (~USD 6,600)
-- Total: ~USD 23,000 - too high. Let me recalculate.

-- Target: ~18,000 USD for SEED invoices
-- Invoice 1: Aurora, COP 40,000,000 = USD 10,000
-- Invoice 2: Cloud Andinos, USD 3,000
-- Invoice 3: Paulista, BRL 20,000 = USD 3,600
-- Invoice 4: Bajío, MXN 60,000 = USD 3,300
-- Total: USD 19,900 - perfect! Then with Northwind approval (1,950) we'd be over.

-- Actually, let me re-read: "Committed total (paid + approved) must be about USD 20,000"
-- This likely means the total of all committed items should be around 20,000.
-- If I have SEED invoices totaling X USD (PAY) and one approved Northwind invoice of 1,950 USD,
-- then X + 1,950 ≈ 20,000, so X ≈ 18,050

-- Let me target SEED invoices at 18,000 USD total

-- Invoice SEED-001: Comercializadora Aurora
insert into invoice (id, file_sha256, source, source_ref, status, vendor_id, vendor_name_raw, vendor_tax_id, invoice_number, po_number, bank_account, amount, currency, fx_rate, amount_usd, issue_date, due_date, received_at, confidence) values
  ('30000000-0000-0000-0000-000000000004', 'seed001sha256hash11111111111111111111111111111111', 'SEED', 'SEED-001', 'DECIDED', '10000000-0000-0000-0000-000000000001', 'Comercializadora Aurora S.A.S.', '9001234567', 'SEED-001', 'PO-1001', '0012345678901', 32000000, 'COP', 0.00025, 8000, '2026-10-02', '2026-11-01', '2026-10-02 10:00:00', 0.95);

-- Decision for SEED-001 (PAY)
insert into decision (id, invoice_id, outcome, status, explanation, explained_by) values
  ('30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000004', 'PAY', 'FINAL', 'Invoice within PO amount and budget, all validations passed', 'TEMPLATE');

-- Invoice SEED-002: Servicios Cloud Andinos
insert into invoice (id, file_sha256, source, source_ref, status, vendor_id, vendor_name_raw, vendor_tax_id, invoice_number, po_number, bank_account, amount, currency, fx_rate, amount_usd, issue_date, due_date, received_at, confidence) values
  ('30000000-0000-0000-0000-000000000006', 'seed002sha256hash22222222222222222222222222222222', 'SEED', 'SEED-002', 'DECIDED', '10000000-0000-0000-0000-000000000002', 'Servicios Cloud Andinos S.A.S.', '9015552221', 'SEED-002', 'PO-1002', 'BCOL55522201', 2000, 'USD', 1, 2000, '2026-10-03', '2026-11-02', '2026-10-03 14:30:00', 0.92);

-- Decision for SEED-002 (PAY)
insert into decision (id, invoice_id, outcome, status, explanation, explained_by) values
  ('30000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000006', 'PAY', 'FINAL', 'Invoice within PO amount and budget, all validations passed', 'TEMPLATE');

-- Invoice SEED-003: Tecnologia Paulista
insert into invoice (id, file_sha256, source, source_ref, status, vendor_id, vendor_name_raw, vendor_tax_id, invoice_number, po_number, bank_account, amount, currency, fx_rate, amount_usd, issue_date, due_date, received_at, confidence) values
  ('30000000-0000-0000-0000-000000000008', 'seed003sha256hash33333333333333333333333333333333', 'SEED', 'SEED-003', 'DECIDED', '10000000-0000-0000-0000-000000000004', 'Tecnologia Paulista Ltda.', '12345678000190', 'SEED-003', 'PO-1004', 'PIXPAULISTACOMBR', 15000, 'BRL', 0.18, 2700, '2026-10-05', '2026-11-04', '2026-10-05 09:15:00', 0.98);

-- Decision for SEED-003 (PAY)
insert into decision (id, invoice_id, outcome, status, explanation, explained_by) values
  ('30000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000008', 'PAY', 'FINAL', 'Invoice within PO amount and budget, all validations passed', 'TEMPLATE');

-- Invoice SEED-004: Logística del Bajío
insert into invoice (id, file_sha256, source, source_ref, status, vendor_id, vendor_name_raw, vendor_tax_id, invoice_number, po_number, bank_account, amount, currency, fx_rate, amount_usd, issue_date, due_date, received_at, confidence) values
  ('30000000-0000-0000-0000-000000000010', 'seed004sha256hash44444444444444444444444444444444', 'SEED', 'SEED-004', 'DECIDED', '10000000-0000-0000-0000-000000000003', 'Logística del Bajío S.A. de C.V.', 'LBA150312QX4', 'SEED-004', 'PO-1003', '012180001234567891', 80000, 'MXN', 0.055, 4400, '2026-10-07', '2026-11-06', '2026-10-07 16:45:00', 0.90);

-- Decision for SEED-004 (PAY)
insert into decision (id, invoice_id, outcome, status, explanation, explained_by) values
  ('30000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000010', 'PAY', 'FINAL', 'Invoice within PO amount and budget, all validations passed', 'TEMPLATE');

-- Three Northwind invoices (NW-8701..8703, USD 1,950 each, no PO) with decision ESCALATE
-- Invoice NW-8701
insert into invoice (id, file_sha256, source, source_ref, status, vendor_id, vendor_name_raw, vendor_tax_id, invoice_number, po_number, bank_account, amount, currency, fx_rate, amount_usd, issue_date, due_date, received_at, confidence) values
  ('30000000-0000-0000-0000-000000000012', 'nw8701sha256hash11111111111111111111111111111111', 'EMAIL', 'NW-8701', 'DECIDED', '10000000-0000-0000-0000-000000000006', 'Northwind Software Inc.', '841234567', 'NW-8701', NULL, '021000021987654321', 1950, 'USD', 1, 1950, '2026-10-08', '2026-11-07', '2026-10-08 11:00:00', 0.85);

-- Decision for NW-8701 (ESCALATE due to rule 20000000-0000-0000-0000-000000000010 - Sin orden de compra)
insert into decision (id, invoice_id, outcome, status, explanation, explained_by) values
  ('30000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000012', 'ESCALATE', 'RESOLVED', 'Invoice lacks purchase order, requires human approval', 'TEMPLATE');

-- Rule hit for NW-8701 (rule 20000000-0000-0000-0000-000000000010 fired)
insert into decision_rule_hit (id, decision_id, rule_id, rule_name, effect, result, observed, threshold) values
  ('30000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000010', 'Sin orden de compra', 'ESCALATE', 'FIRED', '{\"orden_encontrada\": false}', 'false');

-- Approval for NW-8701 (APPROVED by Sergio)
insert into approval (id, decision_id, verdict, note, approver) values
  ('30000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000013', 'APPROVED', 'Suscripción mensual, no lleva orden de compra', 'Sergio');

-- Invoice NW-8702
insert into invoice (id, file_sha256, source, source_ref, status, vendor_id, vendor_name_raw, vendor_tax_id, invoice_number, po_number, bank_account, amount, currency, fx_rate, amount_usd, issue_date, due_date, received_at, confidence) values
  ('30000000-0000-0000-0000-000000000016', 'nw8702sha256hash22222222222222222222222222222222', 'EMAIL', 'NW-8702', 'DECIDED', '10000000-0000-0000-0000-000000000006', 'Northwind Software Inc.', '841234567', 'NW-8702', NULL, '021000021987654321', 1950, 'USD', 1, 1950, '2026-10-09', '2026-11-08', '2026-10-09 13:20:00', 0.88);

-- Decision for NW-8702 (ESCALATE due to rule 20000000-0000-0000-0000-000000000010 - Sin orden de compra)
insert into decision (id, invoice_id, outcome, status, explanation, explained_by) values
  ('30000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-000000000016', 'ESCALATE', 'RESOLVED', 'Invoice lacks purchase order, requires human approval', 'TEMPLATE');

-- Invoice NW-8703
insert into invoice (id, file_sha256, source, source_ref, status, vendor_id, vendor_name_raw, vendor_tax_id, invoice_number, po_number, bank_account, amount, currency, fx_rate, amount_usd, issue_date, due_date, received_at, confidence) values
  ('30000000-0000-0000-0000-000000000018', 'nw8703sha256hash33333333333333333333333333333333', 'EMAIL', 'NW-8703', 'DECIDED', '10000000-0000-0000-0000-000000000006', 'Northwind Software Inc.', '841234567', 'NW-8703', NULL, '021000021987654321', 1950, 'USD', 1, 1950, '2026-10-10', '2026-11-09', '2026-10-10 15:45:00', 0.91);

-- Decision for NW-8703 (ESCALATE due to rule 20000000-0000-0000-0000-000000000010 - Sin orden de compra)
insert into decision (id, invoice_id, outcome, status, explanation, explained_by) values
  ('30000000-0000-0000-0000-000000000019', '30000000-0000-0000-0000-000000000018', 'ESCALATE', 'RESOLVED', 'Invoice lacks purchase order, requires human approval', 'TEMPLATE');

-- Note: As per brief, one of the Northwind invoices should have an approval APPROVED by Sergio
-- I already added approval for NW-8701 above

commit;