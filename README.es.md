<div align="center">

<img src="docs/assets/banner.svg" alt="FacturaYa: el agente de pagos que muestra su trabajo" width="100%">

<br>

[English](README.md) · **Español**

<br>

[![Demo en vivo](https://img.shields.io/badge/demo%20en%20vivo-52.207.93.205.sslip.io-5B3DF5?style=for-the-badge&logo=googlechrome&logoColor=white)](https://52.207.93.205.sslip.io)

![Python](https://img.shields.io/badge/Python-3.12-0B0B0F?style=flat-square&logo=python&logoColor=8B75FF)
![FastAPI](https://img.shields.io/badge/FastAPI-0B0B0F?style=flat-square&logo=fastapi&logoColor=8B75FF)
![Next.js](https://img.shields.io/badge/Next.js-0B0B0F?style=flat-square&logo=nextdotjs&logoColor=8B75FF)
![Postgres](https://img.shields.io/badge/Postgres-Supabase-0B0B0F?style=flat-square&logo=supabase&logoColor=8B75FF)
![Gemini](https://img.shields.io/badge/Gemini-3.8%20flash-0B0B0F?style=flat-square&logo=googlegemini&logoColor=8B75FF)
![Docker](https://img.shields.io/badge/Docker-Compose-0B0B0F?style=flat-square&logo=docker&logoColor=8B75FF)

</div>

<br>

> Hecho para el reto **Blinka**. FacturaYa es una empresa ficticia de EE. UU. que paga a proveedores de Colombia, México, Brasil y EE. UU. desde una sola cuenta en USD. Su agente lee cada factura, la revisa contra las reglas de la empresa y decide. Nunca tienes que adivinar por qué.

## ✨ Qué hace

| | |
|---|---|
| 📄 **Lee lo que sea** | PDF, imagen, texto o un correo a la bandeja del agente. Gemini extrae proveedor, NIT, monto, moneda, fechas, orden de compra y cuenta bancaria. |
| ⚖️ **Decide con reglas, no con intuición** | Un motor determinista (código, sin IA) aplica tus reglas activas. La misma factura da siempre la misma respuesta. |
| 🟢🟠🔴 **Tres salidas** | **Pagar**, **Escalar** (espera tu aprobación) o **Frenar** (final, nadie la libera). Prioridad: Frenar > Escalar > Pagar. |
| 🧾 **Se explica sola** | Cada decisión muestra cada regla revisada, lo que vio y el límite. Gemini redacta el resumen solo a partir de las reglas que se dispararon. |
| 🗣️ **Reglas en lenguaje natural** | Di *«no pagues más de 5 mil sin mí»*. Gemini redacta una regla estructurada, tú la ves en vista previa y la apruebas. Nunca escribe SQL y nunca decide. |
| 🧠 **Aprende de ti** | Cuando apruebas o rechazas, el agente nota patrones y propone reglas nuevas, con las facturas como evidencia. |
| 🛡️ **Falla hacia lo seguro** | Un dato faltante nunca paga: escala. Una regla de permitir jamás anula un Frenar ni el umbral de aprobación humana. |

## 🔁 Cómo funciona

<div align="center">
<img src="docs/assets/flow.svg" alt="El ciclo hacia adelante, el humano en el ciclo y el ciclo de refuerzo" width="100%">
</div>

1. **Ciclo hacia adelante.** Entra una factura, Gemini la lee y el motor decide Pagar, Escalar o Frenar.
2. **Humano en el ciclo.** Las escaladas esperan por ti. Apruebas, o rechazas con un motivo obligatorio. Todo queda registrado con su traza completa.
3. **Ciclo de refuerzo.** El agente lee tus últimas 20 resoluciones y propone reglas. Tú aceptas, la regla entra al reglamento (origen: Agente) y la siguiente factura se juzga con ella.

### Las 16 reglas iniciales

| Frenar | Escalar |
|---|---|
| Proveedor bloqueado · Presupuesto del mes agotado · Duplicado exacto | Proveedor no registrado · Cuenta bancaria o NIT distintos · Más de USD 5.000 · Umbral humano USD 10.000 · Posible duplicado (30 días) · Sin orden de compra válida · Fuera de tolerancia de la orden (5 %) · Moneda distinta a la orden · Faltan datos · Fecha fuera de rango · Factura vencida · Orden de compra sobregirada |

Las reglas son condiciones `fuente.columna operador valor` unidas con AND. Las fuentes son cualquier tabla o vista registrada en `rule_source`, así que una fuente nueva (por ejemplo, una tabla de recepciones del ERP) no exige tocar el motor.

## 🖥️ Pantallas

| Pantalla | Para qué |
|---|---|
| **Mesa** | El escritorio: chat con el agente (subir factura, dictar, redactar una regla, preguntar), contadores en vivo, aprobaciones pendientes. |
| **Facturas** | Todas las facturas con búsqueda, filtros y paginación en servidor. |
| **Detalle** | La decisión, la traza de cada regla, aprobar o rechazar. |
| **Reglas** | El reglamento, borradores, propuestas del agente y su razonamiento. |
| **Directorio** | Proveedores, solo lectura. |
| **Costos** | Cuánto costó cada llamada al LLM. |

## 🚀 Inicio rápido

**Requisitos:** Docker, [`uv`](https://docs.astral.sh/uv/) (Python 3.12) y Node 20+. Un Postgres 15+ (sirve un proyecto gratis de [Supabase](https://supabase.com)) y una [clave de la API de Gemini](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/devsergioherrera/payagent.git && cd payagent
cp .env.example .env            # luego complétalo, mira abajo
scripts/setup-db.sh             # esquema, reglas, proveedores, órdenes de compra e historial de octubre
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Abre <http://localhost> y entra con `ADMIN_PASSWORD`. El frontend también está en `:3000` y la API en `:8000`. El código va montado y recarga al guardar.

### Configuración (`.env`)

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Cualquier Postgres 15+. Sirve la URL del pooler de Supabase. |
| `GEMINI_API_KEY` | Extracción, explicaciones, redacción de reglas y transcripción de voz. |
| `ADMIN_PASSWORD` · `SESSION_SECRET` | El único login web y la clave que firma su cookie. |
| `GMAIL_ADDRESS` · `GMAIL_APP_PASSWORD` · `APPROVER_EMAIL` | Opcional. La bandeja del agente (usa una [contraseña de aplicación](https://support.google.com/accounts/answer/185833) de Gmail) y quién recibe los correos de escalación. |
| `DOMAIN` | Vacío en local. En producción pon un dominio y Caddy emite el certificado HTTPS. |

### Conectar la bandeja de correo (opcional)

Las facturas enviadas a `GMAIL_ADDRESS` se leen y se responden en el mismo hilo. En desarrollo el worker está apagado por defecto:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile email up --build
```

> ⚠️ Nunca corras el worker de correo de desarrollo mientras producción esté arriba. Los dos leerían la misma bandeja.

## 🧪 Cargar datos de prueba

`scripts/setup-db.sh` siembra la empresa ficticia: **6 proveedores** (CO, MX, BR, US, uno bloqueado), **9 órdenes de compra**, un presupuesto de **USD 60.000** al mes, **16 reglas** y **10 facturas de historial**. Tres son de Northwind sin orden de compra que «aprobaste», así que **Proponer reglas** sugiere una excepción.

Las 16 facturas de prueba están en [`backend/tests/fixtures/invoices/`](backend/tests/fixtures/invoices/). Súbelas desde la interfaz, envíalas al correo del agente o procésalas todas con `scripts/setup-db.sh --run-set`.

<details>
<summary><b>Qué debe hacer cada factura de prueba</b></summary>

| Archivo | Caso | Esperado |
|---|---|---|
| 01–06 | Normales, con orden de compra, en COP, USD, MXN y BRL (PDF, imagen, texto) | 🟢 Pagar |
| 07 | Reenvío de la 01 (duplicado exacto) | 🔴 Frenar |
| 08 | Mismo proveedor y monto que la 02, 12 días después | 🟠 Escalar |
| 09 | Proveedor no registrado | 🟠 Escalar |
| 10 | 8 % por encima de la orden de compra | 🟠 Escalar |
| 11 | USD 12.000, supera el umbral de aprobación humana | 🟠 Escalar |
| 12 | Presupuesto del mes agotado | 🔴 Frenar |
| 13 | En COP, convertida supera el límite por pago | 🟠 Escalar |
| 14 | Imagen borrosa, sin monto legible | 🟠 Escalar |
| 15 | Proveedor bloqueado | 🔴 Frenar |
| 16 | Northwind sin orden de compra | 🟠 Escalar, luego 🟢 Pagar tras aceptar la excepción propuesta |

</details>

Para volver a empezar: `scripts/reset-demo.sh` (deja solo el historial; `--run-set` vuelve a procesar las 16).

## 🏗️ Arquitectura

```
backend/    Python 3.12 · FastAPI · hexagonal: domain/ (motor puro) · ports/ · adapters/ (gemini, postgres, email, upload) · app/ (casos de uso) · api/
frontend/   Next.js (App Router) · shadcn/ui · iconos lucide · polling cada 3 s
db/         migraciones + seed (Supabase o cualquier Postgres)
deploy/     Caddyfile (HTTPS) · deploy.sh · bootstrap-vm.sh
scripts/    setup-db.sh · reset-demo.sh
docs/       SPEC.md · ROADMAP.md · BITACORA.md
```

`domain/` no importa nada fuera de la biblioteca estándar, así que el motor se prueba sin base de datos y sin red. Los invariantes de seguridad son tests: `test_never_pay_when_any_block_fires` y `test_allow_never_overrides_hard_rules`.

```bash
cd backend && uv run --group dev pytest -q
```

## ☁️ Producción

Una instancia EC2 corre `docker compose` (API, worker, frontend y Caddy). **Los despliegues solo ocurren por CD:** un push a `main` ejecuta `.github/workflows/cd.yml`, GitHub asume un rol de IAM por OIDC (sin llaves guardadas) y SSM corre `deploy/deploy.sh`. Las migraciones pendientes se aplican antes de reiniciar y un despliegue nunca borra datos. Los secretos viven solo en `.env`.

## 🤖 Trabajar con agentes de IA

Este repositorio está indexado con CodeGraph (`.codegraph/`). Los agentes deben consultarlo antes de usar grep:

```bash
codegraph explore "cómo se resuelve una escalación"
```

Lee [`AGENTS.md`](AGENTS.md) y [`CLAUDE.md`](CLAUDE.md) para las reglas, luego [`docs/BITACORA.md`](docs/BITACORA.md) (estado actual, en curso, pendiente) y [`docs/ROADMAP.md`](docs/ROADMAP.md) (decisiones y responsables). El trabajo va en un worktree por vertical, con Conventional Commits.

## 📚 Documentos

[`SPEC.md`](docs/SPEC.md) la especificación original · [`ROADMAP.md`](docs/ROADMAP.md) decisiones y las 16 reglas · [`BITACORA.md`](docs/BITACORA.md) la bitácora de construcción · [`rules.md`](docs/rules.md) y [`reto_hackathon30x.txt`](docs/reto_hackathon30x.txt) el enunciado del reto

<div align="center"><sub>Hecho en un fin de semana para Blinka · el agente decide, tú mandas</sub></div>
