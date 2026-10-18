# FacturaYa · agente de pagos

Agente que lee facturas (PDF, imagen, texto o correo), las evalúa con reglas que la empresa escribe en lenguaje natural y decide **Pagar, Frenar o Escalar**, explicando cada decisión. Reto Blinka.

- **Producción:** https://52.207.93.205.sslip.io
- **Decisiones de diseño y reglas:** [docs/ROADMAP.md](docs/ROADMAP.md) · **Modelo de datos:** [docs/db-schema.html](docs/db-schema.html)

## Cómo decide

1. Gemini lee la factura y extrae proveedor, NIT, monto, moneda, fechas, orden de compra y cuenta.
2. Un motor determinista (código, sin IA) evalúa las reglas activas sobre los datos de la factura, el proveedor, la orden de compra, las validaciones y el presupuesto.
3. Frenar es final. Escalar espera tu aprobación. Si falta un dato, nunca paga: escala.
4. Gemini redacta la explicación solo a partir de las reglas que se dispararon.

## Correrlo en local

Requisitos: Docker, `uv` (Python 3.12) y Node 20+.

```bash
cp .env.example .env          # DATABASE_URL, GEMINI_API_KEY, ADMIN_PASSWORD, SESSION_SECRET (Gmail es opcional)
scripts/setup-db.sh           # crea esquema, reglas, proveedores, órdenes y el historial de octubre
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Abre http://localhost y entra con `ADMIN_PASSWORD`. `DATABASE_URL` puede ser cualquier Postgres 15+ (Supabase o uno local).

## Datos de prueba

`scripts/setup-db.sh` deja la empresa ficticia lista: 6 proveedores (CO, MX, BR, US; uno bloqueado), 9 órdenes de compra, presupuesto de USD 60.000 al mes, 16 reglas y 10 facturas de historial (7 pagadas y 3 de Northwind sin orden de compra que aprobaste: con ellas "Proponer reglas" sugiere una excepción).

Las 16 facturas de prueba están en [`backend/tests/fixtures/invoices/`](backend/tests/fixtures/invoices/). Súbelas desde la UI, envíalas al correo del agente o procésalas todas con `scripts/setup-db.sh --run-set`.

| Archivo | Caso | Resultado esperado |
|---|---|---|
| 01 a 06 | Normales, con orden de compra, en COP, USD, MXN y BRL (PDF, imagen y texto) | Pagar |
| 07 | Reenvío de la 01 (duplicado exacto) | Frenar |
| 08 | Mismo proveedor y monto que la 02, 12 días después | Escalar |
| 09 | Proveedor no registrado | Escalar |
| 10 | 8 % por encima de la orden de compra | Escalar |
| 11 | USD 12.000, supera el umbral de aprobación humana | Escalar |
| 12 | Presupuesto del mes agotado | Frenar |
| 13 | En COP, convertida supera el límite por pago | Escalar |
| 14 | Imagen borrosa, sin monto legible | Escalar |
| 15 | Proveedor bloqueado | Frenar |
| 16 | Northwind sin orden de compra | Escalar (Pagar tras aceptar la excepción propuesta) |

Para volver a empezar: `scripts/reset-demo.sh` borra todo lo que no sea historial (`--run-set` vuelve a procesar las 16).

## Tests

```bash
cd backend && uv run --group dev pytest -q
```
