# Proposal

## Why

Un reporte FOR-ICSI-RMT-01 puede cubrir varios días de ejecución («05-08 / MAYO / 2026», «02, 03, 04 /
MAYO / 2026» o «15, 16, 20-25 / MAYO / 2026»), pero el sistema solo guarda una fecha. Los reportes
reales de Cerritos ya traen varios días (partidas 02, 10, 14, 33, 35 y 40), y las partidas diarias
(Cerritos 2, 33, 35, 40 y 47) no se pueden reportar por mes o por semana: hoy exigen un reporte por
día y la planeación contaría 1 de 31 aunque el reporte cubra el mes completo.

## What Changes

**Comportamiento actual comprobado (2026-10-21, rama `feat/ux-fase-c`):**

- Base: `reportes.fecha_ejecucion date` (una sola fecha) con el check `reportes_fecha_en_periodo`, que
  solo controla el mes; `api_cambiar_estado` rechaza enviar o emitir sin fecha (IC422,
  `campos: ['fechaEjecucion']`); `api_crear_revision` copia esa fecha.
- Dominio: `validarParaRevision` (`src/lib/dominio/captura.ts`) exige una fecha AAAA-MM-DD dentro del
  periodo (mes, semana o quincena); `tipoOcurrencia` obliga a las partidas diarias a elegir un día y
  `rangoDelPeriodo` reduce su periodo a ese día.
- Editor (`EditorReporte.svelte`): `<input type="date">` con mínimo y máximo del periodo, «Hoy» y la
  ayuda «Periodo: …»; «Descargar DOCX» queda deshabilitado con «Indique la fecha de ejecución».
- DOCX: `fechaEncabezado` imprime «18 / MAYO / 2026» en la fila Fecha; la plantilla recibe texto ya
  formado. El nombre del archivo y el título de la portada usan el periodo, no la fecha.
- Planeación: `v_ejecuciones_reportes` cuenta una ejecución por ocurrencia distinta de los reportes
  emitidos, también en las partidas diarias.

**Comportamiento propuesto:**

- **Días de ejecución:** cada reporte guarda uno o más segmentos (un día o un rango de días seguidos)
  del mes de su periodo, en orden y sin repetir días; la forma capturada se respeta («02, 03, 04» no
  se convierte en «02-04»). La primera y la última fecha se derivan para filtros y compatibilidad.
- **Validación:** para enviar a revisión o emitir hace falta al menos un día y todos deben caer en el
  periodo del reporte (mes, semana o quincena); los días nunca cruzan de mes. Una revisión copia
  todos los días de su original.
- **Captura en el editor:** campo de texto «Días de ejecución» que acepta «15, 16, 20-25», «05-08»,
  «1 al 3», «02 03 04» o «15 y 16», con vista previa «En el documento: …», errores en línea y los
  atajos «Agregar hoy» y «Todo el periodo». Un texto inválido no se autoguarda ni se pierde.
- **DOCX:** la fila Fecha imprime los días con dos dígitos, «, » entre segmentos, «-» en los rangos y
  « / MES / AAAA» (mes en mayúsculas). Un solo día sale exactamente igual que hoy. La plantilla y su
  versión no cambian.
- **Partidas diarias:** al crear el reporte se elige «Mes completo» o «Por semana»; en la planeación
  cada día distinto cubierto por un reporte emitido cuenta como una ejecución.
- **Datos existentes:** la migración convierte cada fecha guardada en un segmento de un día sin
  cambiar la versión ni la fecha de actualización de los reportes; los DOCX ya generados siguen
  siendo válidos.

Fuera de alcance: días de dos meses en un mismo reporte, calendario de selección múltiple, leer la
fecha al importar reportes Word existentes y controlar las fechas escritas en el texto libre del
cuerpo.

Decisiones aplicadas (2026-10-21; el detalle está en `design.md`): respetar la forma capturada,
formato « / MES / AAAA», días dentro del periodo sin cruzar de mes, campo de texto con vista previa y
atajos, y partidas diarias por mes o por semana con conteo por día (esta última, del usuario).

## Capabilities

### New Capabilities

- `captura-reportes`: se **agregan** requisitos de días de ejecución, su captura en el editor y el
  periodo de las partidas diarias. Es la ruta de capacidad que definen los cambios sin archivar
  `reportes-mantenimiento-for-icsi-rmt-01` y `ux-editor-inicio-captura`; este cambio solo usa `ADDED`
  y cada requisito nombra el requisito anterior al que amplía o sustituye.
- `generacion-documental`: se **agrega** el formato de la fila Fecha con varios días (amplía
  «Contenido y orden de secciones» de `reportes-mantenimiento-for-icsi-rmt-01`).
- `programa-anual`: se **agrega** el conteo por día de las partidas diarias (amplía «Realizado
  derivado de los reportes» de `reportes-mantenimiento-for-icsi-rmt-01`).

### Modified Capabilities

Ninguna en `openspec/specs/` (solo contiene `memoria-proyecto`).

## Impact

- Datos: migración `supabase/migrations/0016_dias_ejecucion.sql` (columnas `dias_ejecucion` y
  `fecha_ejecucion_fin`, validación, trigger, relleno, envolturas de `json_reporte`,
  `api_insertar_reporte` y `api_guardar_reporte`, `api_cambiar_estado` y `v_ejecuciones_reportes`).
  Se aplica al reiniciar el servidor de desarrollo, con el servidor detenido y `storage/pglite`
  respaldado antes.
- Contrato: `diasEjecucion` y `fechaEjecucionFin` en `src/lib/dominio/esquemas.ts`; `fechaEjecucion`
  queda de solo lectura; `ReporteDocumento.encabezado.dias` en
  `src/lib/server/documentos/generar.ts` y los datos de `scripts/datos-prueba/`.
- Código: módulo nuevo `src/lib/dominio/dias-ejecucion.ts`, `src/lib/dominio/captura.ts`,
  `src/lib/dominio/documento.ts`, `src/lib/server/captura.ts`,
  `src/lib/components/reportes/EditorReporte.svelte`, `src/lib/components/views/CapturaView.svelte` y
  `src/routes/captura/+page.server.ts`, con sus pruebas.
- Orden: se apila sobre `importacion-programa-anual` (rama `feat/programa-anual`, migración `0015`).
  Con la convención de `design.md` (D3), `editor-fotos` (`0017`) volverá a envolver
  `api_guardar_reporte` (→ `api_guardar_reporte_0016`) y envolverá por primera vez `api_crear_revision`
  (→ `api_crear_revision_0003`); `tablero-cumplimiento` (`0019`) envolverá `json_reporte`
  (→ `json_reporte_0016`) y `api_crear_reporte` y redefinirá `v_ejecuciones_reportes` sobre la de este
  cambio. `edicion-contratos-bitacora` (`0018`) no envuelve funciones del reporte: usa un trigger.
- Sin dependencias nuevas.
