# Especificación del sistema · Agente de pagos (Reto Blinka)

Versión 1.0 · 17 oct 2026 · Entrega: domingo 18 oct, 11:59 a. m. (link GitHub + URL desplegada + video demo)

---

## 0. Decisiones asumidas (cerradas, no reabrir)

| Tema | Decisión |
|---|---|
| Equipo | Una persona + subagentes. Todo lo no listado aquí queda fuera. |
| Empresa | Una sola empresa ficticia: **FacturaYa** (EE. UU., moneda base USD). Sin multiempresa. |
| Lo acordado | **Orden de compra (PO)**. No existe tabla de contratos. |
| Áreas | Categoría de la factura **con presupuesto mensual por área** (Compras, Costos, Materia Prima, Marketing). |
| Facturas vencidas | Se **escalan** si pasan el resto de validaciones. |
| Reglas tributarias | Fuera del MVP, salvo una determinista: el **NIT/Tax ID** del documento debe coincidir con el registrado del proveedor. |
| Usuarios | Sin autenticación. Un selector de nombre de aprobador en la UI. |
| Correo (reemplaza a Slack) | **Todo por correo**, con un Gmail dedicado y contraseña de aplicación. Entrada por **IMAP** (el worker revisa cada 10 s); salida por **SMTP** (aviso de escalación y respuesta al remitente con la decisión). Sin Slack. |
| Feedback loop | Entra al MVP: el agente **propone** reglas; el humano las activa. |
| Generación de edge cases por LLM | Fuera del MVP. |
| Pagos reales, fraude, KYC, cumplimiento | Fuera del alcance (lo dice el reto). |

Stack (dado, no se discute): Python 3.12 + FastAPI (API y worker) · Next.js + shadcn/ui · Supabase usado solo como PostgreSQL · Google Gemini (extracción y redacción) · Gmail (IMAP + SMTP con `imaplib` y `smtplib`) · Docker + Docker Compose.

---

## 1. Objetivo

Agente que recibe facturas (PDF, imagen, texto de correo o chat), extrae los datos, evalúa reglas deterministas definidas por la empresa y decide **PAGAR, FRENAR o ESCALAR**, registrando cada decisión con una explicación legible por cualquier persona. Nunca aprueba un pago fuera de las reglas sin acción humana.

Criterios del jurado: **Autonomía** (decide bien sin humano), **Seguridad** (cero pagos indebidos; uno descalifica), **Explicabilidad** (el registro se entiende sin abrir el código).

---

## 2. Principio de arquitectura

```
Documento ──► Extractor (LLM) ──► Invoice normalizada
                                        │
                                        ▼
                    Motor de reglas (código puro, sin LLM) ──► Decision + hits
                                        │
                                        ▼
                    Explicador (LLM) redacta el "por qué" SOLO a partir de los hits
                                        │
                                        ▼
                    Registro + aviso por correo si ESCALATE
```

Invariantes no negociables:
1. El LLM nunca produce la decisión. Solo produce `Invoice` y texto explicativo.
2. El motor de reglas no importa nada de extracción ni de LLM. Es una función pura `evaluate(invoice, rules, context) -> Decision`.
3. Toda decisión ESCALATE o HOLD solo pasa a PAY por una `approval` humana registrada.
4. Un ALLOW nunca anula reglas con `overridable = false`.
5. Fail-closed: cualquier dato faltante o excepción produce ESCALATE, nunca PAY.

Organización hexagonal (carpetas, sin frameworks de DI):

```
backend/
  domain/      Invoice, Rule, Decision, RuleEngine        (sin imports externos)
  ports/       InvoiceSource, InvoiceExtractor, RuleRepository, VendorRepository,
               PORepository, DecisionRepository, Notifier
  adapters/    gemini/, postgres/, email/ (imap + smtp), upload/
  app/         process_invoice, resolve_decision, propose_rules
  api/         FastAPI routers
  worker/      cola de procesamiento + job de propuestas
  tests/       un test por caso trampa + invariantes
frontend/      Next.js + shadcn
docker-compose.yml
```

---

## 3. Actores

1. **Agente**: procesa facturas y decide. Propone reglas.
2. **Administrador de finanzas** (único usuario humano): configura reglas, aprueba o rechaza escalaciones, acepta o rechaza propuestas.
3. **Correo**: canal de entrada de facturas y de aviso.

---

## 4. Flujo principal

1. El usuario sube un documento (o se deja en `inbox/`). Estado `RECEIVED`.
2. El worker lo toma, llama al Extractor y obtiene `Invoice`. Estado `EXTRACTED`. Si falla, estado `EXTRACTION_FAILED` y decisión ESCALATE con motivo "no se pudo leer".
3. El motor evalúa todas las reglas activas y produce `Decision` con sus `hits`.
4. El Explicador redacta la explicación a partir de los hits (prompt recibe solo: outcome, lista de hits con regla, valor observado y límite).
5. Se persiste `decision`. Si outcome es ESCALATE, se envía mensaje a Slack con link a la pantalla.
6. En la UI, el humano resuelve: APPROVED (la factura pasa a `PAID`) o REJECTED (`REJECTED`). HOLD también se puede resolver manualmente (liberar o rechazar).
7. Según el cron configurado, el job de propuestas revisa las escalaciones resueltas y crea `rule_proposal`.

---

## 5. Requerimientos funcionales

### RF-01 Ingesta
- RF-01.1 Subir archivo PDF, PNG/JPG o pegar texto (correo o chat) desde la UI.
- RF-01.2 Cada factura guarda `source_type`, `source_ref` y el archivo original.
- RF-01.3 **Entrada por correo:** el worker revisa el Gmail dedicado por IMAP cada 10 s. Cada adjunto (PDF o imagen) o el cuerpo del correo entra al mismo `process_invoice` que la carga manual. El correo se marca como leído y se usa el hash del archivo para no procesarlo dos veces.

### RF-02 Extracción
- RF-02.1 El Extractor devuelve JSON con: `vendor_name_raw`, `vendor_tax_id`, `invoice_number`, `amount`, `currency`, `issue_date`, `due_date`, `po_number`, `bank_account`, `confidence` (0 a 1).
- RF-02.2 Salida validada con Pydantic. Campo no encontrado = `null`, nunca inventado.
- RF-02.3 Resolución del proveedor: match exacto por `tax_id`; si no, por nombre normalizado. Sin match → `vendor_id = null`.

### RF-03 Reglas
- RF-03.1 Las reglas viven en base de datos (ver §7). No existe ningún prompt de "reglas generales": el LLM nunca participa en la decisión.
- RF-03.1b Creación en lenguaje natural: en la pantalla Reglas el usuario escribe la regla ("no paguen más de 5 mil dólares sin que yo apruebe"). El LLM la traduce con la misma tool validada de RF-08.4 y muestra una vista previa legible (tipo, campo, operador, valor, efecto). La regla solo se guarda cuando el usuario confirma. Si el LLM no puede mapearla al catálogo, responde que no es expresable y no guarda nada.
- RF-03.1c La pantalla Reglas lista todas las reglas con su origen (`HUMAN` o `AGENT`), el texto original en lenguaje natural, fecha de creación y estado activo o inactivo.
- RF-03.2 Tipos de regla soportados (catálogo cerrado en código): `VENDOR_WHITELIST`, `VENDOR_BLOCKED`, `BANK_ACCOUNT_MATCH`, `TAX_ID_MATCH`, `MAX_PER_PAYMENT`, `APPROVAL_THRESHOLD`, `MAX_PER_PERIOD`, `AREA_BUDGET`, `DUPLICATE_EXACT`, `DUPLICATE_WINDOW`, `PO_MATCH`, `CURRENCY_MATCH`, `REQUIRED_FIELDS`, `DATE_RANGE`, `OVERDUE`, `CONDITION`.
- RF-03.3 `CONDITION` permite reglas dinámicas `campo + operador + valores` sobre un catálogo cerrado de campos: `amount`, `currency`, `area`, `vendor_country`, `vendor_region`, `due_date`. Operadores: `EQ, NEQ, IN, NOT_IN, GT, LT, BETWEEN`. Condiciones de una misma regla se combinan en AND.
- RF-03.4 Cada regla tiene `effect` (BLOCK o ALLOW), `action` (HOLD o ESCALATE) y `overridable`.
- RF-03.5 Una regla nunca se edita en caliente: se desactiva y se crea otra (trazabilidad de decisiones pasadas).

### RF-04 Decisión
- RF-04.1 Se evalúan todas las reglas activas; el resultado es el más severo: **HOLD > ESCALATE > PAY**.
- RF-04.2 Un ALLOW cancela únicamente los ESCALATE de reglas `overridable = true`. Nunca cancela HOLD ni `APPROVAL_THRESHOLD`.
- RF-04.3 Montos en moneda distinta de USD se convierten con una tabla fija `fx_rate` (seed) antes de comparar límites. El registro guarda moneda original, tasa y monto convertido.
- RF-04.4 Cada regla disparada se guarda como `decision_rule_hit` con valor observado y valor límite.

### RF-05 Explicación
- RF-05.1 Texto en español, máximo 3 oraciones, generado por el LLM a partir de los hits. Si el LLM falla, se usa una plantilla determinista ("Escalada por: regla X (observado A, límite B)").
- RF-05.2 La UI muestra explicación + tabla de hits.

### RF-06 Resolución humana
- RF-06.1 Pantalla de pendientes con botones Aprobar / Rechazar y campo de nota (motivo).
- RF-06.2 Se registra `approval` con nombre del aprobador, veredicto, nota y fecha.
- RF-06.3 Motivos de rechazo se guardan en texto libre y alimentan el loop de propuestas.

### RF-07 Notificación
- RF-07.1 Cada ESCALATE envía un correo por SMTP al aprobador: proveedor, monto, moneda, motivo corto y link al detalle.
- RF-07.2 Cada factura recibida por correo recibe una respuesta en el mismo hilo con la decisión y su explicación.
- RF-07.3 Un fallo del correo no bloquea la decisión; se registra el error.

### RF-08 Feedback loop (propuestas)
- RF-08.1 Job programado con cron configurable desde la UI (default diario a medianoche).
- RF-08.2 Entrada del job: escalaciones resueltas desde la última corrida, agrupadas por `rule_type + atributo clave + valor` (query SQL, no LLM).
- RF-08.3 Patrón candidato: ≥ 3 escalaciones del mismo patrón con el mismo veredicto humano. APPROVED → propone ALLOW o subir umbral; REJECTED → propone BLOCK.
- RF-08.4 El LLM recibe los patrones y llama la tool `propose_rule(name, effect, action, conditions, rationale, evidence_ids)`. La tool valida contra el catálogo de campos y operadores; si falla, devuelve error y el LLM reintenta (máx. 2).
- RF-08.5 Las propuestas quedan en `rule_proposal` con estado PENDING. El LLM no tiene tool para crear reglas activas.
- RF-08.6 Pantalla Proposals: muestra regla propuesta, razonamiento y facturas de evidencia. Aceptar inserta en `rule` con `source = AGENT`. Rechazar silencia ese patrón 30 días.

### RF-09 Pantallas (Next.js + shadcn)

- RF-09.0 **Mesa de trabajo en tiempo real (WebSockets):** la pantalla principal mantiene una conexión WebSocket con el backend (`/ws/mesa`). El servidor emite eventos `invoice.received`, `invoice.extracted`, `invoice.decided` y `proposal.created`; la Mesa actualiza la tarjeta de la factura en vivo (recibida → leyendo → evaluando reglas → decidida) sin recargar. Si la conexión cae, reconecta sola y, mientras tanto, consulta la API cada 5 segundos.
- RF-09.0b **Detalle de factura en tiempo real (WebSockets):** la pantalla `/facturas/{id}` (dentro de Facturas, la misma para facturas por correo y por carga manual) se suscribe a `/ws/invoices/{id}`. Mientras la factura se procesa, muestra en modo solo lectura la barra de progreso (recibida → leída → evaluando reglas → decisión), los datos extraídos apenas estén listos y la trazabilidad llenándose regla por regla (evento `rule.evaluated`). Aprobar y Rechazar no aparecen hasta que el estado sea `DECIDED`; el backend rechaza cualquier resolución sobre una factura en otro estado. Al terminar, la misma pantalla pasa al estado decidido sin recargar.
1. **Dashboard**: tarjetas con conteo PAY / HOLD / ESCALATE / pendientes; tabla de decisiones con filtro por estado y explicación expandible.
2. **Reglas**: lista con origen (humano o agente) y texto original; caja de texto para pedir una regla en lenguaje natural, vista previa y botón Confirmar; desactivar. Sin formularios por tipo.
3. **Pendientes**: escalaciones y holds con Aprobar / Rechazar.
4. **Proposals**: propuestas del agente con Aceptar / Rechazar.
5. **Subir factura**: archivo o texto pegado.
6. **Configuración**: umbral de aprobación, presupuesto por área y mes, cron de propuestas, webhook Slack.

---

## 6. Reglas iniciales de FacturaYa (seed)

| # | Regla | Tipo | Parámetro | Efecto |
|---|---|---|---|---|
| 1 | Proveedor no está en lista permitida | VENDOR_WHITELIST | — | ESCALATE |
| 2 | Proveedor bloqueado | VENDOR_BLOCKED | — | HOLD (no overridable) |
| 3 | Cuenta bancaria distinta a la registrada | BANK_ACCOUNT_MATCH | — | ESCALATE (no overridable) |
| 4 | Tax ID distinto al registrado | TAX_ID_MATCH | — | ESCALATE |
| 5 | Monto > límite por pago | MAX_PER_PAYMENT | 5 000 USD | ESCALATE |
| 6 | Monto ≥ umbral de aprobación humana | APPROVAL_THRESHOLD | 10 000 USD | ESCALATE (no overridable) |
| 7 | Acumulado del mes + factura > límite del periodo | MAX_PER_PERIOD | 60 000 USD | ESCALATE |
| 8 | Presupuesto del área insuficiente | AREA_BUDGET | ver budget | HOLD (no overridable) |
| 9 | Mismo número de factura y proveedor ya registrado | DUPLICATE_EXACT | — | HOLD (no overridable) |
| 10 | Mismo proveedor y monto en N días | DUPLICATE_WINDOW | 30 días | ESCALATE |
| 11 | Monto fuera de tolerancia de la PO, o sin PO | PO_MATCH | ±5 % | ESCALATE |
| 12 | Moneda distinta a la de la PO | CURRENCY_MATCH | — | ESCALATE |
| 13 | Falta proveedor, monto, moneda o fecha | REQUIRED_FIELDS | — | ESCALATE (no overridable) |
| 14 | Fecha futura o mayor a 90 días | DATE_RANGE | 90 días | ESCALATE |
| 15 | Factura vencida | OVERDUE | — | ESCALATE |

Presupuesto mensual por área (oct 2026): Compras 25 000 · Costos 15 000 · Materia Prima 20 000 · Marketing 8 000 USD.

Proveedores seed (6): 4 activos en LATAM con PO, 1 bloqueado, 1 en NA. Tasas fx seed: COP, MXN, BRL, EUR → USD.

---

## 7. Modelo de datos

Base: `schema.sql` entregado anteriormente, con estos cambios:

1. Eliminar `contract`. Agregar `purchase_order (id, vendor_id, po_number UNIQUE, amount, currency, area, tolerance_pct, status OPEN|CLOSED)`.
2. Agregar `area (code PK, name)` y cambiar `budget` a `(area, period, amount)`.
3. `vendor`: agregar `tax_id`. `invoice`: agregar `vendor_tax_id`, `po_number`, `bank_account`, `area`, `amount_usd`, `fx_rate`, `status (RECEIVED|EXTRACTED|EXTRACTION_FAILED|DECIDED|PAID|REJECTED)`.
4. `decision`: agregar `status (FINAL|PENDING_HUMAN)`.
5. Agregar `fx_rate (currency PK, rate_to_usd, as_of)`.
6. `company` pasa a `settings` (una sola fila): `approval_threshold`, `proposal_cron`, `slack_webhook`.
7. `rule`: agregar `natural_language TEXT` (lo que escribió el usuario o el razonamiento del agente).
8. Mantener `rule`, `rule_condition`, `rule_condition_value`, `invoice_field`, `operator`, `decision_rule_hit`, `approval`, `rule_proposal`, `rule_proposal_evidence`.

Mapeo con las tablas que pensaste: Pagos = `decision` con outcome PAY o `approval` APPROVED · Rechazos = `approval` REJECTED · Motivos = `approval.note` y `decision_rule_hit` · Órdenes de compra = `purchase_order` · Áreas = `area` + `budget` · Usuarios = campo `approver` (sin tabla) · Involucrados = `settings.slack_webhook`.

---

## 8. API mínima (FastAPI)

```
POST   /invoices                 subir archivo o texto → encola
GET    /invoices?status=         lista con decisión y explicación
GET    /invoices/{id}            detalle + hits + approval
POST   /decisions/{id}/resolve   {verdict, approver, note}
POST   /rules/draft              {text} → regla traducida por el LLM (sin guardar)
POST   /rules                    guarda la regla confirmada
GET    /rules  PATCH /rules/{id}/disable
GET    /proposals  POST /proposals/{id}/accept  POST /proposals/{id}/reject
GET/PUT /settings
POST   /jobs/proposals/run       dispara el job manualmente (para la demo)
```

---

## 9. Requerimientos no funcionales

1. **Seguridad**: test `test_never_pay_when_any_block_fires` y `test_allow_never_overrides_hard_rules` obligatorios en CI (GitHub Actions). PR no mergea si fallan.
2. **Explicabilidad**: cada decisión reconstruible desde `decision_rule_hit` sin el LLM.
3. **Determinismo**: mismo `Invoice` + mismas reglas = misma decisión. Tests del motor sin base de datos ni red.
4. **Idempotencia**: reprocesar un archivo no crea factura duplicada (hash del archivo).
5. **Despliegue**: `docker compose up` levanta `api`, `worker`, `frontend`. Postgres en Supabase vía `DATABASE_URL`. Secretos en `.env`.
6. **Sin datos reales**: todo el seed es inventado.

---

## 10. Set de facturas de prueba (15)

| # | Caso | Resultado esperado |
|---|---|---|
| 1–6 | Normales con PO, dentro de límites (PDF, imagen, texto) | PAY |
| 7 | Duplicado exacto de la #1 | HOLD |
| 8 | Mismo proveedor y monto que #2, 12 días después | ESCALATE |
| 9 | Proveedor nuevo no listado | ESCALATE |
| 10 | Monto 8 % sobre la PO | ESCALATE |
| 11 | Monto 12 000 USD (supera umbral humano) | ESCALATE |
| 12 | Marketing con presupuesto agotado | HOLD |
| 13 | Factura en COP, convertida supera límite por pago | ESCALATE |
| 14 | Imagen borrosa, falta monto | ESCALATE |
| 15 | Proveedor bloqueado | HOLD |

Métrica de autonomía para la demo: 6 de 15 decididas sin humano y **0 pagos indebidos**.

---

## 11. Plan de ejecución (solo, con subagentes)

| Bloque | Horas | Entrega |
|---|---|---|
| A. Schema + seed + dominio (`Invoice`, `Rule`, `Decision`, `RuleEngine`) + tests de casos trampa | 0–4 | Motor verde en pytest |
| B0. Gmail dedicado + contraseña de aplicación + prueba de IMAP y SMTP (lo primero de todo, por riesgo de bloqueo o spam) | 0–0,5 | Leer y enviar un correo de prueba |
| B. Extractor Gemini + adapter Postgres + worker + adaptador de correo (IMAP entrada, SMTP aviso y respuesta) | 4–8 | Factura enviada por correo → decisión → respuesta en el hilo |
| C. API FastAPI | 8–10 | Endpoints §8 |
| D. Frontend: Dashboard, Pendientes, Reglas, Subir | 10–15 | UI usable |
| E. Feedback loop: job + tool `propose_rule` + pantalla Proposals | 15–18 | Propuesta visible en demo |
| F. Compose + despliegue + README | 18–20 | URL pública |
| G. Video demo (≤ 3 min) + buffer | 20–23 | Entrega 11:59 a. m. |

Orden de corte si falta tiempo: primero cae `CONDITION` con ALLOW, luego Configuración en UI (queda en `.env`), luego la pantalla Proposals (queda el job y la tabla). El motor, los tests y el dashboard nunca se cortan.

---

## 12. Guion del video demo

1. Pantalla de reglas de FacturaYa (20 s).
2. Subir 3 facturas: una normal, un duplicado, una sobre el umbral (60 s).
3. Enviar una factura por correo desde el celular; aparece en la Mesa en vivo y llega la respuesta al hilo con la explicación (40 s).
4. Aprobar la escalada; disparar el job; aparece la propuesta en Proposals; aceptarla (50 s).
5. Cierre: invariantes de seguridad y tests en CI (10 s).
