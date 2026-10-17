Reglas del MVP

Beneficiario

El beneficiario no está en la lista permitida → ESCALAR.
El beneficiario está bloqueado → FRENAR.
La cuenta bancaria de la factura no coincide con la registrada → ESCALAR.

Montos
4. El monto supera el límite por pago → ESCALAR.
5. El monto es mayor o igual al umbral de aprobación humana → ESCALAR (siempre, sin excepción).
6. El acumulado del mes más esta factura supera el límite del periodo → ESCALAR.
7. El presupuesto disponible del periodo no alcanza → FRENAR.

Duplicados
8. Mismo número de factura y mismo beneficiario ya registrados → FRENAR.
9. Mismo beneficiario y mismo monto en los últimos 30 días → ESCALAR.

Lo acordado
10. El monto se sale de la tolerancia del contrato (±5%) → ESCALAR.
11. La moneda no es la pactada → ESCALAR.

Calidad del dato
12. Falta beneficiario, monto, moneda o fecha → ESCALAR.
13. La fecha de la factura es futura o tiene más de 90 días → ESCALAR.

Si ninguna se dispara → PAGAR.

Prioridad del resultado: FRENAR > ESCALAR > PAGAR. Toda regla disparada queda en el registro con valor observado y valor límite.