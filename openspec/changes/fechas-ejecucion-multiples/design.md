# Design

## Context

Motivación y alcance en `proposal.md`; requisitos en `specs/captura-reportes/spec.md`,
`specs/generacion-documental/spec.md` y `specs/programa-anual/spec.md`. Estado de partida, comprobado
el 2026-10-21 en `feat/ux-fase-c`:

- Base (`supabase/migrations/0003_reportes.sql`): `reportes.fecha_ejecucion date` con el check
  `reportes_fecha_en_periodo` (solo el mes); `json_reporte` la expone como `fechaEjecucion`;
  `api_insertar_reporte` la recibe, `api_guardar_reporte` la sustituye si viene en el JSON,
  `api_cambiar_estado` rechaza enviar o emitir sin ella (IC422) y `api_crear_revision` la copia. El
  trigger `reportes_actualizado` toca `actualizado_en` en cada `update`.
- `0007_captura.sql` ya extendió `json_reporte` sin reescribirlo (renombró la definición a
  `json_reporte_base`), envolvió la inserción con `api_crear_reporte` y copia la huella a las
  revisiones con el trigger `reportes_copiar_huella`. `api_aplicar_catalogo` llama a
  `api_guardar_reporte` por nombre. PL/pgSQL y SQL resuelven los nombres al ejecutarse.
- `v_ejecuciones_reportes` cuenta ocurrencias distintas de los emitidos por partida y mes;
  `v_realizado` y `api_obtener_programa` (vigente en `0012_avance_desglose.sql`) dependen de ella.
- `src/lib/server/bd/cliente.ts` solo permite llamar funciones `^api_[a-z_]+$` (`validarFuncion`) y
  convierte `23514` e `IC422` en `ErrorDatos` de tipo `invalido`. PGlite aplica cada migración una vez,
  en una transacción, y la registra en `interno.migraciones` (`src/lib/server/bd/migraciones.ts`).
- Dominio: `tipoOcurrencia`, `rangoDelPeriodo`, `validarParaRevision`, `CAMPOS_ENCABEZADO` y
  `aGuardado` en `src/lib/dominio/captura.ts`; `fechaEncabezado` en `src/lib/dominio/documento.ts`;
  `textoRango` en `src/lib/dominio/textos.ts`, que importa `partesMes` de `captura.ts` (importarlo
  desde `captura.ts` crearía un ciclo).
- Documento: `ReporteDocumento.encabezado.fecha` (AAAA-MM-DD) en
  `src/lib/server/documentos/generar.ts`; la plantilla `FOR-ICSI-RMT-01.v1.docx` inserta
  `encabezado.fecha` ya formado en una celda de unos 10 cm; `CapturaService.generarDocumento`
  (`src/lib/server/captura.ts`) reutiliza el DOCX registrado por (`reporteVersion`,
  `versionPlantilla`).
- Datos reales (157 DOCX de `insumos/`, solo lectura): 113 de un día, 6 de varios días, todos en
  Cerritos («1 al 3», «28,30», «09,30», «01-31» y «01 AL 31»); ninguno cruza de mes. La base de
  desarrollo tiene 3 reportes de Cerritos con fecha y sin ocurrencia (2 borradores y 1 emitido).
- Orden de los cambios: este cambio se apila sobre `importacion-programa-anual` (migración `0015`);
  después vienen `indice-docx-actualizado` (sin migración), `editor-fotos` (`0017`, vuelve a envolver
  `api_guardar_reporte` y envuelve `api_crear_revision`), `edicion-contratos-bitacora` (`0018`, solo
  triggers sobre `reportes`) y `tablero-cumplimiento` (`0019`, envuelve `json_reporte` y
  `api_crear_reporte` y redefine `v_ejecuciones_reportes`).

## Goals / Non-Goals

**Goals:**

- Una sola fuente de verdad para los días (los segmentos) y compatibilidad total con lo que hoy usa
  `fecha_ejecucion` (check del mes, bloqueo IC422, filtros y orden).
- Envolturas SQL que los cambios siguientes puedan volver a envolver sin reescribir cuerpos largos.
- Reglas puras y probables sin interfaz en `src/lib/dominio/`; la salida de un día idéntica a la de
  hoy, para no invalidar documentos ni cambiar `VERSION_PLANTILLA`.

**Non-Goals:**

- Días de dos meses en un reporte, calendario de selección múltiple y fusión automática de días
  seguidos.
- Leer la fila «FECHA:» al importar reportes Word (`src/lib/server/importacion/reporte-docx.ts`) y
  controlar las fechas escritas en el cuerpo del reporte.
- Cambiar la plantilla DOCX, el nombre del archivo, el título de la portada, el historial, los filtros
  o los firmantes vigentes (todos usan el periodo, no la fecha).
- Textos por días en «Mi trabajo» o en la planeación («faltan 16 días»): las cifras cambian por el
  conteo, los textos no.

## Decisions

### D1. Segmentos en `jsonb` como fuente única y fechas derivadas

Columna `reportes.dias_ejecucion jsonb not null default '[]'` con `[{desde, hasta}]` (AAAA-MM-DD) en
orden ascendente, sin traslapes y del mes del periodo; un día se guarda con `desde = hasta`, así «15,
16» y «15-16» se distinguen. `fecha_ejecucion` (primer día) y la nueva `fecha_ejecucion_fin` (último
día) se derivan siempre y son de solo lectura para la aplicación.
Alternativas descartadas: `date[]` con una regla fija de rangos (pierde «02, 03, 04» frente a «05-08» y
contradice el «1 al 3» real); `datemultirange` (Postgres fusiona rangos adyacentes, supabase-js lo
transporta como texto); texto libre impreso tal cual (no permite validar el periodo ni contar días).

### D2. Validación y derivación en la base

- `public.dias_ejecucion_validos(dias jsonb, periodo date) returns boolean` (inmutable): arreglo de a lo
  sumo 31 objetos con solo `desde` y `hasta` en formato AAAA-MM-DD, fechas existentes, `desde <= hasta`,
  cada `desde` mayor que el `hasta` anterior y todo dentro del mes `periodo`. Devuelve `false` (no lanza
  error) ante una fecha inexistente o un tipo distinto, para que la respuesta sea siempre `23514`.
- Checks nuevos: `reportes_dias_ejecucion_validos` y `reportes_fecha_fin_en_periodo` (fin del mismo mes
  y no anterior al inicio); se conserva `reportes_fecha_en_periodo`.
- Un solo trigger `reportes_dias_ejecucion` (`before insert or update`, función
  `public.preparar_dias_ejecucion()`): en `insert` con `dias_ejecucion` vacío copia los días de
  `sustituye_a` si es una revisión o, si solo trae `fecha_ejecucion`, la convierte en un segmento de un
  día (compatibilidad con rutas que solo conocen la fecha); en todo `insert` y `update` recalcula
  `fecha_ejecucion` y `fecha_ejecucion_fin` (nulas sin días). Un solo trigger evita depender del orden
  alfabético frente a `reportes_copiar_huella` y `reportes_actualizado`.
  Alternativa descartada: validar solo en la aplicación: el autoguardado y una futura API externa
  podrían guardar segmentos traslapados.

### D3. Envolturas reenvolvibles con nombres versionados

`0016` extiende tres funciones sin reescribir sus cuerpos. La definición vigente se renombra, con un
bloque idempotente como el de `0007`, a `<función>_<NNNN>`, donde `NNNN` es la migración que la definió
o envolvió por última vez, y la envoltura conserva el nombre público y la firma (`json_reporte(uuid)
returns jsonb`; `(p jsonb) returns jsonb` en las funciones `api_*`):

- `json_reporte` (definida en `0007`) → `json_reporte_0007`; la nueva agrega `diasEjecucion` y
  `fechaEjecucionFin`.
- `api_insertar_reporte` → `api_insertar_reporte_0003`; la envoltura llama a la base sin
  `diasEjecucion`, aplica los días si vienen y devuelve `json_reporte`. `api_crear_reporte` la
  invoca por nombre.
- `api_guardar_reporte` → `api_guardar_reporte_0003`; la envoltura toma `diasEjecucion` o, si solo
  llega el `fechaEjecucion` heredado, lo convierte en un segmento (nulo → sin días); llama a la base sin
  esas dos claves (la base ya bloquea la fila, valida versión y estado y sube la versión una vez);
  después actualiza `dias_ejecucion` del mismo `id` y reconstruye `reporte` con `json_reporte`. La
  respuesta conserva la forma `{reporte, fotosEliminadas}`. `api_aplicar_catalogo` la usa sin cambios.

Reglas para los cambios siguientes (`0017` a `0019`), que se copian en el comentario inicial de `0016`:
renombrar la envoltura vigente a un nombre nuevo y único y crear la nueva envoltura encima; no
redefinir nunca un cuerpo renombrado; quitar del JSON solo las claves que la envoltura atiende y pasar
las demás; aplicar sus escrituras después de la base, dentro de la misma transacción, sin volver a subir
la versión, y reconstruir la respuesta con `json_reporte`. El sufijo es siempre `_<NNNN>` (por
ejemplo `api_guardar_reporte_0016`): un nombre con dígitos no pasa `validarFuncion`
(`^api_[a-z_]+$`), así que la aplicación solo puede llamar la envoltura exterior; un sufijo sin dígitos
dejaría la definición interna invocable desde la aplicación, por eso no se usa.
`api_crear_revision` no se toca en `0016` (los días se copian con el trigger de D2): sigue siendo la
definición de `0003` y la primera envoltura la renombra (por ejemplo a `api_crear_revision_0003`); para
copiar datos nuevos a una revisión también vale un trigger como el de D2.
Alternativa descartada: reescribir `api_guardar_reporte` completa (cien líneas duplicadas por cada
cambio que la toque) o un sufijo fijo como `_base`, que choca en la segunda envoltura.

### D4. `api_cambiar_estado` informa los días

Se redefine con la misma firma y el mismo cuerpo salvo la regla IC422: sin días
(`jsonb_array_length(dias_ejecucion) = 0`) responde «Faltan los días de ejecución» con
`campos: ['diasEjecucion']`. Es un reemplazo, no una envoltura, porque el cambio está dentro de la
validación; una envoltura posterior la renombrará a `api_cambiar_estado_0016`. `destinoDeObservacion`
sigue aceptando `fechaEjecucion` como alias del campo de días.

### D5. Relleno compatible de los reportes existentes

En `0016`, antes de crear los checks y el trigger: `alter table public.reportes disable trigger
reportes_actualizado`, `dias_ejecucion = [{desde: fecha_ejecucion, hasta: fecha_ejecucion}]` y
`fecha_ejecucion_fin = fecha_ejecucion` donde haya fecha, y `enable trigger`. No cambia `version`,
`estado` ni `actualizado_en`: el historial conserva su orden y el DOCX registrado por (`version`,
`FOR-ICSI-RMT-01.v1`) sigue sirviendo porque un día se imprime igual (D9). Al final, el bloque de
permisos de `0007`/`0012` para las funciones nuevas.

### D6. Módulo de dominio `src/lib/dominio/dias-ejecucion.ts`

Funciones puras, sin importar `captura.ts` ni `textos.ts` (solo `MESES` y `diasDelMes` de
`documento.ts`) para no crear ciclos:

- `SegmentoDias { desde; hasta }`.
- `analizarDias(texto, periodoMes) → { segmentos, errores }`: separadores «,», «;», espacios y «y»;
  rangos con «-» o «al» (sin distinguir mayúsculas); días de 1 o 2 dígitos; sufijo opcional
  « / MES / AAAA» con espacios irregulares, aceptado solo si es el mes del reporte; texto vacío → sin
  segmentos y sin errores. Ordena los segmentos sin fusionarlos. Errores con los textos de la spec
  (repetido o traslapado, inexistente, invertido, no reconocido, otro mes).
- `textoDias(segmentos)` → «15, 16, 20-25» (forma normalizada del campo); `agregarDia`,
  `diasCubiertos` y `diasFueraDe(segmentos, rango)`.

### D7. Validación para revisión con segmentos

En `validarParaRevision` el bloque de la fecha pasa a: periodo inexistente → `ocurrencia` (igual que
hoy); sin días → `diasEjecucion`, «Capture los días de ejecución.»; días fuera de
`rangoDelPeriodo` → «Días fuera del periodo del reporte (del 4 al 10 de mayo de 2026): 11, 12.», con el
periodo en el formato de `textoRango` (construido en el dominio sin importar `textos.ts`) y los días
fuera con `textoDias`. `ReporteValidable` usa `diasEjecucion`; `CAMPOS_ENCABEZADO` envía
`diasEjecucion` y `fechaEjecucion` al `id` `fecha` del editor, que se conserva para el índice y los
enlaces del resumen. `prellenarReporte` crea el reporte con `diasEjecucion: []` y `aGuardado` envía
`diasEjecucion`.

### D8. Campo de días en el editor

En `EditorReporte.svelte` (sintaxis heredada) el `<input type="date">` se reemplaza por un campo de
texto `id="fecha"` con estado local:

- El texto se analiza con cada cambio. Si es válido y distinto de lo guardado, asigna
  `reporte.diasEjecucion` y el autoguardado actúa como hoy (por la huella de `paraGuardar`). Si no es
  válido, no toca el reporte y agrega una observación local `diasEjecucion` a la lista de pendientes,
  de modo que «Faltan N», el índice y el resumen de envío la cuentan.
- Al salir del campo con un texto válido se muestra la forma normalizada (`textoDias`). Si los días
  cambian desde fuera (respuesta del servidor, conflicto, «Deshacer») y el campo no tiene el foco, el
  texto se regenera.
- Debajo: la ayuda «Periodo: {textoRango}» con la sintaxis de ejemplo, la vista previa «En el
  documento: {fechasEncabezado}» (solo con días válidos) y `ErrorCampo`, todos enlazados por
  `aria-describedby`.
- «Agregar hoy» (si hoy está en el periodo y no está incluido) usa `agregarDia`; «Todo el periodo»
  reemplaza por `rango.desde`–`rango.hasta` y, si había días, publica una notificación con «Deshacer»
  (`src/lib/components/ui/notificaciones.ts`) que restaura los segmentos anteriores.
- «Descargar DOCX»: deshabilitado con «Corrija los días de ejecución» si el texto no es válido y con
  «Indique los días de ejecución» si no hay días guardados.

### D9. Fila Fecha del DOCX

`fechasEncabezado(segmentos)` en `src/lib/dominio/documento.ts`, junto a `fechaEncabezado` (que se
conserva y produce lo mismo para un día): «DD» o «DD-DD», unidos con «, », y « / MES / AAAA»; lanza
`RangeError` sin segmentos o con meses distintos. `ReporteDocumento.encabezado.fecha` se sustituye por
`encabezado.dias: SegmentoDias[]` y `generar.ts` llena la clave `encabezado.fecha` de la plantilla con
`fechasEncabezado`; la plantilla y `VERSION_PLANTILLA` no cambian. `generarDocumento` exige al menos un
segmento («Capture los días de ejecución para generar el documento.», campo `diasEjecucion`) y
`documentoDe` deja de recibir la fecha aparte. Los ejemplos de `scripts/datos-prueba/*.json` pasan a
`dias`; `postes-volumen-alto.json` usa «15, 16, 20-25» de mayo para revisar la celda a la vista.

### D10. Partidas diarias por mes o por semana

`tipoOcurrencia` se sustituye por `modosDePeriodo(periodicidad)` en `src/lib/dominio/captura.ts`:
diaria → mes completo (sin ocurrencia) o semana; semanal → semana; quincenal → quincena; el resto →
mes. `prellenarReporte` rechaza una ocurrencia que no esté en los modos («La partida 33 se reporta por
mes completo o por semana»). La ocurrencia `dia` sigue siendo válida en el esquema, en la base y en
`rangoDelPeriodo` para no romper datos, pero la captura ya no la ofrece. En `/captura`
(`src/routes/captura/+page.server.ts` y `CapturaView.svelte`) una partida diaria muestra
`BotonesSegmentados` «Mes completo | Por semana» (por omisión «Mes completo») y, con «Por semana», la
lista de semanas existente; la acción `crear` acepta la ocurrencia vacía para las diarias. El aviso de
reporte existente de una partida diaria no filtra por ocurrencia: muestra todos los reportes de la
partida y el mes. El título y el nombre del archivo salen de `textoPeriodo`, sin cambios.

### D11. Conteo por día en `v_ejecuciones_reportes`

`create or replace view` con las mismas columnas y tipos (`partida_id`, `mes`, `ejecuciones bigint`,
`reportes jsonb`), así `v_realizado` y `api_obtener_programa` no cambian. Se une con `partidas`: si la
periodicidad es `diaria`, `ejecuciones` es el número de días distintos que generan
(`generate_series` por día) los segmentos de los emitidos de esa partida y mes; si no, se conserva el
conteo de ocurrencias distintas. `reportes` sigue listando todos los emitidos. Se usa la periodicidad
vigente de la partida, igual que lo programado.

### D12. Contrato Zod

En `src/lib/dominio/esquemas.ts`: `esquemaSegmentoDias` y `esquemaDiasEjecucion` (a lo sumo 31, en
orden, sin traslapes y de un solo mes; el mes del periodo lo controla la base). `esquemaReporte` agrega
`diasEjecucion` y `fechaEjecucionFin` y conserva `fechaEjecucion` de solo lectura;
`esquemaReporteNuevo` y `esquemaReporteGuardado` cambian `fechaEjecucion` por `diasEjecucion`.
`esquemaReporteResumen` y los filtros del historial no cambian.

## Risks / Trade-offs

- [El relleno activa `reportes_actualizado` y cambia el orden del historial] → se desactiva el trigger
  durante el relleno y no se toca `version`; una prueba compara `version` y `actualizado_en` antes y
  después de `0016`.
- [Una revisión pierde días] → el trigger de D2 copia los días de `sustituye_a`; prueba con «15, 16,
  20-25».
- [Las envolturas de `0017` y `0019` rompen la cadena] → convención de D3 escrita en el comentario de
  `0016` y una prueba que guarda, aplica el catálogo y crea una revisión con días a través de la
  envoltura exterior.
- [`0015` redefine alguna función o vista que toca este cambio] → la tarea 1.2 lo comprueba; si ocurre,
  `0016` parte de la definición de `0015` y el sufijo del renombrado es `_0015`.
- [Autoguardado con texto inválido] → el editor no envía hasta que el texto sea válido; si un guardado
  trae segmentos inválidos, el check devuelve `23514` (`invalido`) y el reporte conserva sus días.
- [Pestañas del editor abiertas antes del despliegue envían `fechaEjecucion`] → la envoltura acepta la
  clave heredada; el esquema del servidor exige `diasEjecucion`, así que esa pestaña recibe un error y
  hay que recargarla. En desarrollo basta con recargar.
- [Una lista larga ocupa dos renglones en la celda de 10 cm] → se revisa a la vista con
  `npm run prueba:documental` y en Word; la plantilla no cambia.
- [Compatibilidad con Supabase (tarea 3.8)] → solo `jsonb`, triggers, `generate_series` y PL/pgSQL
  estándar; se probará fuera de PGlite cuando exista el proyecto.
- [Las diarias cambian sus cifras en la planeación y en «Mi trabajo»] → es el comportamiento pedido; en
  desarrollo no hay emitidos de partidas diarias, y las pruebas de avance cubren los escenarios.
- [Fechas del texto libre del cuerpo contradicen los días] → fuera de alcance, como hoy.

## Migration Plan

1. Rama `feat/fechas-multiples` sobre `feat/programa-anual`; `0016_dias_ejecucion.sql` con columnas,
   relleno, validación, trigger, envolturas, `api_cambiar_estado`, la vista y los permisos.
2. Base de desarrollo: detener el servidor (PGlite no admite dos procesos), respaldar `storage/pglite`
   fuera del repositorio y volver a iniciarlo para aplicar `0016`; comprobar los 3 reportes. En
   Supabase se aplicará con el resto de las migraciones (tarea 3.8).
3. Reversión: restaurar el respaldo de `storage/pglite` y volver a la rama anterior. Revertir solo el
   código no basta, porque `json_reporte` agrega campos y el esquema los exige; en Supabase haría falta
   una migración inversa que renombre `_0003`/`_0007` a sus nombres públicos.

## Decisiones aplicadas

Del usuario (2026-10-21): partidas diarias por mes o por semana al crear, y en la planeación cada día
distinto cubierto por un emitido cuenta como una ejecución. Por omisión, recomendadas por el análisis:
respetar la forma capturada (segmentos `{desde, hasta}`), formato «DD, DD-DD / MES / AAAA» con un día
igual que hoy, días dentro del periodo sin cruzar de mes, y campo de texto analizado con vista previa,
«Agregar hoy» y «Todo el periodo».
