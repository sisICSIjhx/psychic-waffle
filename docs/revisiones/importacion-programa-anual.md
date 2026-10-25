# Revisión con Codex — importación de programa anual

Cambio OpenSpec: `importacion-programa-anual`. Rama: `feat/programa-anual`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con `-Cambio`
y como contexto la propuesta, el diseño y las specs del cambio (ronda 2: el diseño, la spec de
programa, la migración `0015` y el analizador). La ronda 1 revisó el rango 6dacbe2..9a7b640 (sin el
commit de las especificaciones). Codex no ejecutó comandos y ninguna ronda tocó `insumos/`, `storage/`
ni `.env*`.

## Ronda 1 (rango 6dacbe2..9a7b640)

| Severidad | Hallazgo                                                                                                                                        | Resolución                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta      | Acortar el periodo de un programa existente fallaba: `validar_programa` rechazaba el nuevo fin antes de reemplazar los meses que quedaban fuera | Corregido en 40f0730: antes de actualizar el fin se quitan los meses y las R importadas posteriores de las partidas del libro; las de otras partidas siguen protegidas por el trigger. Con prueba |
| Media     | Al cambiar la periodicidad con `--periodicidad` se perdía el número de marcas de cada mes (una mensual pasada a semanal contaba 1)              | Corregido en 40f0730: el análisis conserva las marcas por mes de las filas P y R y recalcula desde ellas. Con prueba                                                                              |
| Baja      | Una partida nueva no mostraba «antes → después» en el resumen                                                                                   | Corregido en 40f0730: muestra «— → valor» en periodicidad y cantidad. Con prueba del componente                                                                                                   |
| Baja      | La validación de la extensión aceptaba cualquier carácter antes de «xlsx» (`/.xlsx$/`)                                                          | Corregido en 40f0730 (`/\.xlsx$/`): la barra invertida se perdió al reescribir la acción                                                                                                          |

## Ronda 2 (commit 40f0730, última permitida)

| Severidad | Hallazgo                                                                                                                                                 | Resolución                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Media     | Al cambiar la periodicidad solo se regeneraba la advertencia de la suma; faltaban «varias marcas en un mes» y «meses sin marca» de la nueva periodicidad | Corregido en a257026: `advertenciasDePeriodicidad` genera las tres advertencias y se usa al analizar y al ajustar. Con prueba (semanal → mensual) y verificado con el libro real |

## Validación del cambio

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones. `npm run test`: 36
  archivos y 241 pruebas antes de las correcciones; las suites de importación y del catálogo (51 y 49
  pruebas) pasan después de cada corrección.
- Libro real de Proagro (fuera del repositorio): EM-30184 con 31 partidas y 446 programados, EM-30185
  con 25 partidas y 278, periodo 2026-03-01 a 2027-02-28 y las diferencias previstas en D12.
- Carga en la base de desarrollo con el servidor detenido y respaldo previo de `storage/pglite`
  (1077 archivos, idéntico): ensayo y aplicación por sitio, y una segunda ejecución sin cambios.
  Verificación por GET de `/planeacion` y `/captura`.
- Navegador (Playwright, 1366 × 800, temas claro y oscuro, solo el POST del ensayo permitido): el
  ensayo del libro real en la pantalla del contrato muestra el resumen del programa sin desborde
  horizontal; la planeación de los dos sitios carga sin desborde. Las capturas quedan fuera del
  repositorio.
