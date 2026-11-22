## Motivo

Dirección entregó la matriz de lo que debe poder seguirse en cada centro de costo
(`docs/PLAN_KPI_CENTROS_COSTO.md`, apartado 1) y pidió que se traduzca en indicadores para ver el
estatus de cada centro. Las etapas 0 a 5 del plan de seguimiento ya capturan casi todo, pero el
concentrado solo mide ejecución, los conceptos de las plantillas no tienen significado para el
sistema y faltan varios datos de la matriz. Además, quien captura es personal operativo en campo:
las pantallas deben entenderse sin manual y usarse en el teléfono.

## Alcance

- Indicador, «por definir» y carpeta de cada concepto de plantilla; nivel «por partida».
- Seguimiento: reporte por partida, partidas escritas a mano también con programa anual, atenciones
  de emergencia con horario y personal, y carpeta con entrega, recepción y acuse.
- Contrato y cobranza: adicionales en todos los centros y monto cobrado derivado de la cobranza.
- Estatus del centro de costo: resumen por centro y mes, KPI, estatus general y «qué falta», en el
  concentrado de `/cumplimiento` y en `/seguimiento`.
- Pantallas `/seguimiento`, `/cobranza` y concentrado rediseñadas para teléfono y para personal
  operativo, dentro del sistema de diseño «Panel claro».
- Complemento de las plantillas existentes desde el archivo de `insumos/` (ensayo por omisión).

Fuera de alcance: alertas por correo, automatizaciones de la fase 2 (un reporte emitido que marca
su casilla), enlaces resueltos contra SharePoint y la carga de montos o contratos reales.

## Capacidades

- Nueva: `estatus-centros`.
- Modificadas: `seguimiento-operativo`, `contrato-cobranza` y `centros-costo-plantillas` (sus
  deltas van en la spec de este cambio, porque esas capacidades aún no están archivadas).

## Impacto

Migración 0028 (columnas en `plantilla_conceptos`, `seguimiento_actividades`,
`seguimiento_nocturnas` y `seguimiento_carpetas`; tablas `seguimiento_nocturna_personal` y
`adicionales`; función `api_estatus_centros` y nuevas versiones de las funciones `api_*` de
plantillas, seguimiento y contrato), repositorios, dominio `estatus.ts`, tres pantallas y el editor
de plantillas. Sin capacidades de rol nuevas: se reutilizan `editarSeguimiento`, `verContrato`,
`editarContrato` y `editarCobranza`. La base de trabajo se migra aparte, con respaldo y con la
autorización del usuario.
