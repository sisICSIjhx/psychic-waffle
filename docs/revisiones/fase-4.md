# Revisión con Codex — Fase 4 (catálogo e importación)

Cambio OpenSpec: `reportes-mantenimiento-for-icsi-rmt-01`. Rama: `feat/reportes-rmt-01`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con
`design.md` y `tasks.md` como contexto. En cada ronda Codex intentó un comando (leer `AGENTS.md`
del directorio vacío), que falló por el sandbox de Windows. Ninguno tocó `insumos/`, `storage/` ni
`.env*`.

## Ronda 1 (commit d9aecde)

| Severidad | Hallazgo                                                                | Resolución                                                                                                                                                                                   |
| --------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta      | La reimportación borraba la descripción capturada de la partida         | Corregido en `0006`: el libro no trae descripción, así que no se compara ni se borra; con prueba                                                                                             |
| Alta      | La derivación cambiaba «ERM» por «EM» en la clave del sitio             | Corregido en parte: se conserva el prefijo tal como lo escriben los encabezados de los reportes (78 de 78 dicen «EM»; «ERM» solo aparece en carpetas). El usuario confirmó «EM» para Proagro |
| Alta      | Un mes realizado de una partida diaria contaba 1 frente a 31 programado | Corregido: el realizado cuenta lo mismo que lo programado según la periodicidad; con prueba                                                                                                  |
| Alta      | Las marcas R no se comparaban ni se retiraban al reimportar             | Corregido en `0006`: se comparan y se reemplazan; los realizados manuales se conservan; con prueba                                                                                           |
| Media     | El ensayo de `npm run importar` creaba o asociaba registros             | Corregido: el libro se analiza primero y el ensayo solo informa; probado con una base temporal                                                                                               |
| Media     | Un programa existente no actualizaba su fin de periodo                  | Corregido en `0006`: acción «actualizar» del programa; con prueba                                                                                                                            |
| Media     | No se podían editar equipos ni firmantes                                | Corregido: botón «Editar» por fila; el servidor exige que pertenezcan al contrato; probado en el navegador                                                                                   |

## Ronda 2 (commit 36f7d46, última permitida)

| Severidad | Hallazgo                                                                   | Resolución                                                                                           |
| --------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Media     | Los realizados importados se distinguían por el texto de la nota           | Corregido en `0008`: columna `origen` (manual o importación); con prueba de una nota manual idéntica |
| Media     | Las cantidades P/R se calculaban con la periodicidad del programa          | Corregido: se calculan después de conciliar con el catálogo, cuya frecuencia prevalece; con prueba   |
| Media     | Una clave EM ya registrada podía duplicarse si los reportes dijeran «ERM»  | Corregido: la derivación reutiliza el sitio con el mismo número si es el único                       |
| Media     | No se podía confirmar una importación que solo cambia el programa          | Corregido: un programa nuevo o con otro periodo cuenta como cambio en el resumen del ensayo          |
| Baja      | El panel de firmantes no se reabría al pulsar «Editar» después de cerrarlo | Corregido: el panel se abre explícitamente, igual que el de equipos                                  |

## Validación de la fase

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones.
- `npm run test`: todas las pruebas aprobadas, entre ellas las del importador con un `.xlsx`
  sintético versionado (estructura, columnas faltantes, idempotencia, reemplazo de partidas por
  confirmar, atomicidad, descripción conservada, marcas R, origen de realizados, periodo del
  programa y periodicidad conciliada), la lectura de un DOCX generado y la confirmación y el filtro.
- Base local (PGlite): importación del libro de Cerritos (55 partidas) y derivación de Proagro (55)
  y Virtual (37) por confirmar. Interfaz revisada en el navegador.
