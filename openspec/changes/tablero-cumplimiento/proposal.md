# Proposal

## Why

El usuario pidió un tablero para ver el cumplimiento del programa anual y los reportes que faltan,
como el que lleva el libro de Virtual, pero conservando la matriz anual actual («es más fácil de
identificar») y agregando una vista mensual y, quizás, una semanal. También pidió que una partida
tenga más estados («Sin reporte», «Reporte en borrador» y «Con reporte», que es el estado final) y que
se pueda reprogramar, lo cual afecta la efectividad. Hoy la planeación no puede registrar nada de eso,
así que el seguimiento se hace fuera del sistema y los indicadores no existen.

## What Changes

**Comportamiento actual comprobado (2026-10-21, rama `feat/ux-fase-c`):**

- El programa guarda solo cantidades por partida y mes (`programa_meses`, `0002_programa.sql`) y los
  realizados sin reporte (`programa_realizados_manuales`). No hay forma de reprogramar, de marcar «no
  ejecutado» ni de guardar un motivo.
- `v_ejecuciones_reportes` (`0003_reportes.sql`) cuenta las ocurrencias distintas de los reportes
  emitidos por partida y mes (el cambio `fechas-ejecucion-multiples`, migración `0016`, agrega los días
  distintos de las diarias); una partida mensual cuenta como máximo 1 por mes, y la fecha de ejecución
  debe caer en el mes del reporte (`reportes_fecha_en_periodo`). Un trabajo reprogramado a un mes que
  ya tiene su propia ocurrencia nunca llegaría a contar.
- `estadoCelda` (`src/lib/dominio/planeacion.ts`) tiene cinco estados (sin programa, cumplido,
  pendiente, vencido y extra) y solo compara lo realizado con lo programado. Los borradores no se ven
  en la matriz.
- `/planeacion` muestra la matriz anual P/R con «Capturar», los reportes emitidos y el registro de
  realizados manuales; no hay vista mensual ni semanal, tablero, porcentaje de cumplimiento ni de
  efectividad. El inicio «Mi trabajo» calcula solo cumplidas sobre programadas del mes.
- Datos de desarrollo: Cerritos tiene 2,227 ejecuciones programadas, 1 realizada y 156 celdas
  vencidas; Proagro llega con su programa importado por `importacion-programa-anual`.

**Comportamiento propuesto:**

- **Ajustes del programa:** cada partida y mes admite «Reprogramar» (solo a un mes posterior dentro
  del periodo) y «No ejecutado», con cantidad, motivo de una lista cerrada (cliente u operación, clima,
  materiales o refacciones, acceso o permisos, personal, otro con nota) y anulación. El plan original
  no cambia: sigue siendo el denominador.
- **Reporte de lo reprogramado:** el trabajo reprogramado se reporta en el mes destino, ligado a su
  reprogramación, y cuenta aunque ese mes ya tenga su propia ocurrencia. Las revisiones conservan el
  vínculo.
- **Estados en dos ejes por partida y mes:** ejecución (programado, pendiente, vencido, reprogramado,
  no ejecutado, ejecutado, extra) y documental (sin reporte, reporte en borrador —incluye en
  revisión—, con reporte como estado final).
- **Indicadores** a un mes de corte: PR, E, R, N y P (más extras aparte), %cumplimiento = E/(E+N),
  %efectividad = E/(E+R) y %con reporte, con los semáforos del libro de Virtual. N incluye los
  vencidos sin reprogramar.
- **Planeación:** la matriz anual se conserva como vista por omisión con la nueva leyenda y las
  acciones «Reprogramar» y «No ejecutado» (diálogo y «Deshacer»); se agrega la vista mensual y, en una
  segunda fase del mismo cambio, la vista semanal. «Mi trabajo» y la captura dejan de mostrar como
  pendiente lo reprogramado o no ejecutado y lo muestran en el mes destino.
- **Tablero `/cumplimiento`** en el menú: indicadores con semáforo, filtros (cliente, contrato,
  sitio, periodicidad y mes de corte), tabla por contrato y sitio (y por partida con un sitio
  elegido), tendencia mensual y «Reportes que faltan».
- **Datos:** migración `supabase/migrations/0019_cumplimiento.sql` (aditiva).

Fuera de alcance: semana o fecha planeada por partida (la vista semanal no la necesita), umbrales
por contrato, restricción de los ajustes por rol y registro del usuario que los hace (llegan con la
autenticación), cambios en el DOCX y carga del histórico de reportes Word.

## Capabilities

### New Capabilities

- `tablero-cumplimiento`: indicadores de cumplimiento, efectividad y reportes del programa anual a un
  mes de corte, con semáforos, filtros, tabla por contrato y sitio, tendencia y reportes que faltan.
- `programa-anual`: se **agregan** requisitos de ajustes (reprogramación y no ejecutado), estados en
  dos ejes, reporte de lo reprogramado y vistas mensual y semanal. Es la misma ruta de capacidad que
  define el cambio sin archivar `reportes-mantenimiento-for-icsi-rmt-01`; este cambio solo usa
  `ADDED` y cada requisito nombra el anterior al que amplía.

### Modified Capabilities

Ninguna en `openspec/specs/`.

## Impact

- Datos: `0019_cumplimiento.sql` crea `programa_ajustes`, agrega `reportes.reprogramacion_id`,
  redefine `v_ejecuciones_reportes` y `api_obtener_programa`, envuelve `json_reporte` y
  `api_crear_reporte` (convención de envolturas de `0016`), y crea `api_registrar_ajuste`,
  `api_anular_ajuste`, `api_obtener_cumplimiento` y `api_listar_ejecuciones_mes`. Requiere detener el servidor de desarrollo y respaldar
  `storage/pglite` antes de aplicarla.
- Dominio: nuevo `src/lib/dominio/cumplimiento.ts`; `planeacion.ts` y `seleccion.ts` usan sus estados
  en lugar de `estadoCelda`; `esquemas.ts` amplía la celda del programa.
- Servidor y rutas: `src/lib/server/repositorios/programa.ts`, `src/lib/server/captura.ts`,
  `src/lib/server/seleccion-captura.ts`, `src/routes/planeacion/`, `src/routes/captura/`,
  `src/routes/+page.server.ts` y la ruta nueva `src/routes/cumplimiento/`.
- Interfaz: `PlaneacionView.svelte`, `CapturaView.svelte`, `MiTrabajoView.svelte`, componentes nuevos
  en `src/lib/components/planeacion/` y `src/lib/components/cumplimiento/`, y el menú
  (`src/lib/layout/navegacion.ts`, `Sidebar.svelte`).
- Depende de los cambios 1 a 5 de octubre (rama apilada sobre `feat/edicion-contratos`); sin
  dependencias nuevas.
