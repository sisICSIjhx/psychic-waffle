# Revisión con Codex — UX, fase B (editor del reporte)

Cambio OpenSpec: `ux-editor-inicio-captura` (tareas 1.1 a 4.1). Rama: `feat/ux-fase-b`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con `-Cambio`
describiendo la fase y como contexto el plan (`docs/PLAN_DISENO_UX.md`) y los artefactos del cambio
(propuesta, diseño, spec `captura-reportes` y tareas). La ronda 1 revisó el rango completo de la fase
con `-Base`. Ninguna ronda tocó `insumos/`, `storage/` ni `.env*` (en la ronda 1 Codex ejecutó un
comando, sin rutas excluidas).

## Ronda 1 (rango e77f330..2e08365)

| Severidad | Hallazgo                                                                                                                                | Resolución                                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Media     | Al cerrar o recargar la pestaña dentro del plazo de deshacer, el editor descartaba la baja: la foto o el alcance reaparecían, contra D4 | Corregido en 20b1160: en `pagehide` (solo ocurre si la salida se confirmó) las bajas pendientes se aplican y se guardan con un envío `keepalive`; D4 y sus riesgos actualizados; con prueba |

La autorrevisión del mismo diff encontró cinco puntos más, corregidos en el mismo commit:

| Severidad | Hallazgo                                                                                                                                                           | Resolución                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Alta      | Una sección abierta por un pendiente (firmas, objetivo) se cerraba en cuanto se resolvía el último, a mitad de la escritura, y el campo perdía el foco             | Reproducido con una prueba; la sección queda abierta hasta «Listo»                                       |
| Media     | Si el guardado previo a subir una foto fallaba, el archivo se omitía sin aviso, contra el requisito de informar cada rechazo con su causa                          | Cada archivo no subido se informa con su causa; con prueba                                               |
| Media     | Al dejar de reintentar en bucle tras un fallo, un guardado sin red no se recuperaba solo al volver la conexión                                                     | El evento `online` reintenta el guardado fallido; con prueba                                             |
| Media     | Soltar una foto fuera de la zona hacía que el navegador abriera el archivo y abandonara el editor                                                                  | La página ignora los archivos soltados fuera de una zona de fotos; con prueba                            |
| Media     | Las pruebas con fotos pedían imágenes al servidor de Vite de las pruebas, que intentaba abrir `storage/pglite` (fallaba antes de abrirla, pero el riesgo era real) | El editor recibe `conImagenes` y las pruebas lo desactivan; la suite ya no genera peticiones al servidor |

## Ronda 2 (commit 20b1160, última permitida)

Codex no informó hallazgos: las correcciones son coherentes con el diseño y los requisitos.

## Validación de la fase

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones (con el
  `.gitattributes` de la fase A). `npm run test`: 28 archivos y 181 pruebas aprobadas. Nuevas o
  ampliadas: destino y completitud de pendientes (también tras reordenar y quitar alcances), diálogo
  (foco y `Esc`), notificaciones con deshacer, botones segmentados con teclado, textos de rango y hora
  relativa, y en el editor: resumen enlazado al enviar con datos faltantes, error de la fecha al salir
  del campo, «Hoy» dentro y fuera del periodo, guardado con hora y reintento sin bucle, índice con
  completitud, firmas como resumen, verificación segmentada, quitar con deshacer (antes y después del
  autoguardado y al vencer el plazo), bajas aplicadas al enviar, salir y cerrar la pestaña, progreso
  «Cargando n de N» con un rechazo intermedio, emisión con diálogo y descarga con motivo.
- Auditoría en Chromium contra el servidor de desarrollo (6 vistas × 2 anchos × 2 temas): 0 textos
  bajo AA, 0 bordes de campo bajo 3:1, 0 objetivos bajo 24 px y 0 desbordes. Barra del editor: 62 px
  en escritorio; 96 px en móvil (118 px solo cuando falta la fecha y se muestra el motivo de la
  descarga).
- Revisión visual sobre el reporte real con todas las peticiones POST bloqueadas (ninguna se emitió):
  verificación segmentada, aviso con «Deshacer», resumen de pendientes, índice fijo y motivo de la
  descarga. Las capturas quedan fuera del repositorio porque muestran datos de los reportes.
- Hallazgos A del plan en el editor: H2 (índice, completitud y resumen enlazado), H11 (sin `confirm()`
  en ningún componente) y H12 (descarga siempre visible con motivo) quedan resueltos.
