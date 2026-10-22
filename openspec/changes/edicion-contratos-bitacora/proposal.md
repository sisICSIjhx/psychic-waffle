# Proposal

## Why

El usuario pidió un apartado para cambiar los datos de un contrato (firmas por defecto, número de
contrato y sitio) que pida confirmación y el motivo, que más adelante quede solo para los
administradores y que guarde quién hizo cada cambio. Hoy el catálogo no permite corregir el número, la
descripción ni la vigencia de un contrato, ni la clave o el nombre de un sitio, y «Editar» un firmante
reescribe el registro sin confirmación ni historial. Los contratos de Proagro y Virtual tienen datos
provisionales («PRO-AGRO-PRV-016-2026», «VIRTUAL-POR-CONFIRMAR»). El cambio
`importacion-programa-anual` ajusta la vigencia de Proagro antes de este cambio; las correcciones
posteriores de cualquier contrato pasan por este flujo y quedan en la bitácora.

## What Changes

**Comportamiento actual comprobado (2026-10-21, rama `feat/ux-fase-c`):**

- `/catalogo/contratos/[id]` (`src/lib/components/catalogo/ContratoView.svelte`): el encabezado del
  contrato es de solo lectura; en Sitios solo se elige o se asocia un sitio; en Firmantes, «Editar» y
  «Registrar» guardan al instante (`?/guardarFirmante`), sin confirmación, motivo ni historial.
- `api_guardar_contrato` (`supabase/migrations/0001_catalogo.sql`) con `id` cambia cliente, número,
  descripción y vigencia sin validar los reportes ni los programas que queden fuera; `api_guardar_sitio`
  con `id` renombra el sitio global; `api_guardar_firmante` reescribe el registro por `id`, lo que borra
  quién firmaba antes. `json_contrato`, `json_sitio` y `json_firmante` no exponen `actualizado_en`.
- Cada reporte copia al crearse el usuario, el número de contrato, el sitio y los firmantes vigentes del
  primer día del mes (`prellenarReporte` en `src/lib/dominio/captura.ts`); el DOCX solo usa esa copia;
  en el editor, usuario, contrato y sitio son de solo lectura; `api_crear_revision` copia el encabezado
  del original. No hay autenticación: `App.Locals` está vacío (`src/app.d.ts`) y no hay
  `src/hooks.server.ts`.

**Comportamiento propuesto:**

- **Datos del contrato:** sección con «Editar» para corregir número, descripción y vigencia. El cliente
  no cambia; una renovación u orden de compra nueva se registra como contrato nuevo. La vigencia nueva
  debe cubrir los meses con reportes, programas o meses programados.
- **Sitios:** «Corregir clave o nombre» de un sitio asociado (avisa si otros contratos lo comparten);
  asociar un sitio como hoy y «Quitar del contrato» solo si no tiene partidas, programas ni reportes en
  él. No se mueve un contrato a otro sitio.
- **Firmantes por defecto:** «Corregir datos» para errores de escritura del mismo registro y «Cambiar
  firmante desde…», que cierra la vigencia del anterior el día previo y registra al nuevo.
- **Confirmación:** antes de guardar una edición se calcula el cambio sin aplicarlo y se muestra un
  diálogo con antes → después, el impacto (borradores, en revisión, emitidos que conservan el dato,
  otros contratos del sitio), la casilla «Actualizar también los borradores» marcada y el motivo
  obligatorio. Los emitidos y sustituidos nunca cambian.
- **Bitácora:** tabla de solo agregar con cada alta y edición del contrato, sus sitios y sus firmantes
  (qué, antes → después, motivo, efectos, usuario y fecha), con usuario nulo mientras no haya
  autenticación; sección plegable «Historial de cambios» en el contrato.
- **Preparación para administradores:** el servidor decide con una sola función si la persona puede
  editar el catálogo (hoy, siempre); con autenticación, solo administradores. El usuario de la bitácora
  sale de la sesión, nunca del formulario.
- **Editor:** aviso «Los datos del contrato cambiaron» en un borrador cuya copia difiere del contrato
  vigente, con «Actualizar datos del contrato», que también sirve para las revisiones creadas después de
  una corrección.
- **BREAKING (contrato interno):** `api_guardar_contrato`, `api_guardar_sitio` y `api_guardar_firmante`
  quedan solo para altas; con `id` responden que se use la edición. Los scripts solo crean, salvo
  `npm run importar -- --programa --ajustar-vigencia` (cambio `importacion-programa-anual`), que pasa a la
  edición del contrato con motivo obligatorio (`--motivo`) y queda en la bitácora con origen script.

Fuera de alcance: autenticación y roles reales, editar el cliente o su razón social, equipos, partidas
y programa (tienen su propio flujo), mover datos de un sitio a otro y corregir ahora los datos
provisionales de Proagro o Virtual (se hará desde la interfaz cuando el usuario tenga los datos reales).

## Capabilities

### New Capabilities

- `catalogo-contratos`: se **agregan** requisitos de corrección del contrato, del sitio y de los
  firmantes con confirmación, motivo, bitácora e historial, y la preparación para administradores. Es
  la misma ruta de capacidad que define `reportes-mantenimiento-for-icsi-rmt-01` (sin archivar, por eso
  no está en `openspec/specs/`); este cambio solo usa `ADDED` y nombra en cada requisito el requisito
  anterior al que amplía o sustituye.
- `captura-reportes`: se **agregan** el aviso de datos del contrato cambiados y su actualización en el
  borrador. Es la ruta de capacidad de `reportes-mantenimiento-for-icsi-rmt-01` y
  `ux-editor-inicio-captura`; solo usa `ADDED`.

### Modified Capabilities

Ninguna en `openspec/specs/`.

## Impact

- Datos: migración `supabase/migrations/0018_bitacora_catalogo.sql` (tabla `cambios_catalogo` de solo
  agregar con RLS, columna `reportes.contrato_copia`, funciones `api_editar_contrato`,
  `api_editar_sitio`, `api_quitar_sitio`, `api_resumen_sitios_contrato`, `api_corregir_firmante`,
  `api_cambiar_firmante`, `api_listar_cambios_catalogo`, `api_estado_contrato_reporte` y
  `api_actualizar_contrato_reporte`, y
  nuevas definiciones de `api_guardar_contrato`, `api_guardar_sitio`, `api_guardar_firmante`,
  `api_asociar_sitio`, `json_contrato`, `json_sitio` y `json_firmante`). PGlite la aplica al abrir la
  base: hay que detener el servidor de desarrollo y respaldar `storage/pglite` antes.
- Código: `src/lib/dominio/esquemas.ts` y un módulo nuevo `src/lib/dominio/bitacora.ts`;
  `src/lib/server/repositorios/catalogo.ts` y `reportes.ts`; `src/lib/server/captura.ts`;
  `src/lib/server/permisos.ts` (nuevo) y `src/app.d.ts`; `src/routes/catalogo/contratos/[id]/` y
  `src/routes/reportes/[id]/`; `ContratoView.svelte` con componentes nuevos en
  `src/lib/components/catalogo/`; `src/lib/components/ui/Dialogo.svelte` (prop para deshabilitar
  «Confirmar»); `EditorReporte.svelte`; `scripts/importar-catalogo.ts` y `scripts/derivar-partidas.ts`
  (origen «script» en las altas; `--ajustar-vigencia` con `--motivo` por la edición del contrato).
- Sin dependencias nuevas. Rama `feat/edicion-contratos`, apilada sobre `feat/editor-fotos`.
