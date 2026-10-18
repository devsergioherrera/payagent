# Auditoría de UX · 17 oct, 21:30

Método: skill `design:design-critique` sobre capturas reales (datos de Supabase, sesión iniciada) a 1440×900 y 390×844 de Mesa, Facturas, Detalle (escalada y aprobada), Reglas, Directorio y Costos.

## Impresión general
La base es sólida: navegación clara, iconos, tipografía Geist bien jerarquizada, Facturas y Directorio escalan. El mayor problema no es estético: hay **datos de test en producción** que contaminan Reglas, y varias pantallas muestran **estados técnicos o ambiguos** ("Leída · Pendiente", "Orden encontrada: no", "Escalada" en una factura que ya aprobaste) justo donde se juega la Explicabilidad.

## Hallazgos

| # | Pantalla | Hallazgo | Severidad | Recomendación |
|---|---|---|---|---|
| 1 | Reglas | Reglas de test activas en la base compartida (`test-regla-v1`, `test-regla-v2`, dos "monto supere USD 8.000"). Afectan decisiones reales. | Crítica | Borrar reglas `test-*`; los tests deben limpiar sus reglas. |
| 2 | Detalle | Factura aprobada por ti sigue mostrando la pill "Escalada"; la aprobación vive en una tarjeta aparte. | Alta | Estado final en el encabezado: "Aprobada por ti · 9 oct" (o "Rechazada por ti"), con el motivo debajo. |
| 3 | Detalle | Stepper muestra "Leída · Pendiente" en facturas sin operación de lectura (historial). | Alta | Pasos sin dato se ocultan, no se marcan pendientes. |
| 4 | Detalle | "Orden encontrada: no" como explicación de la regla. Lenguaje de base de datos. | Alta | Frase de negocio: "La factura no cita una orden de compra registrada". |
| 5 | Detalle | "Documento no disponible" ocupa una tarjeta grande vacía. | Media | Si no hay archivo, colapsar a una línea. |
| 6 | Mesa | Gran vacío entre "Lo último" y el compositor; la mascota flota sola arriba a la izquierda. | Media | Mascota junto al saludo (misma fila); compositor más arriba o "Actividad reciente" en el hueco. |
| 7 | Mesa | Chip "0 Frenadas" en rojo genera alarma con valor cero. | Media | Conteos en cero, en gris neutro. |
| 8 | Mesa | "Correo conectado · revisado hace 4 s" se parte en dos líneas. | Baja | Una línea, texto más corto ("Correo · hace 4 s"). |
| 9 | Mesa | Con nada pendiente, la columna derecha es un gran espacio vacío. | Media | Auto-colapsar el panel o mostrar "Frenadas recientes". |
| 10 | Reglas | Cada regla ocupa 4 líneas; solo caben 4 en pantalla. | Media | Fila de 2 líneas: frase + meta; "Ver condición técnica" dentro del despliegue. |
| 11 | Reglas | Resumen de la regla 16 redundante ("cuando la factura tenga una orden de compra y la factura sobregire…"). | Media | El resumen omite condiciones de guarda (`orden_encontrada = true`). |
| 12 | Facturas | Filtro de fechas con inputs nativos "dd/mm/yyyy" que rompen el estilo. | Baja | Selector de rango con calendario (shadcn `calendar` + `popover`). |
| 13 | Facturas | Filas con altura distinta (con o sin equivalente en USD). | Baja | Altura fija; USD como tooltip o columna. |
| 14 | Costos | Ancho distinto al resto (≈800 px vs 1280 px) y la lista larga hace scroll de página. | Media | Mismo contenedor; lista con scroll interno y paginación. |
| 15 | Global | Moneda inconsistente: "US$" en Costos, "USD" en el resto. | Baja | Un solo formato (`USD`). |
| 16 | Global | Poco contraste entre fondo y tarjetas. | Media | Fondo gris, tarjetas blancas con sombra suave (aplicado en local, sin commit). |
| 17 | Global | Sin transición entre pantallas. | Baja | Fade + 6 px de subida, 220 ms, respetando reduced motion (aplicado en local, sin commit). |
| 18 | Global | Badge de notificaciones "9+" en marca aunque no hay nada pendiente. | Baja | Contar solo lo accionable (escaladas pendientes, propuestas). |

## Jerarquía visual
- **Lo primero que se ve**: Mesa, el saludo (correcto); Detalle, el título y monto (correcto, pero el estado real queda escondido); Reglas, el compositor (correcto).
- **Lectura**: Facturas y Directorio tienen un flujo limpio de izquierda a derecha. Detalle obliga a saltar entre tres tarjetas para entender "qué pasó": encabezado, tarjeta de aprobación y reglas.

## Consistencia
| Elemento | Problema | Arreglo |
|---|---|---|
| Ancho de página | Costos más angosto | `max-w-7xl` en todas |
| Moneda | US$ vs USD | `money()` en todas partes |
| Estados en cero | Color semántico con valor 0 | Gris neutro |

## Accesibilidad
- **Contraste**: textos `text-xs text-muted-foreground` sobre fondo gris quedan cerca del límite 4,5:1; oscurecer `--muted-foreground` (aplicado en local).
- **Objetivos táctiles**: iconos de navegación en móvil ≈32 px; subir a 40 px.
- **Legibilidad**: cuentas bancarias se parten a mitad de número; usar `font-mono` con `break-all` controlado o truncar con copiar.

## Lo que funciona
- Facturas: tabla clara, filtros y paginación en la URL, decisión y "Decidió: Tú / Agente" de un vistazo.
- Directorio: maestro-detalle bien resuelto, NIT/RFC/CNPJ/EIN por país.
- Reglas: frase de negocio como texto principal, filtros con iconos, compositor tipo conversación.
- Detalle: "Decisión determinista · sin IA" refuerza la confianza.

## Prioridades
1. **Limpiar reglas de test y blindar los tests** (#1): afecta decisiones reales.
2. **Detalle con estado final y lenguaje de negocio** (#2, #3, #4, #5): es la pantalla de Explicabilidad.
3. **Mesa sin vacíos** (#6, #7, #9): es la primera impresión del jurado.
4. **Reglas compactas** (#10, #11).
5. **Pulido global** (#12 a #18).
