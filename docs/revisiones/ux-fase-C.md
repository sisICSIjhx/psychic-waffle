# Revisión con Codex — UX, fase C (inicio «Mi trabajo» y captura)

Cambio OpenSpec: `ux-editor-inicio-captura` (tareas 5.1 a 8.1). Rama: `feat/ux-fase-c`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con `-Cambio`
describiendo la fase. Contexto de la ronda 1: el plan (`docs/PLAN_DISENO_UX.md`) y los artefactos del
cambio (propuesta, diseño, specs `mi-trabajo` y `captura-reportes` y tareas); la ronda 2 agregó la
migración `0013` y el repositorio de reportes, que las correcciones modifican. La ronda 1 revisó el
rango completo de la fase con `-Base`. Codex no ejecutó comandos en ninguna ronda y ninguna tocó
`insumos/`, `storage/` ni `.env*`.

## Ronda 1 (rango 5d221c3..4afdd7f)

| Severidad | Hallazgo                                                                                                                                                                               | Resolución                                                                                                                                                                                                                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Media     | `api_listar_reportes` ordenaba por `periodo_mes` y `actualizado_en`, un orden no total: con empates en el límite de una página, `OFFSET` podía repetir u omitir filas en `listarTodos` | Corregido en ae55b7e con la migración `0014_listar_reportes_orden_estable.sql` (la `0013` ya estaba aplicada por nombre en la base de desarrollo): desempate por `id` al paginar y al agregar. Prueba con 105 borradores y la misma fecha de actualización; en PGlite también pasa sin la `0014` (el orden es estable de hecho), así que protege la regla, no reproduce el fallo |
| Media     | En el selector, `aria-selected` seguía a la opción activa y no a la elegida: al volver a abrir, el lector de pantalla no anunciaba la partida seleccionada                             | Corregido en ae55b7e: `aria-selected` refleja el valor elegido y la opción activa se sigue anunciando con `aria-activedescendant`; la prueba de teclado comprueba ambos                                                                                                                                                                                                          |

La autorrevisión de la fase encontró cuatro puntos más:

| Severidad | Hallazgo                                                                                                                                                            | Resolución                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Media     | Con varios contratos, la captura no resumía el contexto aunque contrato y sitio ya vinieran elegidos (desde «Mi trabajo» o la planeación)                           | Corregido en 4d8677e: el resumen con «Cambiar» aparece siempre que ambos estén resueltos; con prueba             |
| Media     | La prueba de la captura enviaba el formulario por `use:enhance` al servidor de Vite de las pruebas (`POST /` con error 500)                                         | Corregido en cf59a3d: la prueba intercepta los envíos en la fase de captura; la suite ya no genera peticiones    |
| Media     | Contraste bajo AA en la etiqueta del resumen del contexto (4.04 y 4.34) y en la periodicidad de la opción activa del selector (4.26 y 4.11)                         | Corregido en 4afdd7f: la etiqueta usa el fondo de la página y el detalle de la opción activa, el color del texto |
| Baja      | En «Mi trabajo», un filtro sin resultados (por ejemplo, `?ver=vencidos` sin vencidos) decía «El trabajo programado está al día» aunque hubiera trabajo de otro tipo | Corregido en ae55b7e: muestra «No hay pendientes vencidos por ahora.»; con prueba                                |

## Ronda 2 (commit ae55b7e, última permitida)

Codex no informó hallazgos: las correcciones estabilizan la paginación, distinguen la opción activa de
la elegida y corrigen el mensaje del filtro vacío.

## Validación de la fase

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones. `npm run test`: 34
  archivos y 213 pruebas aprobadas, sin peticiones al servidor de Vite. Nuevas o ampliadas: partida y
  sitio en el historial y `listarTodos` con más de 100 borradores (también con empates) sobre PGlite;
  siguiente trabajo (urgencia, lo que falta y borradores por partida, mes y ocurrencia); búsqueda sin
  acentos ni mayúsculas, agrupación y mes sugerido; carga de la captura sobre PGlite; «Mi trabajo»
  (avance, sin programas, tarjetas, lista, «Ver todos», filtro vacío y «al día»); selector con teclado
  y roles ARIA; captura (resumen del contexto, grupos, envío al elegir, mes sugerido, aviso de borrador
  existente y de otro TAG).
- Auditoría en Chromium contra el servidor de desarrollo (6 vistas × 2 anchos × 2 temas, más la
  captura con la lista abierta y con una partida elegida): tras las correcciones de contraste, 0 textos
  bajo AA, 0 bordes de campo bajo 3:1, 0 objetivos bajo 24 px y 0 desbordes. La auditoría se hizo antes
  de ae55b7e, que solo cambia un atributo ARIA, un mensaje con un estilo existente y el orden SQL.
- Recorrido en el navegador sobre los datos reales con todas las peticiones POST bloqueadas (ninguna
  se emitió): «Continuar borrador» abre el editor en un clic; «Capturar» abre la captura con contrato,
  sitio, partida y mes elegidos, y «Crear reporte» es el segundo clic; el enlace «Capturar» de la
  planeación llega igual; la búsqueda por actividad encuentra la partida y los grupos «Con borrador»,
  «Pendientes» y «Otras partidas» aparecen en ese orden. Las capturas quedan fuera del repositorio
  porque muestran datos de los reportes.
- Hallazgos A del plan: H1 (selector con búsqueda, pendientes primero y aviso de existente) queda
  resuelto; también H8 (panel con jerarquía y acciones), de prioridad media.
- La migración `0014` quedó aplicada en la base de desarrollo al reiniciar el servidor: figura en
  `interno.migraciones` y `api_listar_reportes` desempata por `id`.
