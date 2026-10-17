-- Fictional seed data for FacturaYa (US company, USD account, vendors in CO, MX, BR, US).
-- tax_id and bank_account are stored normalized: uppercase letters and digits only.
begin;

insert into vendor (id, name, tax_id, country, currency, bank_rail, bank_account, status) values
  ('10000000-0000-0000-0000-000000000001', 'Comercializadora Aurora S.A.S.',      '9001234567',     'CO', 'COP', 'BRE_B', '0012345678901',        'ALLOWED'),
  ('10000000-0000-0000-0000-000000000002', 'Servicios Cloud Andinos S.A.S.',      '9015552221',     'CO', 'USD', 'WIRE',  'BCOL55522201',         'ALLOWED'),
  ('10000000-0000-0000-0000-000000000003', 'Logística del Bajío S.A. de C.V.',    'LBA150312QX4',   'MX', 'MXN', 'SPEI',  '012180001234567891',   'ALLOWED'),
  ('10000000-0000-0000-0000-000000000004', 'Tecnologia Paulista Ltda.',           '12345678000190', 'BR', 'BRL', 'PIX',   'PIXPAULISTACOMBR',     'ALLOWED'),
  ('10000000-0000-0000-0000-000000000005', 'Distribuciones Orión S.A.S.',         '9009998883',     'CO', 'COP', 'BRE_B', '0098765432101',        'BLOCKED'),
  ('10000000-0000-0000-0000-000000000006', 'Northwind Software Inc.',             '841234567',      'US', 'USD', 'ACH',   '021000021987654321',   'ALLOWED');

insert into purchase_order (vendor_id, po_number, amount, currency, description) values
  ('10000000-0000-0000-0000-000000000001', 'PO-1001',  4800000, 'COP', 'Insumos de empaque, octubre'),
  ('10000000-0000-0000-0000-000000000001', 'PO-1005', 12000000, 'COP', 'Material POP, campaña Q4'),
  ('10000000-0000-0000-0000-000000000002', 'PO-1002',     4500, 'USD', 'Hosting y soporte, octubre'),
  ('10000000-0000-0000-0000-000000000002', 'PO-1006',    12000, 'USD', 'Migración de infraestructura'),
  ('10000000-0000-0000-0000-000000000003', 'PO-1003',    60000, 'MXN', 'Transporte y bodegaje, octubre'),
  ('10000000-0000-0000-0000-000000000004', 'PO-1004',    15000, 'BRL', 'Desarrollo de integración');

insert into budget (period, amount_usd) values
  ('2026-10-01', 60000),
  ('2026-11-01', 60000);

insert into fx_rate (currency, rate_to_usd, as_of) values
  ('USD', 1,          '2026-10-01'),
  ('COP', 0.00025,    '2026-10-01'),
  ('MXN', 0.055,      '2026-10-01'),
  ('BRL', 0.18,       '2026-10-01'),
  ('EUR', 1.08,       '2026-10-01');

insert into rule (id, name, natural_language, effect, overridable, origin, proposed_by, approved_by) values
  ('20000000-0000-0000-0000-000000000001', 'Proveedor no registrado',          'Si el proveedor no está registrado, escálalo.',                             'ESCALATE', false, 'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000002', 'Proveedor bloqueado',              'Nunca le pagues a un proveedor bloqueado.',                                  'HOLD',     false, 'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000003', 'Cuenta bancaria distinta',         'Si la cuenta bancaria no es la registrada, escálalo.',                       'ESCALATE', false, 'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000004', 'NIT distinto al registrado',       'Si el NIT de la factura no es el del proveedor, escálalo.',                  'ESCALATE', true,  'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000005', 'Límite por pago',                  'No paguen más de 5 mil dólares sin que yo apruebe.',                         'ESCALATE', true,  'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000006', 'Umbral de aprobación humana',      'Todo pago de 10 mil dólares o más lo apruebo yo, siempre.',                  'ESCALATE', false, 'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000007', 'Presupuesto del mes',              'Si el presupuesto del mes no alcanza, frena el pago.',                       'HOLD',     false, 'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000008', 'Factura duplicada',                'Si la factura ya llegó antes, frénala.',                                     'HOLD',     false, 'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000009', 'Posible cobro repetido',           'Si el mismo proveedor cobra el mismo monto en 30 días, escálalo.',           'ESCALATE', true,  'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000010', 'Sin orden de compra',              'Si la factura no tiene una orden de compra válida, escálala.',               'ESCALATE', true,  'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000011', 'Fuera de la tolerancia de la orden', 'Si el monto se aleja más de 5 % de la orden de compra, escálalo.',          'ESCALATE', true,  'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000012', 'Moneda distinta a la orden',       'Si la moneda no es la de la orden de compra, escálala.',                     'ESCALATE', true,  'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000013', 'Faltan datos',                     'Si falta proveedor, monto, moneda o fecha, escálala.',                       'ESCALATE', false, 'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000014', 'Fecha fuera de rango',             'Si la factura es de fecha futura o de hace más de 90 días, escálala.',       'ESCALATE', true,  'HUMAN', 'Sergio', 'Sergio'),
  ('20000000-0000-0000-0000-000000000015', 'Factura vencida',                  'Si la factura ya venció, escálala.',                                         'ESCALATE', true,  'HUMAN', 'Sergio', 'Sergio');

insert into rule_condition (rule_id, position, source, column_name, operator, value, value_source, value_column) values
  ('20000000-0000-0000-0000-000000000001', 1, 'invoice',        'vendor_id',          'IS_NULL',     null,          null,     null),
  ('20000000-0000-0000-0000-000000000002', 1, 'vendor',         'status',             'EQ',          '"BLOCKED"',   null,     null),
  ('20000000-0000-0000-0000-000000000003', 1, 'invoice',        'bank_account',       'NEQ',         null,          'vendor', 'bank_account'),
  ('20000000-0000-0000-0000-000000000004', 1, 'invoice',        'vendor_tax_id',      'NEQ',         null,          'vendor', 'tax_id'),
  ('20000000-0000-0000-0000-000000000005', 1, 'invoice',        'amount_usd',         'GT',          '5000',        null,     null),
  ('20000000-0000-0000-0000-000000000006', 1, 'invoice',        'amount_usd',         'GTE',         '10000',       null,     null),
  ('20000000-0000-0000-0000-000000000007', 1, 'budget_status',  'saldo_despues_usd',  'LT',          '0',           null,     null),
  ('20000000-0000-0000-0000-000000000008', 1, 'invoice_checks', 'duplicada',          'EQ',          'true',        null,     null),
  ('20000000-0000-0000-0000-000000000009', 1, 'invoice_checks', 'similares_30d',      'GT',          '0',           null,     null),
  ('20000000-0000-0000-0000-000000000010', 1, 'po_check',       'orden_encontrada',   'EQ',          'false',       null,     null),
  ('20000000-0000-0000-0000-000000000011', 1, 'po_check',       'orden_encontrada',   'EQ',          'true',        null,     null),
  ('20000000-0000-0000-0000-000000000011', 2, 'po_check',       'desviacion_pct',     'GT',          '5',           null,     null),
  ('20000000-0000-0000-0000-000000000012', 1, 'po_check',       'orden_encontrada',   'EQ',          'true',        null,     null),
  ('20000000-0000-0000-0000-000000000012', 2, 'po_check',       'moneda_coincide',    'EQ',          'false',       null,     null),
  ('20000000-0000-0000-0000-000000000013', 1, 'invoice_checks', 'campos_faltantes',   'GT',          '0',           null,     null),
  ('20000000-0000-0000-0000-000000000014', 1, 'invoice_checks', 'dias_emision',       'NOT_BETWEEN', '[0, 90]',     null,     null),
  ('20000000-0000-0000-0000-000000000015', 1, 'invoice_checks', 'dias_para_vencer',   'LT',          '0',           null,     null);

commit;
