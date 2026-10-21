# Revisión con Codex — UX, especificación de las fases B y C

Cambio OpenSpec: `ux-editor-inicio-captura` (artefactos de planeación, sin código). Rama:
`feat/ux-fase-a`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con
`-Cambio` describiendo el bloque y como contexto el plan, la spec `captura-reportes` del cambio en
cierre y el código que el diseño cita (editor, cargas de `/` y `/captura`, dominio de captura y
planeación, repositorio de reportes y `0003_reportes.sql`). Codex no ejecutó comandos. Ninguna ronda
tocó `insumos/`, `storage/` ni `.env*`.

## Ronda 1 (commit 427d548)

| Severidad | Hallazgo                                                                                                                               | Resolución                                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Media     | `seccionDeCampo(campo)` no puede llegar al `id` del alcance: las observaciones traen el índice (`alcances.<i>.titulo`), no el UUID     | Corregido en 7a2b19e: `destinoDeObservacion(observacion, reporte)` toma `reporte.alcances[i].id` del mismo reporte validado; la tarea 1.5 lo prueba tras reordenar y quitar alcances |
| Media     | El selector solo miraba el estado del mes de referencia, así que una partida vencida en meses anteriores nunca aparecía como «Vencida» | Corregido: el grupo «Pendientes» reúne los vencidos anteriores (con su mes) y el estado del mes de referencia; nuevo requisito «Mes sugerido según el pendiente»; tareas 5.4 y 7.2   |
| Media     | Tomar solo los 100 borradores más recientes podía ofrecer «Capturar» aunque existiera un borrador, contra el requisito obligatorio     | Corregido: `listarTodos(filtro)` recorre todas las páginas del rango de meses con pendientes (D11 y D13); tarea 5.2 con una prueba de más de 100 borradores sobre PGlite             |

Validación: `openspec validate ux-editor-inicio-captura --strict` y `npm run spec:check` aprobados;
Prettier sobre los artefactos.

## Ronda 2 (commit 7a2b19e, última permitida)

| Severidad | Hallazgo                                                                                                                                  | Resolución                                                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Media     | Una partida pendiente con borrador cumplía las condiciones de «Pendientes» y de «Con borrador»: podía duplicarse o incumplir un escenario | Corregido: cada partida aparece una sola vez y «Con borrador» tiene precedencia, con su estado y mes pendientes; escenario «Partida pendiente con borrador», D13 y tarea 5.4 |

Validación final: `openspec validate ux-editor-inicio-captura --strict` y `npm run spec:check`
aprobados (3 elementos); Prettier sobre los artefactos. Sin una tercera ronda, por el límite de dos.
