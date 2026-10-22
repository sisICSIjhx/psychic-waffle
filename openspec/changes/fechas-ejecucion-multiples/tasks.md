# Tasks

Decisiones aplicadas en `design.md` (sección «Decisiones aplicadas»). Migración reservada para este
cambio: `supabase/migrations/0016_dias_ejecucion.sql` (no usar otro número). Ningún archivo, prueba ni
dato de ejemplo lleva nombres de firmantes, responsables, técnicos ni nombres de reportes reales.

## 1. Rama y punto de partida

- [x] 1.1 Crear la rama `feat/fechas-multiples` a partir de `feat/programa-anual` (con el cambio
      `importacion-programa-anual` y su migración `0015_importar_programa.sql` ya integrados) y
      verificar que `npm run test` pasa antes de cambiar nada.
- [x] 1.2 Comprobar con una búsqueda en `supabase/migrations/0015_importar_programa.sql` que no
      redefine `json_reporte`, `api_insertar_reporte`, `api_guardar_reporte`, `api_cambiar_estado`,
      `api_crear_revision` ni `v_ejecuciones_reportes`; si alguna cambió, ajustar en `design.md` (D3,
      D4 y D11) el sufijo del renombrado y la definición de partida antes de seguir.

## 2. Dominio puro de los días

- [x] 2.1 Crear `src/lib/dominio/dias-ejecucion.ts` (`SegmentoDias`, `analizarDias`, `textoDias`,
      `agregarDia`, `diasCubiertos`, `diasFueraDe`) importando solo de `documento.ts`, y verificar con
      `src/lib/dominio/dias-ejecucion.spec.ts` los ejemplos del usuario («05-08», «02, 03, 04», «15,
      16, 20-25»), los textos reales de varios días («1 al 3», «28,30», «09,30/ JUNIO / 2026»,
      «01-31/ MAYO / 2026», «01 AL 31», «01-31»), «15 y 16», «02 03 04», el orden de «20-25, 15,
      16», el texto vacío y cada error de la spec (repetido, traslapado, inexistente, invertido, no
      reconocido y otro mes).
- [x] 2.2 Agregar `fechasEncabezado(segmentos)` a `src/lib/dominio/documento.ts` y verificar en
      `documento.spec.ts` que un día da lo mismo que `fechaEncabezado` («18 / MAYO / 2026»), los tres
      ejemplos del usuario, «01-03 / MAYO / 2026» para «1 al 3» y el `RangeError` sin segmentos o con
      meses distintos.

## 3. Base de datos: migración `0016_dias_ejecucion.sql`

Las pruebas de este grupo llaman las funciones SQL directamente sobre PGlite en memoria. El contrato
Zod todavía envía `fechaEjecucion`: con la envoltura de 3.2, que acepta esa clave, la suite existente
vuelve a pasar (entre 3.1 y 3.2 el trigger ya deriva la fecha de los días y el guardado heredado la
deja vacía).

- [x] 3.1 Crear `supabase/migrations/0016_dias_ejecucion.sql` con las columnas `dias_ejecucion` y
      `fecha_ejecucion_fin`, el relleno con `reportes_actualizado` desactivado y sin tocar `version`,
      `dias_ejecucion_validos` con sus checks y el trigger `reportes_dias_ejecucion`; verificar en
      `src/lib/server/repositorios/repositorios.spec.ts`, aplicando las migraciones hasta `0015`,
      insertando un borrador con fecha, un emitido con fecha y documento y un borrador sin fecha, y
      aplicando después `0016`, que días, `version`, `estado` y `actualizado_en` quedan como pide la
      spec, y que una fecha inexistente o un tipo distinto en `dias_ejecucion` da `23514`.
- [x] 3.2 Agregar a `0016` las envolturas de `json_reporte` (`json_reporte_0007`),
      `api_insertar_reporte` (`api_insertar_reporte_0003`) y `api_guardar_reporte`
      (`api_guardar_reporte_0003`) con renombrado idempotente y el comentario inicial con la convención
      de D3; verificar con pruebas que el guardado con `diasEjecucion` deriva `fechaEjecucion` y
      `fechaEjecucionFin`, que el `fechaEjecucion` heredado se vuelve un segmento, que días de otro mes
      o traslapados se rechazan con `23514` y conservan los días anteriores, que la versión sube una
      sola vez por guardado y que `api_aplicar_catalogo` conserva los días.
- [x] 3.3 Redefinir `api_cambiar_estado` (IC422 «Faltan los días de ejecución» con el campo
      `diasEjecucion`); verificar con pruebas que enviar sin días se rechaza con ese campo y que la
      revisión de un emitido con «15, 16, 20-25» conserva los tres segmentos (trigger de D2).
- [x] 3.4 Redefinir `v_ejecuciones_reportes` con las mismas columnas y el conteo por día de las
      partidas diarias; verificar en el bloque «realizado derivado de los reportes» de
      `repositorios.spec.ts` los escenarios de `specs/programa-anual/spec.md` (mes completo 31 de 31,
      semanas 1 y 2 con 10, días repetidos entre reportes por TAG con 5, borrador sin contar y partida
      no diaria con una ejecución) y que las pruebas de avance existentes siguen pasando.
- [x] 3.5 Cerrar `0016` con el bloque de permisos de `0007`/`0012` y verificar en
      `src/lib/server/bd/cliente.spec.ts` que `validarFuncion('api_guardar_reporte_0003')` se rechaza y
      `validarFuncion('api_guardar_reporte')` no; `npm run test` debe pasar completo.

## 4. Contrato de datos, validación y editor

- [x] 4.1 Agregar `esquemaSegmentoDias` y `esquemaDiasEjecucion` a `src/lib/dominio/esquemas.ts`,
      `diasEjecucion` y `fechaEjecucionFin` a `esquemaReporte`, y cambiar `fechaEjecucion` por
      `diasEjecucion` en `esquemaReporteNuevo` y `esquemaReporteGuardado`; ajustar en
      `src/lib/dominio/captura.ts` `aGuardado`, `prellenarReporte` (`diasEjecucion: []`),
      `ReporteValidable`, el bloque de la fecha de `validarParaRevision` y `CAMPOS_ENCABEZADO`
      (`diasEjecucion` y el alias `fechaEjecucion` al `id` `fecha`); actualizar las pruebas de servidor
      que usan `fechaEjecucion` (`src/lib/dominio/captura.spec.ts`, `src/lib/server/captura.spec.ts`,
      `seleccion-captura.spec.ts`, `historial.spec.ts` y `repositorios.spec.ts`) y verificar con
      `npm run test:unit -- --run --project server` el rechazo de segmentos en desorden, traslapados,
      de dos meses o más de 31, «Capture los días de ejecución.» y el mensaje de días fuera de la semana
      2 de mayo de 2026.
- [x] 4.2 Reemplazar en `src/lib/components/reportes/EditorReporte.svelte` (sintaxis heredada) el campo
      de fecha por el campo de texto `id="fecha"` con estado local, ayuda del periodo, vista previa «En
      el documento: …» y `ErrorCampo` enlazados por `aria-describedby`, y quitar de `paraGuardar` la
      conversión de la fecha; verificar con `npm run check` y en `EditorReporte.svelte.spec.ts` la
      vista previa de «15 y 16, 20 al 25», el texto pegado «05-08/ MAYO /2026», la forma «01-03» al
      salir y los mensajes de error de la spec.
- [x] 4.3 No enviar al autoguardado un texto inválido, contarlo en «Faltan N» y en el resumen de envío,
      y mostrar los motivos «Corrija los días de ejecución» e «Indique los días de ejecución» en
      «Descargar DOCX»; verificar con pruebas que los días guardados no cambian con «18, 2O», que al
      corregir a «18, 20» se guarda y que el texto se regenera tras un cambio externo sin foco.
- [x] 4.4 Agregar «Agregar hoy» y «Todo el periodo» con «Deshacer» por `notificaciones.ts` y retirar las
      pruebas de «Hoy»; verificar con fecha fija (`hoy`) los escenarios de la spec (hoy dentro y fuera
      del periodo, «01-03» en la semana 1 de mayo de 2026 y el deshacer que restaura «15, 16,
      20-25») y que `npm run test` pasa completo.

## 5. Servicio y documento

- [x] 5.1 Cambiar `ReporteDocumento.encabezado.fecha` por `encabezado.dias` en
      `src/lib/server/documentos/generar.ts` (la clave `encabezado.fecha` de la plantilla se llena con
      `fechasEncabezado`) y exigir días en `generarDocumento` y `documentoDe` de
      `src/lib/server/captura.ts`; verificar en `generar.spec.ts` que un día sigue saliendo «18 / MAYO /
      2026» y varios «15, 16, 20-25 / MAYO / 2026», en `src/lib/server/captura.spec.ts` el mensaje
      «Capture los días de ejecución para generar el documento.» sin documento registrado, y que
      `VERSION_PLANTILLA` sigue en `FOR-ICSI-RMT-01.v1`.
- [x] 5.2 Pasar `scripts/datos-prueba/*.json` a `dias` (`postes-volumen-alto.json` con «15, 16, 20-25»
      de mayo de 2026) y verificar con `npm run prueba:documental` y a la vista en Word que la fila
      Fecha se lee completa y que una lista larga ocupa como máximo dos renglones sin mover el resto
      del encabezado.

## 6. Captura de partidas diarias

- [x] 6.1 Sustituir `tipoOcurrencia` por `modosDePeriodo` en `src/lib/dominio/captura.ts` y validar la
      ocurrencia en `prellenarReporte` (diaria: mes completo o semana; `dia` ya no se acepta al crear);
      verificar en `captura.spec.ts` los modos de cada periodicidad, el título «… MAYO 2026» de una
      diaria por mes, «… SEMANA 1 MAYO 2026» por semana y el rechazo de una ocurrencia `dia`.
- [x] 6.2 Mostrar en `src/lib/components/views/CapturaView.svelte` «Mes completo | Por semana» con
      `BotonesSegmentados` para las partidas diarias y aceptar la ocurrencia vacía en la acción `crear`
      de `src/routes/captura/+page.server.ts`; verificar en `CapturaView.svelte.spec.ts` y
      `seleccion-captura.spec.ts` la creación por mes y por semana de una partida diaria y que una
      semanal sigue pidiendo solo la semana.
- [x] 6.3 Hacer que el aviso de reporte existente de una partida diaria muestre todos los reportes de
      la partida y el mes; verificar con una prueba de componente el escenario del reporte del mes
      completo al elegir la semana 2, sin impedir la creación.

## 7. Base de desarrollo

- [ ] 7.1 Detener el servidor de desarrollo (PGlite no admite dos procesos), respaldar
      `storage/pglite` fuera del repositorio, leer del respaldo con un script de solo lectura fuera del
      repositorio el `id`, `version`, `estado`, `actualizado_en` y `fecha_ejecucion` de los reportes, e
      iniciar el servidor para aplicar `0016`; verificar que los 3 reportes tienen un segmento con su
      fecha y los mismos valores leídos, y que el emitido descarga el documento ya registrado.

## 8. Cierre

- [x] 8.1 Ejecutar `npm run check`, `npm run lint` y `npm run test` sin errores.
- [ ] 8.2 Validar en el navegador a 1366 × 800, en tema claro y oscuro: el campo de días (vista previa,
      errores, «Agregar hoy», «Todo el periodo» y «Deshacer»), «Descargar DOCX» con sus motivos y la
      captura «Mes completo | Por semana»; contraste AA, foco visible y sin desborde horizontal, con
      capturas antes y después fuera del repositorio.
- [ ] 8.3 Hacer commit y revisar con `scripts/revision-codex.ps1` usando `-Cambio` (el cambio OpenSpec
      `fechas-ejecucion-multiples`), `-Base` (último commit de `feat/programa-anual`), `-Sha` (último
      commit del cambio), `-Fase fechas-multiples`, `-Ronda` y como `-ArchivosContexto` los artefactos
      de este cambio y `0016_dias_ejecucion.sql` (como máximo 2 rondas); registrar hallazgos y
      resoluciones en `docs/revisiones/fechas-ejecucion-multiples.md`.
- [ ] 8.4 Registrar el cambio en `HISTORIAL.md` (fecha, motivo, alcance, archivos, validación real y
      pendientes), sin datos personales.
- [ ] 8.5 Actualizar `docs/CONTEXTO_PROYECTO.md` con las migraciones `0001…0016` y el estado del cambio
      (no cambian rutas) y verificar que el documento sigue breve y con enlaces válidos.

## Workflow follow-up

- Archivar el cambio cuando el usuario lo apruebe, después de archivar o junto con
  `reportes-mantenimiento-for-icsi-rmt-01` y `ux-editor-inicio-captura`.
- Aplicar `0016` en Supabase con el resto de las migraciones (tarea 3.8 del cambio anterior) y repetir
  allí las pruebas de repositorio.
- Si más adelante se importan reportes Word históricos, reutilizar `analizarDias` para leer la fila
  «FECHA:».
