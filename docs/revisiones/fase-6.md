# Revisión con Codex — Fase 6 (planeación anual, historial y panel)

Cambio OpenSpec: `reportes-mantenimiento-for-icsi-rmt-01`. Rama: `feat/reportes-rmt-01`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con
`design.md`, `tasks.md` y las specs del programa anual y de la captura (historial) como contexto.
Codex no ejecutó comandos. Ninguna ronda tocó `insumos/`, `storage/` ni `.env*`.

## Ronda 1 (commit 3b34299)

| Severidad | Hallazgo                                                                         | Resolución                                                                                               |
| --------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Media     | El R de cada celda enlazaba al historial aunque incluyera realizados sin reporte | Corregido: R se muestra como texto y el enlace lleva solo a los reportes emitidos; con prueba            |
| Baja      | Una página del historial que ya no existe dejaba la vista sin navegación         | Corregido: el servidor muestra la última página con resultados y la paginación aparece aunque esté vacía |
| Baja      | Meses imposibles en la URL (`2026-13`) llegaban a la consulta                    | Corregido: solo se aceptan meses del 01 al 12                                                            |

## Ronda 2 (commit 8917f98, última permitida)

| Severidad | Hallazgo                                                     | Resolución                                                                                                                       |
| --------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Media     | «Sin reporte» se calculaba restando documentos a ejecuciones | Corregido en `0012`: cada celda trae aparte las ejecuciones con reporte y lo realizado sin reporte (Excel o manual); con pruebas |

## Validación de la fase

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones.
- `npm run test`: todas las pruebas aprobadas, entre ellas el dominio de planeación (estados de celda,
  vencidos, filtros, resumen del mes), los filtros del historial y el desglose del realizado sobre
  PGlite, y los componentes de planeación, historial y panel en Chromium.
- Navegador con la base local: matriz de Cerritos, captura desde una celda con partida y mes
  preseleccionados, historial filtrado y panel con los indicadores del mes.
