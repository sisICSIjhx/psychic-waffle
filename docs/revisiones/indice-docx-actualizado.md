# Revisión con Codex — índice del DOCX ya resuelto

Cambio OpenSpec: `indice-docx-actualizado`. Rama: `feat/indice-docx`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con `-Cambio`
y como contexto la propuesta, el diseño y la spec de `generacion-documental` (ronda 2: diseño, spec y
el arnés de verificación). Ronda 1 sobre el rango f7610ab..4de9948. Codex no ejecutó comandos ni tocó
`insumos/`, `storage/` ni `.env*`.

## Ronda 1 (rango f7610ab..4de9948)

| Severidad | Hallazgo                                                                                                                         | Resolución                                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta      | La prueba rebajaba a 98,5 % el criterio de las semillas 25-104, que la spec fijaba en 99 %                                       | Se midió 98,9 % y se probaron varias reglas: la que corregía un caso rompía otro ya correcto. El criterio se ajustó en la spec y el diseño, y el usuario aceptó 98,5 % (2026-10-22); el total sigue en 99 % |
| Media     | En el modo `-- <docx…>` el arnés terminaba con código 0 aunque el índice guardado difiriera del actualizado                      | Corregido en a684867: sale con 1 si algún índice difiere                                                                                                                                                    |
| Media     | En el modo completo el arnés no validaba los criterios de D10 y siempre sobrescribía la calibración                              | Corregido en a684867: valida exactitud total y del subconjunto, documentos de prueba exactos y diferencias de más de una página; si algo falla escribe un resultado rechazado y sale con 1                  |
| Media     | Los anchos de Arial salían de `arial.ttf` de Windows, no de Arimo o Liberation como decía el diseño, y el encabezado lo ocultaba | Corregido en a684867: ninguna fuente libre equivalente está instalada y los avances son idénticos; el diseño y el encabezado generado dicen el origen real, con la misma aceptación que para Aptos          |

## Ronda 2 (commit a684867, última permitida)

| Severidad | Hallazgo                                                                                            | Resolución                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Alta      | Una corrida parcial (`--desde`/`--hasta`) podía cumplir los porcentajes y reemplazar la calibración | Solo una corrida con las semillas 1-104 completas reemplaza la calibración; el subconjunto se calcula únicamente sobre 25-104 |
| Media     | La spec volvía obligatorio el 98,5 % mientras el diseño lo daba como pendiente de aprobación        | El usuario lo aprobó el 2026-10-22 y el diseño lo registra                                                                    |

## Validación del cambio

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones. `npm run test`: 40
  archivos y 273 pruebas (anchos, sintéticos, salto forzado, portada e índice de 2 páginas, geometría,
  precisión contra la calibración, posproceso del índice, índice resuelto en el DOCX y caché que no
  reutiliza un DOCX v1).
- Paridad con el prototipo del análisis sobre las mediciones de Word de la v1: 284/284 y 482/485.
- `npm run verificar:indice` con Word 365 sobre la v2 (semillas 1-104 y los 3 documentos de prueba):
  1284 de 1295 títulos exactos (99,2 %; 98,9 % en 25-104), los 3 documentos de prueba exactos con su
  índice igual al actualizado y ninguna diferencia de más de una página. La portada se recalibró con
  43 portadas medidas en Word (40/40 correctas).
- Documento real del reporte emitido descargado desde la aplicación: índice resuelto con 6 entradas,
  sin `updateFields` ni `w:dirty`, e idéntico al que deja «Actualizar tabla» en Word.
