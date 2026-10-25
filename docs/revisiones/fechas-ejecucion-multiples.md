# Revisión con Codex — varios días de ejecución

Cambio OpenSpec: `fechas-ejecucion-multiples`. Rama: `feat/fechas-multiples`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con `-Cambio`
y como contexto la propuesta, el diseño y las tres specs del cambio. Rango 1da0f2e..a1a932a. Codex no
ejecutó comandos ni tocó `insumos/`, `storage/` ni `.env*`.

## Ronda 1 (rango 1da0f2e..a1a932a)

Codex no informó hallazgos de corrección, seguridad, pérdida de datos ni contradicciones con la
propuesta, el diseño o los requisitos. No hizo falta una segunda ronda.

## Autorrevisión

| Severidad | Hallazgo                                                                                                                                                                   | Resolución                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Alta      | La sentencia reactiva que pasaba el texto del campo al reporte también se ejecutaba cuando los días cambiaban desde fuera, así que «Agregar hoy» y «Deshacer» se revertían | El texto pasa al reporte solo desde el evento `input` del campo; prueba de «Agregar hoy», «Todo el periodo» y «Deshacer» |
| Baja      | En escritorio el campo de días quedaba en una columna estrecha y «Todo el periodo» se partía en dos renglones                                                              | El campo ocupa dos columnas desde 1000 px y los botones no se parten; revisado a 1366 px en temas claro y oscuro         |

## Validación del cambio

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones. `npm run test`: 38
  archivos y 261 pruebas. Nuevas: analizador y utilidades de días, formato de la fila Fecha, varios
  días y ruta heredada en la base, revisión con los mismos días, conteo por día de las diarias, relleno
  de 0016 sin cambiar versión ni fecha de actualización, campo de días en el editor (vista previa,
  errores, texto inválido sin autoguardado, «Agregar hoy», «Todo el periodo» con «Deshacer») y captura
  de una diaria por mes o por semana.
- `npm run prueba:documental`: la celda Fecha del documento de volumen alto dice
  «15, 16, 20-25 / MAYO / 2026».
- Base de desarrollo: respaldo de `storage/pglite` (1078 archivos, idéntico) y 0016 aplicada al
  iniciar el servidor; los 3 reportes tienen su día como segmento y conservan versión y fecha de
  actualización.
- Navegador (1366 × 800, temas claro y oscuro, POST bloqueados): auditoría del editor y la captura sin
  fallos de contraste, bordes, objetivos ni desborde; el campo normaliza «15 y 16, 20 al 25» a
  «15, 16, 20-25» con su vista previa, muestra «El día 07 se repite.» y la partida 33 diaria ofrece
  «Mes completo | Por semana».
