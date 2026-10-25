# Design

## Context

Motivación y alcance en `proposal.md`; requisitos en `specs/programa-anual/spec.md` y
`specs/tablero-cumplimiento/spec.md`. Estado de partida comprobado en `feat/ux-fase-c` y lo que dejan
los cambios anteriores de esta serie:

- `supabase/migrations/0002_programa.sql`: `programas` (contrato, sitio y periodo sin traslapes),
  `programa_meses` (cantidad por partida y mes) y `programa_realizados_manuales`.
- `0003_reportes.sql`: estados del reporte (`borrador`, `en_revision`, `emitido`, `sustituido`),
  `reportes_fecha_en_periodo`, `v_ejecuciones_reportes` (ocurrencias distintas de los emitidos por
  partida y mes) y `v_realizado` (ejecuciones más realizados manuales). `0012_avance_desglose.sql`
  define el `api_obtener_programa` vigente; `0007_captura.sql`, `api_crear_reporte` y el disparador
  `copiar_huella_revision`.
- Cambio `fechas-ejecucion-multiples` (`0016_dias_ejecucion.sql`): `reportes.dias_ejecucion`
  (segmentos `{desde, hasta}`) y `v_ejecuciones_reportes` que cuenta los días distintos de las
  partidas diarias. También envuelve `json_reporte` (base `json_reporte_0007`), `api_insertar_reporte`
  y `api_guardar_reporte`, redefine `api_cambiar_estado` y fija la convención de envolturas (D3). Según
  sus diseños, `editor-fotos` (`0017`) envuelve `api_guardar_reporte` y `api_crear_revision` y redefine
  `json_foto`, y `edicion-contratos-bitacora` (`0018`) agrega `reportes.contrato_copia` con un trigger;
  ninguno de los dos toca `json_reporte`, `api_crear_reporte`, `v_ejecuciones_reportes` ni
  `api_obtener_programa`.
- Cambio `importacion-programa-anual` (`0015_importar_programa.sql`): programa de Proagro cargado
  (EM-30184 y EM-30185, marzo de 2026 a febrero de 2027) con `api_importar_programa`, que reemplaza
  los meses y las marcas R de origen importación.
- `src/lib/dominio/planeacion.ts`: `estadoCelda` (cinco estados), `pendientesVencidos`,
  `resumenDelMes` y `siguienteTrabajo`; `src/lib/dominio/seleccion.ts`: `trabajoDePartidas` usa
  `estadoCelda`. Ambos alimentan `/planeacion`, `/captura` y «Mi trabajo».
- `src/routes/planeacion/+page.server.ts` carga un programa por contrato y sitio y registra realizados
  manuales; `PlaneacionView.svelte` dibuja la matriz P/R con `ESTADO`, `SIMBOLO` y `LEYENDA`.
- Componentes disponibles: `ui/Dialogo.svelte`, `ui/notificaciones.ts` con «Deshacer»,
  `ui/BotonesSegmentados.svelte`; tokens `--success`, `--warning`, `--danger` y `--primary` en
  `src/app.css`. Menú: `src/lib/layout/navegacion.ts` y `Sidebar.svelte` (grupo «Planeación» con
  «Anual»).
- Referencia de indicadores: el libro de Virtual (estados E/R/N/P, cumplimiento = E/(E+N),
  efectividad = E/(E+R), semáforos 75/90 y 60/80). Se usa solo como referencia: no se importa ni se
  copia su formato de matriz diaria.

## Goals / Non-Goals

**Goals:**

- Un solo cálculo de estados e indicadores, puro y probado, que usen la matriz, la vista mensual, la
  semanal, el tablero, «Mi trabajo» y la captura.
- Migración aditiva: el plan original, los reportes y los realizados manuales no cambian de
  significado; lo nuevo se suma.
- Conservar la matriz anual como vista por omisión y el flujo de «Capturar» desde una celda.

**Non-Goals:**

- Semana o fecha planeada por partida, «próximo mantenimiento» o «faltan días» del libro de Virtual.
- Reprogramar hacia otro programa o periodo (eso es «No ejecutado» con motivo).
- Umbrales por contrato, restricción de los ajustes a administradores y registro de quién los hace:
  llegan con la autenticación, como en `edicion-contratos-bitacora`.
- Fotos del estado anterior: el tablero calcula con los datos de hoy; no hay instantáneas históricas.
- Cambios en el DOCX o en las validaciones del reporte.

## Decisions

### D1. Plan original más una tabla de ajustes (opción A del análisis)

`programa_meses` sigue siendo el plan original y denominador; los ajustes se registran aparte. Los
estados se derivan, no se capturan.
Alternativas descartadas: un modelo por ocurrencia como el libro de Virtual (cambio estructural del
importador, `v_realizado`, captura y pruebas; unas 365 filas por partida diaria) y una letra manual por
celda (duplica lo que dicen los reportes, se desincroniza y no da «Con reporte» automático).

### D2. `programa_ajustes` con validación en la base

Tabla con `programa_id`, `partida_id`, `tipo` (`reprogramado` | `no_ejecutado`), `mes_origen`,
`mes_destino` (solo y obligatorio en `reprogramado`, posterior al origen), `cantidad` entera mayor que
cero, `motivo` (`cliente_operacion`, `clima`, `materiales_refacciones`, `acceso_permisos`, `personal`,
`otro`), `nota` (obligatoria con `otro`, hasta 500 caracteres), `registrado_en` y `anulado_en`. Un
disparador comprueba que la partida es del contrato y sitio del programa y que ambos meses están en
`meses_del_periodo`. `api_registrar_ajuste` bloquea la fila del programa (`for update`), calcula lo que
falta en el mes de origen (programado + entradas − salidas − no ejecutados − realizado, con
`v_realizado`) y rechaza con `IC422` y un mensaje en español si la cantidad lo supera.
`api_anular_ajuste` rechaza con `IC409` si hay reportes ligados en revisión o emitidos o si ya estaba
anulado; si no, pone `anulado_en` y deja en nulo el `reprogramacion_id` de sus borradores sin cambiar
su `version` (el autoguardado no envía ese campo). Los motivos viven en `esquemas.ts`
(`MOTIVOS_AJUSTE`) con sus etiquetas.
Alternativa descartada: validar solo en el servidor de la aplicación; dos pestañas podrían superar lo
que falta.

### D3. Reporte ligado a la reprogramación (regla R1)

`reportes.reprogramacion_id uuid null references programa_ajustes (id) on delete restrict`. Un
disparador al insertar o al cambiar `reprogramacion_id`, `partida_id` o `periodo_mes` exige un ajuste
`reprogramado`, vigente, de la misma partida y con `mes_destino = periodo_mes`; otro, antes de
insertar, copia el vínculo desde `sustituye_a` (patrón de `copiar_huella_revision`). `json_reporte` y
`api_crear_reporte` se extienden con las envolturas reenvolvibles que fija `0016` (D3 de
`fechas-ejecucion-multiples`): la definición vigente se renombra a `<función>_<NNNN>` (la migración que
la definió o envolvió por última vez) y la envoltura nueva conserva el nombre público. Si la tarea 1.2
no encuentra otra envoltura posterior, quedan `json_reporte_0016` (la envoltura de `0016`) y
`api_crear_reporte_0007` (la definición de `0007_captura.sql`, que llama a `api_insertar_reporte` por
nombre y pasa por la envoltura de `0016`). La de
`json_reporte` agrega `reprogramacionId` y la de `api_crear_reporte` llama a la base sin esa clave y
después la aplica al mismo `id`, en la misma transacción y sin subir la versión. `esquemaReporte` agrega
`reprogramacionId`. El vínculo se elige al crear (D9) y no forma parte del guardado.
Alternativas descartadas: reportar con el mes original y una fecha posterior (rompe
`reportes_fecha_en_periodo`) y prohibir reprogramar a meses con ocurrencia propia (deja fuera el caso
más común, las mensuales).

### D4. Conteo de ejecuciones con discriminador

`v_ejecuciones_reportes` se redefine con las mismas columnas (`partida_id`, `mes`, `ejecuciones`,
`reportes`), así `v_realizado` no cambia: cuenta pares distintos de (unidad, `reprogramacion_id`),
donde la unidad es la de `0016` (día para las diarias; ocurrencia, o vacío, para las demás). Varios
reportes por TAG de la misma ocurrencia y reprogramación siguen contando uno.

### D5. Lecturas ampliadas y lectura agrupada

`api_obtener_programa` agrega a cada celda `salida`, `entrada` y `noEjecutado` (ajustes vigentes),
`reportesAbiertos` (`[{id, estado}]` en borrador o en revisión de la partida y mes) y `ajustes` (los
vigentes con origen o destino en ese mes, con sus ejecuciones emitidas ligadas). Los campos actuales
conservan su significado. `api_obtener_cumplimiento(p)` devuelve en una llamada, para los programas
cuyo periodo contiene el mes de corte y que cumplen cliente, contrato y sitio, el contrato, el cliente,
el sitio y el mismo avance de `api_obtener_programa`. `api_listar_ejecuciones_mes(p)` (programa y mes)
devuelve los reportes no sustituidos del mes con partida, estado, ocurrencia, `reprogramacionId` y días
de ejecución, para la vista semanal (D14); va en `0019` para no requerir otra migración.
Alternativa descartada: calcular los indicadores en SQL: duplicaría las reglas del dominio.

### D6. Estados por celda en `src/lib/dominio/cumplimiento.ts`

Por celda: `objetivo = max(0, programado + entrada − salida)`, `esperado = max(0, objetivo −
noEjecutado)`, `ejecutado = ejecucionesReportes + realizadoSinReporte` y `faltan = max(0, esperado −
ejecutado)`. `estadoEjecucion(celda, hoy)` decide en este orden: sin nada programado ni entrante,
`extra` si hay ejecutado o `sin_programa`; si `faltan > 0`, `vencido` (mes terminado, con
`mesTerminado`), `pendiente` (mes en curso) o `programado` (mes futuro); si no, `no_ejecutado` cuando
hay no ejecutados, `ejecutado` cuando `esperado > 0` y `reprogramado` cuando todo salió. El ejecutado
por encima de `esperado` se informa como «de más». `estadoDocumental(celda)`: ninguno si `esperado` y
`ejecutado` son 0; `con_reporte` si `ejecucionesReportes ≥ max(esperado, 1)`; `reporte_en_borrador`
(con `enRevision`) si hay `reportesAbiertos`; si no, `sin_reporte`. Etiquetas, símbolos y el detalle
(«3 de 4 ejecutadas», «Reprogramado → oct», «+1 desde jun») salen del mismo módulo.

### D7. Indicadores, porcentajes y semáforos

Se evalúan las celdas con `mes ≤ corte`; un mes está terminado respecto de hoy, como en
`mesTerminado`. Por celda: `E = min(ejecutado, esperado)`, extras `= max(0, ejecutado − esperado)`,
`N = noEjecutado + (terminado ? faltan : 0)`, `P = (terminado ? 0 : faltan)` y con reporte
`= min(ejecucionesReportes, esperado)`. `PR = Σ programado`; `R = Σ salida`; a P se suman las salidas
con destino posterior al corte. Así `PR = E + N + P` siempre que los ajustes sean coherentes con lo
programado (las pruebas lo afirman). `porcentaje(a, b)` devuelve `null` si `b = 0`; la pantalla lo
trunca (`Math.floor`) y el semáforo usa el valor sin redondear con `UMBRALES = { cumplimiento: [75,
90], efectividad: [60, 80] }`. El mes de corte es un mes (los datos son mensuales) y por omisión el mes
en curso.
Alternativa descartada: N solo con los no ejecutados explícitos (como el libro de Virtual): con los
vencidos sin letra el cumplimiento saldría inflado (decisión del usuario).

### D8. Un solo vocabulario de estados en los consumidores

`EstadoCelda` y `estadoCelda` se sustituyen por `EstadoEjecucion` y `estadoEjecucion` en
`planeacion.ts` (`pendientesVencidos` y `siguienteTrabajo` usan `faltan`; `resumenDelMes` cuenta como
programadas las celdas del mes con `objetivo > 0`, como cumplidas las `ejecutado` y como pendientes las
`pendiente`), en `seleccion.ts` (`trabajoDePartidas` trata `programado` del mes de referencia como
pendiente, igual que hoy trata un mes futuro) y en `CapturaView.svelte`, `MiTrabajoView.svelte` y
`PlaneacionView.svelte`.
Alternativa descartada: conservar `estadoCelda` como adaptador: dos vocabularios terminarían
divergiendo.

### D9. Capturar lo reprogramado

`datosDeSeleccion` (`src/lib/server/seleccion-captura.ts`) devuelve, con partida y mes elegidos, las
reprogramaciones que llegan a ese mes y aún no tienen todas sus ejecuciones emitidas. `/captura` acepta
`?reprogramacion=<id>` y `CapturaView.svelte` muestra, solo si hay alguna, un grupo de opciones
«Trabajo de octubre» o «Reprogramado desde junio 2026 (Clima)». La acción `crear` envía
`reprogramacionId` a `crearReporte` (`src/lib/server/captura.ts`), y la base valida el vínculo. La
celda destino de la matriz, la vista mensual y «Mi trabajo» enlazan con el parámetro. El editor muestra
«Reprogramado desde junio 2026» junto al contexto, de solo lectura.

### D10. Matriz anual con dos ejes y acciones

`PlaneacionView.svelte` conserva la tabla; cambia la leyenda (fila «Ejecución» y fila «Documental») y
cada celda muestra P (con «→ oct» o «+1 desde jun»), R, el símbolo y texto corto de ejecución (✓
Ejecutado, ● Pendiente, ○ Programado, ! Vencido, → Reprogramado, ✕ No ejecutado, + Sin programar) y la
marca documental («Sin rep.», «Borrador» o «En rev.», «Con rep.»), con el nombre completo en
`aria-label`. Colores: verde para ejecutado y con reporte, ámbar para reprogramado, rojo para vencido y
no ejecutado (con símbolos distintos) y azul para pendiente, con contraste AA en ambos temas. Las
celdas con faltante o con ajustes muestran un botón «⋯» que abre `DialogoAjuste.svelte`
(`src/lib/components/planeacion/`, sobre `ui/Dialogo.svelte`): acción con `BotonesSegmentados`
(Reprogramar o No ejecutado), cantidad (1 a lo que falta), mes destino (solo meses posteriores del
periodo), motivo, nota y la lista de ajustes con «Anular» (advierte de los borradores ligados y se
deshabilita con el motivo si hay reportes en revisión o emitidos). Las acciones `registrarAjuste` y
`anularAjuste` de `src/routes/planeacion/+page.server.ts` usan `use:enhance`; al registrar, la
notificación ofrece «Deshacer» durante 10 s. La lista de vencidos ofrece las mismas acciones.

### D11. Vista mensual

`/planeacion?vista=mensual&mes=AAAA-MM-01` (por omisión, el mes en curso si está en el periodo; si
no, el primero). El selector «Anual | Mensual | Semanal» son enlaces con `aria-current`, porque cambian
la dirección. `VistaMensual.svelte` usa el mismo avance que la matriz y lista las partidas con
`objetivo > 0`, ejecutado, ajustes o reportes abiertos, ordenadas por urgencia (vencido y pendiente,
después reprogramado y no ejecutado, al final ejecutado y con reporte), con «Capturar» o «Continuar
borrador» (de `reportesAbiertos`), «⋯» y la navegación al mes anterior y siguiente dentro del periodo.
Los filtros de distribución y periodicidad se conservan al cambiar de vista.

### D12. Tablero `/cumplimiento`

`src/routes/cumplimiento/+page.server.ts` lee los filtros (`cliente`, `contrato`, `sitio`,
`periodicidad`, `corte=AAAA-MM`), limita el corte al mes en curso, llama a
`repos.programa.obtenerCumplimiento` y entrega a la vista los indicadores, la tabla, la tendencia y la
lista calculados con `cumplimiento.ts`. `CumplimientoView.svelte` compone `IndicadoresCumplimiento`,
`Semaforo`, `TablaCumplimiento`, `TendenciaCumplimiento` y `ReportesQueFaltan`
(`src/lib/components/cumplimiento/`). La tendencia es un SVG propio de dos series con las metas como
líneas de referencia y una tabla equivalente debajo. Navegación: `VistaId` `cumplimiento`,
`routesByView`, `titulosPorVista` («Cumplimiento del programa») y la entrada «Cumplimiento» en
`Sidebar.svelte` tras «Anual».
Alternativa descartada: una biblioteca de gráficas: dependencia nueva para una sola gráfica.

### D13. Reportes que faltan

Se arman con las celdas evaluadas y cada celda cae en un solo grupo, por precedencia: «Borradores
abiertos» (hay `reportesAbiertos`; acción «Continuar borrador» al más reciente), «Vencidos sin
reporte» (`faltan` en un mes terminado; «Capturar») y «Ejecutados sin reporte» (E mayor que lo
cubierto por emitidos; «Capturar»). Orden: mes, sitio y número de partida; se muestran 10 por grupo y
el resto bajo «Ver los N».

### D14. Vista semanal (fase 2)

`?vista=semanal&mes=AAAA-MM-01&semana=n`, con la semana de `rangoDelPeriodo(mes, { tipo: 'semana',
numero: n })` (`src/lib/dominio/captura.ts`): lunes a domingo recortada al mes. Con
`api_listar_ejecuciones_mes`, una función pura arma por partida: semanales, el reporte de la ocurrencia
`semana n`; quincenales, las quincenas que se traslapan con la semana; diarias, los días de la semana
cubiertos por emitidos («5 de 7 días»); las demás, los reportes con días de ejecución en la semana.
Siempre se muestran el estado y lo que falta en el mes; ninguna semana se marca vencida por sí sola.

### D15. Migración `0019_cumplimiento.sql`

Orden: tabla `programa_ajustes` con restricciones, índices, RLS y la política `servicio_acceso_total`
cuando existe `service_role` (patrón de `0004_rls.sql`); disparador de ajustes; columna y
disparadores de `reportes`; `v_ejecuciones_reportes` a partir de la definición de `0016`; las
envolturas de `json_reporte` y `api_crear_reporte` sobre las vigentes tras `0016`–`0018` (D3), con las
reglas de envoltura copiadas en el comentario inicial; `api_obtener_programa`, `api_registrar_ajuste`,
`api_anular_ajuste`, `api_obtener_cumplimiento` y `api_listar_ejecuciones_mes`; al final, el bloque de
permisos de `0012`. PGlite la aplica al abrir la base.

## Risks / Trade-offs

- [Los cambios 2 a 5 envuelven `json_reporte` o `api_crear_reporte` y `0016` redefine
  `v_ejecuciones_reportes`] → antes de escribir `0019` se busca la última definición o envoltura de
  cada objeto en `supabase/migrations/`, se envuelve sin reescribir cuerpos renombrados y las pruebas
  cubren el conteo de días de las diarias y los días de ejecución.
- [Indicadores cerca de 0 % al arrancar: Cerritos tiene 1 realizado de 2,227 programados y 156
  vencidos] → el tablero muestra la cifra real y los vencidos ofrecen «Reprogramar» y «No ejecutado»;
  la carga del histórico queda como pregunta abierta.
- [Una reimportación con `api_importar_programa` baja lo programado por debajo de los ajustes] → el
  dominio usa `max(0, …)` y la celda muestra «Los ajustes superan lo programado»; la identidad
  `PR = E + N + P` solo se garantiza con ajustes coherentes.
- [Un no ejecutado que después sí se reporta] → el exceso se muestra «de más» y el detalle sugiere
  anular el no ejecutado.
- [Cambiar el vocabulario de estados afecta a siete llamadores y sus pruebas] → se hace en un grupo
  propio, con las pruebas actualizadas, antes de tocar la interfaz.
- [Más paradas de tabulación en la matriz] → el botón «⋯» solo aparece en celdas con faltante o con
  ajustes.
- [El corte no es una instantánea: un reporte emitido hoy cambia meses anteriores] → se documenta en
  el tablero («Datos al día de hoy»).
- [La vista semanal es aproximada para las mensuales y mayores] → muestra «Pendiente en el mes» sin
  inventar una semana planeada.
- [`api_obtener_programa` crece] → los ajustes y reportes abiertos se limitan a los vigentes de la
  celda; con el volumen actual (unas 1,800 celdas en tres clientes) cabe en una respuesta.

## Migration Plan

1. Antes de aplicar `0019`: detener el servidor de desarrollo (PGlite admite un solo proceso) y
   respaldar `storage/pglite` fuera del repositorio. Al reiniciar el servidor, PGlite aplica la
   migración; se comprueba con `/planeacion` que las celdas cargan con los campos nuevos.
2. Implementar la fase 1 (ajustes, estados, matriz, vista mensual y tablero), validarla y después la
   fase 2 (vista semanal), que no requiere otra migración.
3. Reversión: restaurar el respaldo de `storage/pglite` y revertir los commits. `0019` es aditiva (tabla,
   columna nula y funciones); en Supabase se aplicará con el resto de las migraciones (tarea 3.8 del
   cambio `reportes-mantenimiento-for-icsi-rmt-01`).

## Open Questions

- ¿Lleva semáforo el %con reporte y con qué umbrales? Mientras tanto se muestra sin semáforo.
- ¿Se carga el histórico (reportes Word de Proagro, vencidos de Cerritos) como realizados manuales o
  no ejecutados antes de usar el tablero? No cambia el cálculo, solo los datos.

## Decisiones del usuario

Del 2026-10-21 (`decisiones.md`, sección 6): fórmulas de Virtual con N = no ejecutados explícitos más
vencidos sin reprogramar; ejecutado = emitido o realizado sin reporte y «Con reporte» = cubierto por
emitidos; «Reporte en borrador» incluye en revisión; estados en dos ejes; reprogramar solo hacia
adelante dentro del periodo con motivo de una lista, con el reporte emitido en el mes destino y
penalizando la efectividad; semáforos de Virtual; matriz anual por omisión, vista mensual y vista
semanal en una segunda fase; tablero `/cumplimiento` en el menú.
