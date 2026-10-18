# Roadmap · Agente de pagos FacturaYa

Inicio: sáb 17 oct, 17:30. **Congelar código: dom 18 oct, 08:00.** Demo y video: 08:00 a 10:00. Entrega: 11:59.

Lo importante es el agente: decide bien, explica cada decisión y aprende reglas. Todo lo demás se corta antes que eso.

## Decisiones de esta sesión (reemplazan al spec donde choquen)

| Tema | Decisión |
|---|---|
| Empresa | FacturaYa: constituida en EE. UU., cuenta en USD, proveedores en CO, MX, BR y US. |
| Salidas del agente | Pagar, Frenar, Escalar (`PAY`, `HOLD`, `ESCALATE`). Prioridad: Frenar > Escalar > Pagar. |
| Frenar es final | Frenar es final. Solo Escalar espera una decisión humana. Nadie libera ni rechaza una factura frenada; desde su detalle se puede crear una regla (`/reglas?from=<id>`). |
| Decisión humana | Aprobar o Rechazar, con motivo obligatorio al rechazar. |
| Reglas | Una sola forma: condiciones `fuente.columna operador valor` en AND. El valor puede ser otra columna. Efectos: `ALLOW`, `ESCALATE`, `HOLD`. |
| ALLOW | Solo cancela escalaciones de reglas `overridable`. Nunca cancela un Frenar ni el umbral humano. |
| Fuentes de reglas | Cualquier tabla o vista registrada en `rule_source`, con su enlace a la factura. Las vistas solo para datos calculados. |
| LLM y reglas | Gemini traduce lenguaje natural a una regla estructurada con tools (`listar_fuentes`, `describir_fuente`, `redactar_regla`). Nunca escribe SQL ni decide. |
| Presupuesto | Global por mes. Sin áreas. |
| Feedback loop | Botón "Proponer reglas": lee las 20 resoluciones humanas no revisadas, operación idempotente. Rechazar una propuesta la deja en `REJECTED`. |
| Chat (Mesa) | Subir factura, crear reglas, buscar proveedores y facturas. Sin preguntas libres. |
| Tiempo real | Polling cada 3 s. Sin WebSockets. |
| Pantallas | Mesa, Facturas, Detalle de factura, Reglas, Proveedores (solo lectura), Costos. Sin Configuración. Login con una contraseña. Solo español. |
| Colores | Negro, blanco y violeta índigo `#5B3DF5`. Verde, ámbar y rojo solo para Pagar, Escalar y Frenar. |
| Datos | Supabase. Esquema: `db/migrations/001_schema.sql`. |
| LLM | Gemini (`gemini-3.8-flash` para extraer y redactar (2.5 ya no está disponible para cuentas nuevas)). |

## Reglas seed

| # | Regla | Condición | Efecto |
|---|---|---|---|
| 1 | Proveedor no registrado | `invoice.vendor_id IS NULL` | Escalar, no overridable |
| 2 | Proveedor bloqueado | `vendor.status = BLOCKED` | Frenar |
| 3 | Cuenta bancaria distinta | `invoice.bank_account ≠ vendor.bank_account` | Escalar, no overridable |
| 4 | NIT distinto | `invoice.vendor_tax_id ≠ vendor.tax_id` | Escalar |
| 5 | Límite por pago | `invoice.amount_usd > 5000` | Escalar |
| 6 | Umbral de aprobación humana | `invoice.amount_usd ≥ 10000` | Escalar, no overridable |
| 7 | Presupuesto del mes | `budget_status.saldo_despues_usd < 0` | Frenar |
| 8 | Duplicado exacto | `invoice_checks.duplicada = true` | Frenar |
| 9 | Posible duplicado (30 días) | `invoice_checks.similares_30d > 0` | Escalar |
| 10 | Sin orden de compra válida | `po_check.orden_encontrada = false` | Escalar |
| 11 | Fuera de tolerancia de la orden | `po_check.orden_encontrada = true` y `po_check.desviacion_pct > 5` | Escalar |
| 12 | Moneda distinta a la orden | `po_check.orden_encontrada = true` y `po_check.moneda_coincide = false` | Escalar |
| 13 | Faltan datos | `invoice_checks.campos_faltantes > 0` | Escalar, no overridable |
| 14 | Fecha fuera de rango | `invoice_checks.dias_emision` fuera de 0 a 90 | Escalar |
| 15 | Factura vencida | `invoice_checks.dias_para_vencer < 0` | Escalar |

Semántica del motor (detalle en `backend/src/payagent/domain/engine.py`):
- Las condiciones se evalúan en orden. La primera que no se cumple deja la regla en PASSED.
- Si una fuente no tiene fila para la factura (por ejemplo `vendor` con proveedor no registrado), la regla queda NOT_APPLICABLE.
- Si un valor necesario viene vacío, la regla queda MISSING_DATA y cuenta como disparada (fail-closed).
- Sin reglas activas, la factura escala.

## Quién hace qué

| Rol | Quién | Para qué |
|---|---|---|
| Arquitecto y orquestador | Claude (Opus), esta sesión | Contratos, esquema, revisión y merge de cada vertical. |
| Backend núcleo | Claude Sonnet | Motor, adaptadores, agente Gemini, API. |
| Tareas mecánicas | Claude Haiku | README, seeds repetitivos, ajustes de copy. |
| Frontend y datos de prueba | OpenCode (modelos free de OpenRouter) | Pantallas sobre tipos y mocks ya definidos, generación de facturas, mascota. |

**Ramas.** `main` es producción (CD). `develop` es la rama de integración. Cada vertical sale de `develop` en su worktree `.claude/worktrees/<nombre>` (rama `worktree-<nombre>`), usa CodeGraph antes de grep y entrega con tests verdes. El orquestador revisa el diff y la integra en `develop`. `develop` pasa a `main` solo en hitos probados en dev.

## Fase 0 · Contratos (orquestador, 17:30 a 20:00)

Todo lo demás depende de esto. Nadie arranca una vertical antes de que su contrato esté en `main`.

- **C1 Esquema.** `db/migrations/001_schema.sql` (tablas, vistas `invoice_checks` y `budget_status`, `rule_source` con enlaces, rol de solo lectura) y `002_seed.sql` (proveedores, órdenes, presupuesto, tasas, 15 reglas). Aplicado en Supabase.
- **C2 Dominio.** `domain/` con `Invoice`, `Condition`, `Rule`, `Decision`, `RuleHit` y la firma `evaluate(rules, facts) -> Decision` sin implementar. `ports/` con `Extractor`, `FactLoader`, `RuleRepository`, `InvoiceRepository`, `Notifier`, `UsageMeter`.
- **C3 API.** Esquemas Pydantic de cada endpoint y su espejo en `frontend/src/lib/api-types.ts`, más datos mock con la misma forma.
- **C4 Instrucciones para agentes.** `AGENTS.md` en la raíz (CodeGraph, reglas de worktree, contratos que no se tocan).

## Fase 1 · Verticales en paralelo (20:00 a 01:00)

| Vertical | Quién | Depende de | Entrega verificable |
|---|---|---|---|
| V1 Motor de reglas | Sonnet | C2 | `evaluate()` puro, test por cada regla seed, `test_never_pay_when_any_block_fires`, `test_allow_never_overrides_hard_rules`. |
| V2 Extractor Gemini | Sonnet | C2 | PDF, imagen o texto a `Invoice` validado. Registra tokens y costo. Test con 3 facturas reales del set. |
| V3 Postgres | Sonnet | C1, C2 | Repositorios, `FactLoader` que lee `rule_source` y arma los datos por factura, lock por decisión. |
| V4 Set de facturas | OpenCode | C1 | 15 facturas (PDF, PNG, texto) coherentes con el seed en `backend/tests/fixtures/invoices/`, con el resultado esperado de cada una. |
| V5 Shell y Mesa | OpenCode | C3 | Tokens de color, layout, login, Mesa con chat y listas, contra mocks. |
| V6 Facturas y Detalle | OpenCode | C3 | Lista con filtros y detalle con trazabilidad, Aprobar y Rechazar, contra mocks. |
| V7 Reglas, Proveedores, Costos | OpenCode | C3 | Lista de reglas con origen y aprobación, propuestas, vista previa de regla, contra mocks. |

## Fase 2 · El agente completo (23:00 a 04:00)

| Vertical | Quién | Depende de | Entrega verificable |
|---|---|---|---|
| V8 Pipeline | Sonnet | V1, V2, V3 | `process_invoice` real: extrae, decide, explica (plantilla si Gemini falla), notifica. Factura por correo con respuesta en el hilo. |
| V9 API | Sonnet | V3, C3 | Endpoints del contrato funcionando contra Supabase. |
| V10 Redactor de reglas | Sonnet | V3 | Tools `listar_fuentes`, `describir_fuente`, `redactar_regla` con validación contra el catálogo. "No pagues más de 5 mil sin mí" produce la regla correcta. |
| V11 Chat | Sonnet | V9, V10 | Endpoint del chat con tools de búsqueda, subida y redacción de reglas. |
| V12 Feedback loop | Sonnet | V3 | Operación `PROPOSE_RULES` idempotente, propuestas con evidencia, aceptar crea la regla con origen Agente. |

## Fase 3 · Integración y demo (04:00 a 08:00)

- Frontend contra la API real (quitar mocks). OpenCode por pantalla, revisión del orquestador.
- Correr las 15 facturas de punta a punta. Meta: 0 pagos indebidos y al menos 6 decididas sin humano.
- Mascota en Three.js con color y forma parametrizados (OpenCode). Se corta primero si no hay tiempo.
- Deploy por CD (merge a `main`) y prueba en la URL pública.

## Orden de corte si falta tiempo

1. Mascota (queda el cuadro estático).
2. Pantalla de Costos (los datos quedan en `llm_usage`).
3. Chat de búsqueda (queda la subida y la creación de reglas).
4. Proveedores (queda el seed).

Nunca se cortan: motor, tests de seguridad, extracción, trazabilidad, decisión humana, reglas en lenguaje natural, feedback loop.
