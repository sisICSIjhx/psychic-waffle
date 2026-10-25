# Design

## Context

Motivación y alcance en `proposal.md`; requisitos en `specs/catalogo-contratos/spec.md` y
`specs/captura-reportes/spec.md`. Estado de partida comprobado en `feat/ux-fase-c` (2026-10-21):

- `src/routes/catalogo/contratos/[id]/+page.server.ts` carga el contrato buscándolo en
  `listarContratos()` (no hay `api_obtener_contrato`), sus sitios, partidas, equipos, firmantes y
  programas. Acciones: `asociarSitio` (crea o asocia), `guardarEquipo`, `guardarFirmante` (alta o
  reescritura por `id`), `confirmarPartida`, `importarEnsayo` e `importarAplicar`. La vista es
  `src/lib/components/catalogo/ContratoView.svelte` (sintaxis heredada).
- `src/lib/server/repositorios/catalogo.ts` llama a `api_guardar_contrato`, `api_guardar_sitio`,
  `api_asociar_sitio` y `api_guardar_firmante` de `supabase/migrations/0001_catalogo.sql`. Las ramas
  con `id` actualizan sin validar ni registrar; el trigger `validar_firmante` impide traslapes por
  función y contrato. Los sitios son globales y se comparten por `contrato_sitios`; partidas, programas
  y reportes tienen llaves `restrict` hacia contrato y sitio.
- Cada reporte copia el encabezado al crearse (`prellenarReporte` en `src/lib/dominio/captura.ts`,
  firmantes vigentes del primer día del mes en `src/lib/server/captura.ts`); `0003_reportes.sql` lo
  documenta como copia que «conserva lo emitido». El DOCX se reutiliza mientras no cambien la versión
  del reporte y la plantilla. `api_crear_revision` copia el encabezado del original.
- Hay un precedente de aviso explícito: `catalogoHuella` (`0007_captura.sql`), `estadoCatalogo` y
  `aplicarCatalogo` en `src/lib/server/captura.ts`, el aviso en `EditorReporte.svelte` y la acción en
  `src/routes/reportes/[id]/+page.server.ts`. También hay precedente de ensayo antes de aplicar
  (`api_importar_catalogo` y `ResumenImportacion.svelte`).
- Seguridad: `0004_rls.sql` activó RLS en las tablas que existían; `repositorios.spec.ts` exige RLS en
  todas las tablas de `public`. El servidor usa la clave de servicio (`src/lib/server/datos.ts`), que se
  salta RLS. No hay autenticación (`src/app.d.ts` sin `Locals`, sin `src/hooks.server.ts`).
- Este cambio se apila sobre `importacion-programa-anual` (0015, ajusta la vigencia de Proagro con
  `npm run importar -- --programa --ajustar-vigencia`, que llama a `guardarContrato` con `id`, crea sus
  programas y deja en `ContratoView.svelte` la sección «Importar catálogo o programa desde Excel» con
  `ResumenPrograma.svelte`), `fechas-ejecucion-multiples` (0016, envuelve `json_reporte`,
  `api_insertar_reporte` y `api_guardar_reporte`) y `editor-fotos` (0017, redefine `json_foto` y envuelve
  `api_guardar_reporte` y `api_crear_revision`). Su migración es `0018_bitacora_catalogo.sql`.

## Goals / Non-Goals

**Goals:**

- Que toda alta o edición del contrato, sus sitios y sus firmantes pase por funciones SQL que validan y
  escriben la bitácora en la misma transacción.
- Que la vista previa del diálogo y la aplicación usen exactamente la misma lógica.
- Que los borradores y las revisiones puedan tomar los datos corregidos sin perder lo escrito a mano, y
  que nada emitido cambie.
- Dejar un solo punto de decisión de permisos listo para la autenticación.

**Non-Goals:**

- Autenticación, tabla de perfiles y roles reales; solo se prepara el punto de decisión.
- Editar el cliente o su razón social, equipos, partidas o programas; mover datos de un sitio a otro.
- Bitácora de partidas, equipos o importaciones (siguen sus flujos actuales).
- Que el historial global muestre el dato corregido en reportes ya creados: sigue mostrando la copia de
  cada reporte (`HistorialView.svelte`).
- Corregir ahora los datos provisionales de Proagro o Virtual: lo hará el usuario desde la interfaz.

## Decisions

### D1. Funciones de edición explícitas con la bitácora en la misma transacción

Funciones `jsonb → jsonb` con el patrón `api_*`: `api_editar_contrato` {id, actualizadoEn, numero,
descripcion, vigenciaInicio, vigenciaFin}, `api_editar_sitio` {id, contratoId, actualizadoEn, clave,
nombre}, `api_quitar_sitio` {contratoId, sitioId}, `api_corregir_firmante` {id, contratoId,
actualizadoEn, nombre, cargo, empresa, vigenteDesde, vigenteHasta} y `api_cambiar_firmante` {id del
actual, contratoId, actualizadoEn, desde, nombre, cargo, empresa}. Todas aceptan además `motivo`,
`actualizarBorradores`, `ensayo`, `usuarioId`, `usuarioTexto` y `origen`, y devuelven {ensayo,
cambios: [{campo, antes, despues}], impacto, aplicado?: {cambioId, borradoresActualizados,
borradoresConAviso}} más la entidad resultante. Orden interno: bloquear la fila (`for update`),
comprobar `actualizadoEn`, validar, calcular cambios (sin cambios → IC422 `sin_cambios`), aplicar,
propagar (D8) y escribir la bitácora.
Alternativas descartadas: triggers `AFTER UPDATE` que leen el motivo de `set_config` (opacos, se
comportan distinto en PGlite y en el RPC de Supabase y romperían los scripts), y registrar desde
TypeScript después de guardar (no es atómico: puede quedar un cambio sin registro).

### D2. Tabla `cambios_catalogo` de solo agregar

Columnas: `id`, `entidad` (`contrato`, `sitio`, `firmante`, `contrato_sitio`), `entidad_id`,
`contrato_id` (contrato desde el que se hizo; `on delete restrict`), `accion` (`crear`, `editar`,
`reemplazar`, `asociar`, `quitar`), `cambios jsonb` (arreglo {campo, antes, despues}), `motivo` (nulo
o de 10 a 500 caracteres tras `btrim`; obligatorio en `editar`, `reemplazar` y `quitar`, lo exige la
función), `efectos jsonb` (ids de borradores actualizados y con aviso, conteos de en revisión,
emitidos y sustituidos, otros contratos del sitio, firmante anterior), `usuario_id uuid` nulo,
`usuario_texto` nulo, `origen` (`interfaz`, `script`) y `realizado_en`. Índices (`contrato_id`,
`realizado_en desc`) y (`entidad`, `entidad_id`, `realizado_en desc`). Un trigger rechaza `UPDATE`,
`DELETE` y `TRUNCATE`. La migración activa RLS, crea la política `servicio_acceso_total` si existe
`service_role`, revoca la tabla a `anon` y `authenticated` y termina con el bloque de permisos de
`0007_captura.sql`. Una fila por operación (con un solo motivo) en lugar de una por campo: la
inserción es una sola y el historial expande `cambios` al mostrarlo.

### D3. Ensayo con la misma lógica y reversión

Con `ensayo` (verdadero por omisión, como `api_importar_catalogo`), la función ejecuta todo dentro de un
bloque `begin … exception` y al final lanza un código propio reservado para el ensayo; el bloque lo
atrapa, la base revierte los cambios y la función devuelve lo calculado en variables de PL/pgSQL, que
no se revierten. Así la vista previa pasa por los mismos triggers (traslape de firmantes, unicidad de
sitio y número) y da los mismos conteos que la aplicación. Cualquier otro error se propaga.
Alternativa descartada: escrituras condicionales como en la importación: duplica el cálculo del
impacto y no ejecuta los triggers de validación.

### D4. Altas registradas y caminos sin bitácora cerrados

`0018` redefine, sobre la última definición vigente en `0001…0017`, `api_guardar_contrato`,
`api_guardar_sitio` y `api_guardar_firmante` solo para altas: con `id` responden IC422
`usar_edicion`. Cada alta, y `api_asociar_sitio` cuando inserta la asociación, escribe la bitácora con
motivo opcional y `origen` recibido (`interfaz` por omisión). `ContratoEntrada`, `SitioEntrada` y
`FirmanteEntrada` dejan de aceptar `id`, así `npm run check` señala cualquier llamador que actualice.
`scripts/importar-catalogo.ts` y `scripts/derivar-partidas.ts` pasan `origen: 'script'`. El único
llamador con `id` conocido es `--ajustar-vigencia` de `scripts/importar-catalogo.ts` (D10 de
`importacion-programa-anual`): pasa a `editarContrato` con `origen: 'script'`, el motivo de una opción
nueva `--motivo` (obligatoria con `--ajustar-vigencia`) y el ensayo mientras no se dé `--aplicar`; su
validación en TypeScript se conserva para el ensayo y la base la repite (D5).

### D5. Vigencia validada por meses

Un mes está en la vigencia si alguno de sus días cae en ella (la misma regla que `mesesDeVigencia`).
Una función interna devuelve lo que la vigencia propuesta deja fuera: meses con reportes de cualquier
estado, programas del contrato con los meses de su periodo fuera y meses de `programa_meses` o
`programa_realizados_manuales` fuera. Si hay algo, IC422 `vigencia_con_datos_fuera` con ese detalle, que
la interfaz muestra junto a los campos de vigencia.

### D6. Sitio corregido en su lugar; asociar y quitar

`api_editar_sitio` exige que el sitio esté asociado a `contratoId`, conserva el id (las llaves no se
tocan) y respeta `sitios_clave_unica` (IC422 `sitio_duplicado` con el existente). El impacto nombra los
otros contratos del sitio y cuenta los reportes del sitio en todos ellos; la propagación alcanza a los
borradores del sitio en cualquier contrato. `api_quitar_sitio` borra solo la fila de
`contrato_sitios` y rechaza con IC422 `sitio_con_datos` y los conteos si hay partidas, programas o
reportes de ese contrato y sitio. `api_resumen_sitios_contrato` {contratoId} devuelve por sitio esos
conteos y los otros contratos, para deshabilitar «Quitar del contrato» y avisar del sitio compartido.

### D7. Firmantes: corregir o cambiar desde una fecha

`api_corregir_firmante` actualiza el mismo registro; el trigger existente valida el traslape.
`api_cambiar_firmante` exige `desde` mayor que `vigente_desde` del actual y, si tiene fin, no posterior
a él (IC422 `fecha_cambio_invalida` con la primera fecha permitida); fija `vigente_hasta = desde - 1`
en el actual y crea al nuevo desde `desde` hasta el fin que tenía el actual, con un solo registro de
bitácora (`reemplazar`, con el firmante anterior en `efectos`). El impacto incluye el primer mes cuyo
día 1 es igual o posterior a `desde`, que el diálogo muestra («desde diciembre de 2026»). La interfaz
propone como fecha el primer día del mes siguiente.

### D8. Copia del contrato en cada reporte y reconciliación por campo

Columna `reportes.contrato_copia jsonb` con {usuario, contrato, sitio, firmantes: {elaboro, aprobo,
recibio}} tal como el contrato los dio al reporte. `datos_contrato_reporte(contrato, sitio, mes)`
calcula los datos vigentes con las reglas de `prellenarReporte` (razón social, número, «clave nombre»
y firmantes vigentes el día 1 del mes). Un trigger `before insert` llena la copia: en una revisión
copia la del original (como `copiar_huella_revision` de `0007`) y en un reporte nuevo usa los datos
vigentes; así no se redefinen `api_insertar_reporte` ni `api_crear_revision`, que envuelven `0016` y
`0017` respectivamente (convención de D3 de `fechas-ejecucion-multiples`). La
migración llena la copia de los reportes existentes con los datos vigentes.
`reconciliar_contrato_reporte(id, forzar)` compara, campo por campo, vigente contra copia: si cambió y
el reporte conserva el valor de la copia (o `forzar`), escribe el vigente en el reporte y en la copia;
si se escribió a mano, lo deja y el campo queda con aviso. Sin firmante vigente para una función, la
firma del reporte se conserva. Si aplicó algo, `version = version + 1`, lo que invalida el DOCX en
caché y hace que un editor abierto reciba el conflicto de versión. La propagación de D1 llama a la
reconciliación sin `forzar` en los borradores afectados; el editor la llama con `forzar` (D12).
Alternativas descartadas: comparar los textos del reporte con el contrato (una firma escrita a mano
daría un aviso permanente) y una huella como `catalogoHuella` (no dice qué dato cambió ni permite
conservar lo escrito a mano).

### D9. Concurrencia optimista en el catálogo

`json_contrato`, `json_sitio` y `json_firmante` agregan `actualizadoEn`; `esquemaContrato`,
`esquemaSitio` y `esquemaFirmante` en `src/lib/dominio/esquemas.ts` lo incluyen. Las funciones de
edición comparan el valor recibido con `actualizado_en` de la fila bloqueada y responden IC409
`conflicto`; la interfaz muestra «El contrato cambió desde que lo abrió; recargue para ver los datos
actuales» (o el texto equivalente para sitio y firmante).

### D10. Permisos en un solo punto

`src/app.d.ts` declara `Locals { autenticacion?: boolean; usuario?: { id: string; nombre: string; rol:
'administrador' | 'capturista' } | null }`. `src/lib/server/permisos.ts` exporta
`puedeEditarCatalogo(locals)` (verdadero si no hay autenticación; con ella, solo `administrador`) y
`contextoBitacora(locals)` ({usuarioId, usuarioTexto} desde la sesión, nulos hoy). Las acciones de
edición y alta del contrato, sus sitios y sus firmantes responden 403 sin llamar a la base si no hay
permiso; ningún dato del formulario se usa como usuario. La carga devuelve `permisos.editarCatalogo`
para ocultar las acciones. Con la autenticación llegarán `src/hooks.server.ts`, la tabla `perfiles` y
`es_administrador(uuid)` comprobada dentro de las funciones de edición, porque la clave de servicio se
salta RLS; si algún día se llama con el JWT del usuario, se agregan políticas de lectura para
`authenticated` en `cambios_catalogo`.

### D11. Acciones de la pantalla del contrato

`/catalogo/contratos/[id]` agrega `ensayarCambio` y `aplicarCambio`, con un campo `tipo` (`contrato`,
`sitio`, `quitarSitio`, `corregirFirmante`, `cambiarFirmante`) que un módulo nuevo
`src/lib/server/edicion-catalogo.ts` convierte en la llamada al repositorio. `aplicarCambio` valida el
motivo con `validarMotivo` del dominio antes de llamar a la base (que lo vuelve a validar).
`guardarFirmante` pasa a `registrarFirmante` (solo alta) y `asociarSitio` envía el contexto de la
bitácora. La carga agrega la página del historial (`?cambios=N`, 20 por página, sin JavaScript),
`api_resumen_sitios_contrato` y los permisos.

### D12. Interfaz del contrato con componentes propios

Componentes nuevos en `src/lib/components/catalogo/`: `DatosContrato.svelte` (lectura con «Editar» y
formulario de número, descripción y vigencia; el cliente se muestra fijo con la nota de renovación),
`DialogoCambioCatalogo.svelte` (sobre `Dialogo`: lista antes → después, impacto, casilla «Actualizar
también los borradores» solo si hay borradores afectados, motivo con contador) y
`HistorialCambios.svelte` (`<details>` con tabla y paginación). `ContratoView.svelte` los integra y
agrega por sitio «Corregir clave o nombre» y «Quitar del contrato», y por firmante «Corregir datos» y
«Cambiar firmante desde…» (en el más reciente de cada función); «Registrar firmante» queda para las
altas. Flujo: el formulario envía `?/ensayarCambio` con `use:enhance`; con resultado se abre el
diálogo; «Confirmar» envía `?/aplicarCambio` con los mismos campos, el motivo y la casilla, muestra
una notificación (`src/lib/components/ui/notificaciones.ts`) con los efectos y recarga los datos. No hay
«Deshacer»: el cambio inverso es otro cambio con su motivo. `Dialogo.svelte` agrega
`confirmarDeshabilitado` (falso por omisión, así el diálogo de emisión no cambia); el foco inicial
sigue en «Cancelar». Los textos y la descripción de cada registro salen de un módulo puro nuevo,
`src/lib/dominio/bitacora.ts` (etiquetas de campo, `describirCambio`, `resumenImpacto`,
`validarMotivo`), y las fechas de `src/lib/dominio/fechas.ts` en America/Mexico_City.

### D13. Aviso y actualización en el editor

`api_estado_contrato_reporte` {id} devuelve {cambiado, datos: [{campo, reporte, contrato}]} para
borradores y reportes en revisión, y `cambiado: false` para emitidos y sustituidos.
`api_actualizar_contrato_reporte` {id, version} solo acepta borradores con la versión vigente (IC409
en otro caso), reconcilia con `forzar` y devuelve `json_reporte` (la definición vigente, envuelta por
`0016`). `CapturaServicio` (`src/lib/server/captura.ts`) agrega `estadoContrato` y
`actualizarContrato`, junto a `estadoCatalogo` y `aplicarCatalogo`. `src/routes/reportes/[id]/` agrega
`contratoCambiado` a la carga y la acción `actualizarContrato`; `EditorReporte.svelte` muestra el aviso
junto al de catálogo: en borrador con «Actualizar datos del contrato» (`accionConGuardado`), en
revisión solo el texto con la indicación de regresarlo a borrador, y en ambos un enlace al contrato.

## Risks / Trade-offs

- [Propagar sin subir la versión dejaría el DOCX en caché con el dato anterior y un editor abierto lo
  sobrescribiría] → la reconciliación siempre sube `version`; una prueba lo comprueba con el documento.
- [Corregir un sitio afecta a todos los contratos que lo comparten] → el diálogo los nombra y la
  propagación alcanza a sus borradores; hoy ningún sitio está compartido.
- [Una revisión copia el encabezado del original] → el trigger le pasa la copia del original, así ve
  el aviso y puede actualizarse.
- [Borradores anteriores a `0018` con datos distintos del contrato no muestran aviso, porque su copia
  se llena con los datos vigentes] → con los datos actuales no hay diferencias (ningún contrato se ha
  corregido y no hay firmantes registrados); se acepta.
- [Los scripts buscan el contrato por número: tras corregir «VIRTUAL-POR-CONFIRMAR», volver a ejecutar
  `derivar-partidas` con el número viejo crearía otro contrato provisional] → el historial del contrato
  conserva el número anterior; se documenta en `HISTORIAL.md` y en el contexto; una protección
  automática queda como pregunta abierta.
- [Una tabla nueva sin RLS rompe la prueba de seguridad y queda expuesta en Supabase] → `0018` activa
  RLS, la política y la revocación; la prueba existente lo verifica.
- [La clave de servicio se salta RLS] → la restricción de administradores vive en el servidor
  (`permisos.ts`) y, con autenticación, en las funciones SQL; el usuario nunca viene del formulario.
- [La bitácora guarda nombres de firmantes] → mismo trato que la tabla `firmantes`; pruebas con nombres
  ficticios; la retención queda como pregunta abierta.
- [Cambiar `Dialogo.svelte` afecta sus pruebas y el diálogo de emisión] → prop opcional con valor por
  omisión que conserva el comportamiento; se agrega un caso a `Dialogo.svelte.spec.ts`.
- [Sin JavaScript no hay diálogo] → el servidor exige el motivo en cualquier caso; el resto de la
  aplicación ya depende de JavaScript.
- [`0015`–`0017` pueden redefinir funciones que `0018` también redefine] → antes de escribir `0018` se
  toma la última definición de cada función en `0001…0017` (tarea 1.2).
- [La validación visual en la base de desarrollo dejaría registros de prueba que no se pueden borrar] →
  se hace sobre una copia de `storage/pglite` y se restaura el respaldo al terminar.
- [PGlite admite un solo proceso] → aplicar `0018` requiere detener el servidor de desarrollo.

## Migration Plan

1. Crear `feat/edicion-contratos` sobre `feat/editor-fotos` y escribir `0018_bitacora_catalogo.sql`;
   las pruebas crean bases PGlite nuevas con todas las migraciones.
2. Para la base de desarrollo: detener el servidor, respaldar `storage/pglite` fuera del repositorio y
   reiniciar; PGlite aplica `0018` al abrir la base. En Supabase se aplicará con el resto de las
   migraciones (tarea 3.8 de `reportes-mantenimiento-for-icsi-rmt-01`).
3. Reversión: los cambios de código se revierten por commit. En desarrollo se restaura el respaldo de
   `storage/pglite`. En Supabase, revertir `0018` exige restaurar las definiciones anteriores de las
   funciones redefinidas y retirar trigger, columna y tabla, lo que pierde la bitácora: solo antes de
   usarla en producción.

## Open Questions

- Retención de la bitácora (datos personales de firmantes): por ahora se conserva sin límite; no
  cambia la estructura.
- Tipo de error «prohibido» (IC403) en `ErrorDatos` (`src/lib/server/bd/cliente.ts`): llega con la
  autenticación, cuando las funciones comprueben `es_administrador`.
- Protección de los scripts ante un número de contrato corregido (buscar el número anterior en la
  bitácora y detenerse).
- Si la corrección de Proagro hecha en `importacion-programa-anual`, anterior a la bitácora, se
  registra después como un cambio con origen script.
