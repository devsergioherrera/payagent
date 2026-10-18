# Bitácora del orquestador

Para retomar el trabajo si se pierde el contexto de la sesión. Lo más nuevo va arriba. Leer junto con `CLAUDE.md`, `docs/ROADMAP.md` y `docs/UX-AUDIT.md`.

## Cómo retomar
- Integración: worktree `.claude/worktrees/develop` (rama `develop`). Producción: `main`, con CD a https://52.207.93.205.sslip.io (contraseña `ADMIN_PASSWORD` del `.env`).
- Cada tarea se hace en `.claude/worktrees/<nombre>` desde `develop`. Se revisa con capturas y tests puntuales, se integra con `git merge --no-ff` y luego se borran el worktree y la rama.
- Briefs de agentes: `/tmp/payagent/briefs/` (`common.md`, `phase2.md`, `fe-design.md` y uno por tarea). Capturas: `/tmp/payagent/briefs/shot.sh` o `/tmp/payagent/pw/shots.mjs` (Playwright con sesión iniciada sobre :3100).
- Local: API `uvicorn` en :8100 desde `develop/backend` con el `.env` cargado; frontend `next dev` en :3100 desde `develop/frontend` con `API_URL=http://localhost:8100`.
- Base: una sola Supabase compartida por local y producción. `scripts/setup-db.sh` aplica migraciones; `scripts/reset-demo.sh` deja solo el historial y borra reglas `test-*`.
- Reglas del dueño: respuestas cortas en español; nada de subagentes sin permiso (ya dado para las verticales); tests solo de lo que cambió; pantallas que caben en el viewport; iconos lucide; Frenar es final.

## Estado al 17 oct, 21:45
**En producción (`main`, abeb1f6):** todo hasta el despliegue con migraciones automáticas.
**Solo en `develop` (falta desplegar):** W5 (pulido UX), W6 (Política de pagos visual), contraste y transiciones, limpieza de reglas de test, arreglo de fechas en el detalle.

**En curso:**
- W7 `worktree-w7-state`: un solo estado de factura en backend y frontend (`state` en InvoiceSummary + `<StateBadge>`), y backfill de las reglas evaluadas del historial. Origen: la Mesa mostraba "Escalada" en facturas que el dueño ya aprobó.

**Pendiente, en orden:**
1. Integrar W7, revisarlo con capturas reales y desplegar `develop` a `main`.
2. Prueba de correo de punta a punta: el conector de Gmail de claude.ai está caído; el dueño puede mandar `backend/tests/fixtures/invoices/02.pdf` a `facturaya.pagos@gmail.com`.
3. Antes de grabar: `scripts/reset-demo.sh`, luego el guion de demo (subir 01, 07 y 11; correo; aprobar; Proponer reglas; aceptar la excepción de Northwind; 16 pasa a Pagar).
4. Video de 3 minutos y entrega a las 10:00.

## Decisiones tomadas (no reabrir)
- Salidas: Pagar, Frenar (final), Escalar (espera tu aprobación). Dato faltante: escala.
- Reglas: condiciones `fuente.columna operador valor` sobre fuentes registradas en `rule_source`; ALLOW solo anula escalaciones overridable. Editar una regla crea una versión nueva y desactiva la anterior.
- Presupuesto global mensual; regla 16 controla el sobregiro acumulado de la orden de compra.
- Gemini `gemini-3.8-flash` (la 2.5 no está disponible para la cuenta).
- Deploy nunca resetea datos; aplica migraciones pendientes antes de reiniciar.

## Historial
- 21:45 Bitácora creada. W7 relanzado tras una interrupción.
- 21:40 Fechas sin hora se mostraban un día antes (zona horaria): arreglado en `format.ts`.
- 21:30 Auditoría UX (`docs/UX-AUDIT.md`); W5 y W6 integrados.
- 21:10 Reglas `test-*` borradas de la base; los tests ahora limpian lo que crean.
- 20:55 Deploy con migraciones automáticas (`deploy/deploy.sh` + `backend/scripts/migrate.py`).
- 20:40 README, `setup-db.sh` (probado en Postgres vacío) y `reset-demo.sh`.
- 20:00 Producción en línea con login; base limpia con solo historial.
- Antes: fases 0 a 2 del roadmap, rediseños W1 a W4 (Frenar final, Reglas, Mesa con mascota, auditoría de reglas y regla 16).
