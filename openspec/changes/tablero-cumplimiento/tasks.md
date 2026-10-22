# Tasks

El cambio se trabaja en la rama `feat/tablero-cumplimiento`, apilada sobre `feat/edicion-contratos`
(cambio 5 de la serie de octubre). Su única migración es `supabase/migrations/0019_cumplimiento.sql`.
Antes de aplicarla en la base de desarrollo se detiene el servidor (PGlite admite un solo proceso) y se
respalda `storage/pglite` fuera del repositorio. La fase 1 abarca los grupos 1 a 9 y la fase 2 (vista
semanal), el grupo 10.

## 1. Rama y punto de partida

- [ ] 1.1 Crear la rama `feat/tablero-cumplimiento` a partir de `feat/edicion-contratos`, comprobar
      que existen `0015_importar_programa.sql`, `0016_dias_ejecucion.sql`, `0017_fotos_rotacion.sql`
      y `0018_bitacora_catalogo.sql`, y que `npm run test` pasa antes de cambiar nada.
- [ ] 1.2 Localizar en `supabase/migrations/` la última definición o envoltura de
      `v_ejecuciones_reportes`, `json_reporte`, `api_crear_reporte` y `api_obtener_programa`, y anotar
      en el encabezado de `0019_cumplimiento.sql` de qué migración parte cada una y las reglas de
      envoltura de `0016`; verificar con una búsqueda que ninguna migración posterior las vuelve a
      definir.

## 2. Datos: migración 0019 y repositorio

- [ ] 2.1 Crear en `0019_cumplimiento.sql` la tabla `programa_ajustes` (D2) con sus restricciones,
      índices, RLS, la política para `service_role` y el disparador de partida y meses del periodo;
      verificar con pruebas sobre PGlite en `src/lib/server/repositorios/repositorios.spec.ts` que se
      rechazan el destino fuera del periodo, el destino no posterior al origen, la partida de otro
      sitio, la cantidad no entera y el motivo «otro» sin nota.
- [ ] 2.2 Agregar `api_registrar_ajuste` y `api_anular_ajuste` (D2) y verificar con pruebas el rechazo
      `IC422` de una cantidad mayor que lo que falta, el registro válido, el rechazo `IC409` al anular
      con un reporte emitido o en revisión ligado o un ajuste ya anulado, y que anular con un borrador
      ligado lo desliga sin cambiar su `version`.
- [ ] 2.3 Agregar `reportes.reprogramacion_id`, sus disparadores de validación y de copia en las
      revisiones, y las envolturas de `json_reporte` y `api_crear_reporte` (D3); verificar con pruebas
      que se rechazan el vínculo con otro mes, con otra partida o con un ajuste anulado, que una
      revisión conserva el vínculo y que crear un reporte ligado no sube su versión ni pierde los días
      de ejecución.
- [ ] 2.4 Redefinir `v_ejecuciones_reportes` con el discriminador (D4) y verificar con pruebas que una
      mensual con su reporte de octubre y otro ligado a una reprogramación cuenta 2, que dos TAG de la
      misma ocurrencia y reprogramación cuentan 1 y que una diaria sigue contando sus días distintos.
- [ ] 2.5 Redefinir `api_obtener_programa` y crear `api_obtener_cumplimiento` y
      `api_listar_ejecuciones_mes` (D5); verificar con pruebas los campos nuevos de cada celda
      (`salida`, `entrada`, `noEjecutado`, `reportesAbiertos` y `ajustes` con sus ejecuciones ligadas),
      el filtro por cliente y mes de corte con dos programas y que las ejecuciones del mes omiten los
      sustituidos.
- [ ] 2.6 Ampliar `src/lib/dominio/esquemas.ts` (`MOTIVOS_AJUSTE` con etiquetas, ajuste, celda,
      `reprogramacionId` del reporte y lectura de cumplimiento) y `src/lib/server/repositorios/programa.ts`
      (`registrarAjuste`, `anularAjuste`, `obtenerCumplimiento` y `listarEjecucionesMes`); verificar que
      las pruebas de 2.1 a 2.5 pasan por el repositorio y que `npm run check` no da errores.
- [ ] 2.7 Aplicar `0019` en la base de desarrollo: detener el servidor de desarrollo, respaldar
      `storage/pglite` fuera del repositorio, reiniciarlo y comprobar con GET a `/planeacion` de
      Cerritos y de Proagro que la matriz carga con los campos nuevos.

## 3. Dominio: estados e indicadores

- [ ] 3.1 Crear `src/lib/dominio/cumplimiento.ts` con `objetivo`, `esperado`, `faltan` y
      `estadoEjecucion` (D6), y verificar en `cumplimiento.spec.ts` los escenarios del requisito
      «Estado de ejecución por partida y mes» y el ejecutado «de más».
- [ ] 3.2 Agregar `estadoDocumental`, las etiquetas, los símbolos y el detalle de la celda, y verificar
      con pruebas «Con reporte», «Reporte en borrador (en revisión)», el ejecutado sin reporte y el mes
      reprogramado sin nada que reportar.
- [ ] 3.3 Agregar los indicadores al mes de corte (D7) y verificar con pruebas el ejemplo de la spec
      (PR 10: E 7, R 2, N 2 y P 1), los extras, el vencido sin ajuste, el corte anterior y la identidad
      `PR = E + N + P` en una tabla de casos con reprogramaciones dentro y fuera del corte.
- [ ] 3.4 Agregar los porcentajes truncados y los semáforos, y verificar con pruebas 77 %, 77 % y 71 %,
      «Sin datos», 89.9 % amarillo mostrado como 89 %, 90 % verde y 59.5 % rojo mostrado como 59 %.
- [ ] 3.5 Agregar la agrupación por contrato, sitio y partida, la tendencia mensual y los reportes que
      faltan (D13), y verificar con pruebas los subtotales, el filtro de periodicidad, el mes sin datos,
      la precedencia de los grupos y que lo reprogramado no aparece en el mes de origen.

## 4. Consumidores del estado

- [ ] 4.1 Sustituir `estadoCelda` en `src/lib/dominio/planeacion.ts` (D8) y actualizar
      `planeacion.spec.ts` para verificar que los vencidos omiten lo reprogramado y lo no ejecutado,
      que el resumen del mes da 5 de 33 con 27 pendientes cuando hay 1 no ejecutado y que el siguiente
      trabajo incluye lo reprogramado en el mes destino.
- [ ] 4.2 Adaptar `src/lib/dominio/seleccion.ts` y `src/lib/server/seleccion-captura.ts`, y verificar
      en `seleccion.spec.ts` que una partida con su único vencido no ejecutado queda en «Otras
      partidas» y que un mes futuro programado sigue contando como pendiente.
- [ ] 4.3 Adaptar `CapturaView.svelte`, `MiTrabajoView.svelte` y `PlaneacionView.svelte` al nuevo
      vocabulario sin cambiar su diseño, y verificar que sus pruebas `.svelte.spec.ts` actualizadas y
      `npm run check` pasan.

## 5. Captura de un trabajo reprogramado

- [ ] 5.1 Devolver las reprogramaciones que llegan al mes en `datosDeSeleccion`, aceptar
      `?reprogramacion=` en `src/routes/captura/+page.server.ts`, mostrar la opción en
      `CapturaView.svelte` y enviar `reprogramacionId` hasta `crearReporte` (D9); verificar con una
      prueba sobre PGlite en `seleccion-captura.spec.ts` y con pruebas de componente que la opción solo
      aparece con reprogramaciones, que llega preseleccionada con el parámetro y que el reporte creado
      queda ligado.
- [ ] 5.2 Mostrar «Reprogramado desde junio 2026» en el contexto del editor
      (`src/lib/components/reportes/EditorReporte.svelte`) y verificarlo con una prueba de componente.

## 6. Matriz anual con estados y ajustes

- [ ] 6.1 Cambiar en `PlaneacionView.svelte` la leyenda (dos ejes), los símbolos, la marca documental,
      las anotaciones «→ oct» y «+1 desde jun» y el nombre accesible de cada celda (D10), y verificarlo
      con pruebas de componente.
- [ ] 6.2 Crear `src/lib/components/planeacion/DialogoAjuste.svelte` y las acciones `registrarAjuste` y
      `anularAjuste` en `src/routes/planeacion/+page.server.ts`, con la notificación «Deshacer»;
      verificar con pruebas el foco inicial en «Cancelar», los meses destino solo posteriores, la nota
      obligatoria con «Otro», el error del servidor dentro del diálogo, que «Deshacer» anula, la
      advertencia de borradores ligados, que una celda sin faltante ni ajustes no muestra el botón y que
      una celda sin faltante con ajustes solo ofrece anularlos.
- [ ] 6.3 Agregar «Reprogramar» y «No ejecutado» a la lista de pendientes vencidos y verificarlo con
      una prueba de componente.

## 7. Vista mensual

- [ ] 7.1 Leer `?vista=` y `?mes=` en `src/routes/planeacion/+page.server.ts` y agregar el selector
      «Anual | Mensual» con enlaces y `aria-current` que conservan los filtros (D11); verificar con
      pruebas que sin parámetro se muestra la matriz anual y que el filtro de periodicidad se conserva.
- [ ] 7.2 Crear `src/lib/components/planeacion/VistaMensual.svelte` y verificar con pruebas el mes en
      curso por omisión, el orden por urgencia, «Continuar borrador», la acción «⋯» y que en el último
      mes del periodo no se ofrece el mes siguiente.

## 8. Tablero de cumplimiento

- [ ] 8.1 Agregar la vista `cumplimiento` a `src/lib/layout/navegacion.ts` («Cumplimiento del
      programa») y la entrada «Cumplimiento» tras «Anual» en `Sidebar.svelte`; verificar con
      `navegacion.spec.ts` y `Sidebar.svelte.spec.ts` la ruta, el título y el estado activo.
- [ ] 8.2 Crear `src/routes/cumplimiento/+page.server.ts` y `+page.svelte` con los filtros y el mes de
      corte (D12); verificar con una prueba sobre PGlite el filtro por cliente, que un corte futuro se
      limita al mes en curso y el caso sin programas.
- [ ] 8.3 Crear `IndicadoresCumplimiento.svelte` y `Semaforo.svelte` en
      `src/lib/components/cumplimiento/` y verificar con pruebas que cada semáforo muestra icono y texto
      además del color y que un porcentaje sin datos muestra «—» sin semáforo.
- [ ] 8.4 Crear `TablaCumplimiento.svelte` y verificar con pruebas el subtotal por contrato, el total,
      el desglose por partida con un sitio elegido y el enlace a la planeación del sitio.
- [ ] 8.5 Crear `TendenciaCumplimiento.svelte` (SVG con las metas y tabla equivalente) y verificar con
      pruebas los meses evaluados y el mes sin datos sin punto y con «—» en la tabla.
- [ ] 8.6 Crear `ReportesQueFaltan.svelte` y verificar con pruebas los tres grupos, «Capturar» con
      contrato, sitio, partida y mes, «Continuar borrador» y «Ver los N».
- [ ] 8.7 Componer `src/lib/components/views/CumplimientoView.svelte` con el aviso «Datos al día de
      hoy» y el estado sin programas, y verificarlo con una prueba de componente con datos de ejemplo.

## 9. Punto de control de la fase 1

- [ ] 9.1 Ejecutar `npm run check`, `npm run lint` y `npm run test` sin errores, revisar en el
      navegador `/planeacion` (anual y mensual) y `/cumplimiento` con los datos de Cerritos y Proagro, y
      hacer el commit de la fase 1.

## 10. Fase 2: vista semanal

- [ ] 10.1 Agregar a `cumplimiento.ts` la función pura de la semana (D14) y verificar con pruebas la
      semana 1 de mayo de 2026 (del 1 al 3), la semanal con reporte de la semana 2, la quincenal que se
      traslapa, la diaria con «5 de 7 días» y la mensual «Pendiente en el mes».
- [ ] 10.2 Agregar `?vista=semanal&semana=` y `src/lib/components/planeacion/VistaSemanal.svelte` con
      la navegación entre semanas dentro del periodo, y la opción «Semanal» en el selector; verificar
      con pruebas de componente la semana parcial y los límites del periodo.

## 11. Cierre

- [ ] 11.1 Ejecutar `npm run check`, `npm run lint` y `npm run test` sin errores y anotar los números
      reales.
- [ ] 11.2 Validar en el navegador a 1366 × 800, en tema claro y oscuro, `/planeacion` (anual, mensual,
      semanal y diálogo de ajuste), `/captura` con una reprogramación y `/cumplimiento`: contraste AA
      (incluidos colores de estado y semáforos), foco visible y sin desborde horizontal, con capturas
      fuera del repositorio.
- [ ] 11.3 Hacer el commit y ejecutar `scripts/revision-codex.ps1` con `-Cambio` (el cambio OpenSpec
      tablero-cumplimiento), `-Base` (último commit de `feat/edicion-contratos`), `-Sha` (último commit
      del cambio), `-Fase tablero-cumplimiento`, `-Ronda` y como `-ArchivosContexto` los artefactos del
      cambio y `0019_cumplimiento.sql` (como máximo 2 rondas); registrar
      hallazgos y resoluciones en `docs/revisiones/tablero-cumplimiento.md`.
- [ ] 11.4 Agregar la entrada en `HISTORIAL.md` (fecha local, motivo, alcance, archivos, validación
      real y pendientes: carga del histórico y semáforo del %con reporte) y verificar su formato con
      Prettier.
- [ ] 11.5 Actualizar `docs/CONTEXTO_PROYECTO.md` (ruta `/cumplimiento` en el menú, vistas de
      `/planeacion`, migraciones hasta `0019` y estado del cambio) y verificar enlaces y formato con
      Prettier.

## Workflow follow-up

- Archivar el cambio cuando el usuario lo apruebe, después de archivar o junto con
  `reportes-mantenimiento-for-icsi-rmt-01`, `ux-editor-inicio-captura` y los cambios 1 a 5 de la serie.
- Decidir con el usuario la carga del histórico antes de usar el tablero para seguimiento formal.
