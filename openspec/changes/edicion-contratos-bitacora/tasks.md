# Tasks

Cambio 5 del orden acordado: rama `feat/edicion-contratos` apilada sobre `feat/editor-fotos`
(cambio `editor-fotos`) y migración reservada `supabase/migrations/0018_bitacora_catalogo.sql`; no se
usa otro número. Decisiones aplicadas (`design.md`): solo corrección del contrato (el cliente no
cambia), sitio corregido en su lugar con asociar y quitar sin datos, «Corregir datos» y «Cambiar
firmante desde…», diálogo con motivo y casilla de borradores marcada, bitácora con usuario nulo y
preparación para administradores sin autenticación. Ninguna tarea corrige datos reales de Proagro o
Virtual, y ningún archivo lleva nombres de firmantes ni de reportes: las pruebas usan nombres ficticios.

## 1. Rama y punto de partida

- [ ] 1.1 Crear la rama `feat/edicion-contratos` a partir de `feat/editor-fotos`, comprobar que existen
      `0015_importar_programa.sql`, `0016_dias_ejecucion.sql` y `0017_fotos_rotacion.sql` y que
      `npm run test` pasa antes de cambiar nada.
- [ ] 1.2 Localizar la última definición en `0001…0017` de `api_guardar_contrato`, `api_guardar_sitio`,
      `api_guardar_firmante`, `api_asociar_sitio`, `json_contrato`, `json_sitio`, `json_firmante` y
      `json_reporte`, y buscar en `src/` y `scripts/` cualquier llamada a `guardarContrato`,
      `guardarSitio` o `guardarFirmante` con `id` (incluidas las del cambio
      `importacion-programa-anual`, como `--ajustar-vigencia` de `scripts/importar-catalogo.ts`);
      verificar que la lista queda anotada en la descripción del primer commit y que cada llamador con
      `id` tiene su paso a la edición dentro de las tareas 3.4 o 4.5.

## 2. Migración 0018: bitácora, versión de los datos y copia del contrato

- [ ] 2.1 Crear `supabase/migrations/0018_bitacora_catalogo.sql` con la tabla `cambios_catalogo`, sus
      índices, el trigger que rechaza `UPDATE`, `DELETE` y `TRUNCATE`, RLS, la política
      `servicio_acceso_total`, la revocación a `anon` y `authenticated` y el bloque final de permisos de
      `0007` (D2); verificar con pruebas sobre PGlite que «habilita RLS en todas las tablas» sigue
      pasando, que actualizar o borrar un registro falla y que un motivo de menos de 10 caracteres se
      rechaza.
- [ ] 2.2 Agregar `actualizadoEn` a `json_contrato`, `json_sitio` y `json_firmante` y a
      `esquemaContrato`, `esquemaSitio` y `esquemaFirmante` en `src/lib/dominio/esquemas.ts`,
      actualizando los datos de ejemplo de las pruebas; verificar con `npm run check` y con las
      pruebas actuales en verde.
- [ ] 2.3 Agregar `reportes.contrato_copia`, la función `datos_contrato_reporte`, el trigger
      `before insert` (revisión: copia del original; reporte nuevo: datos vigentes) y el llenado de los
      reportes existentes (D8); verificar con pruebas sobre PGlite que un reporte nuevo guarda en la
      copia lo mismo que `prellenarReporte` puso en su encabezado, que una revisión recibe la copia del
      original aunque el contrato haya cambiado y que tras la migración ningún reporte queda con la
      copia vacía.
- [ ] 2.4 Agregar `reconciliar_contrato_reporte(id, forzar)` y verificar con pruebas que un campo que
      cambió en el contrato y no se escribió a mano se actualiza y sube `version`, que una firma escrita
      a mano se conserva sin `forzar` y se reemplaza con `forzar`, que sin firmante vigente la firma se
      conserva y que un reporte en revisión, emitido o sustituido no cambia.

## 3. Funciones de edición, altas y consultas

- [ ] 3.1 Agregar `api_editar_contrato` con ensayo por reversión (verdadero por omisión, D3), motivo de
      10 a 500 caracteres, `actualizadoEn` (IC409), rechazo sin cambios, número duplicado, vigencia que
      deja datos fuera (D5), impacto, propagación opcional y registro en la bitácora; verificar con
      pruebas que el ensayo no escribe nada y da los mismos conteos que la aplicación, que el cliente no
      se puede cambiar y que el escenario del programa de Proagro de marzo de 2026 a febrero de 2027
      rechaza la vigencia 2026-05-01..2027-04-30 indicando marzo y abril de 2026.
- [ ] 3.2 Agregar `api_editar_sitio`, `api_quitar_sitio` y `api_resumen_sitios_contrato` (D6);
      verificar con pruebas el sitio que no es del contrato, la clave duplicada, el impacto con otro
      contrato que comparte el sitio, la propagación a los borradores del sitio en ambos contratos, el
      rechazo de quitar con partidas, programas o reportes y que quitar no borra el sitio del catálogo.
- [ ] 3.3 Agregar `api_corregir_firmante` y `api_cambiar_firmante` (D7); verificar con pruebas el
      traslape al corregir fechas, la fecha de cambio no válida con la primera fecha permitida, el cierre
      del anterior el día previo, que el nuevo hereda el fin del anterior, que
      `api_firmantes_vigentes` devuelve a cada uno según el mes y el primer mes afectado de un cambio a
      mitad de mes.
- [ ] 3.4 Redefinir `api_guardar_contrato`, `api_guardar_sitio` y `api_guardar_firmante` solo para
      altas (con `id`, IC422 `usar_edicion`), registrar en la bitácora cada alta y la asociación de
      `api_asociar_sitio` con su `origen`, quitar `id` de `ContratoEntrada`, `SitioEntrada` y
      `FirmanteEntrada`, y pasar `origen: 'script'` en `scripts/importar-catalogo.ts` y
      `scripts/derivar-partidas.ts`; verificar con pruebas que una alta queda registrada sin motivo, que
      una actualización por `id` se rechaza, que las pruebas que crean contratos, sitios y firmantes
      siguen pasando y que `npm run check` no señala llamadores con `id` salvo `--ajustar-vigencia` de
      `scripts/importar-catalogo.ts`, que pasa a la edición en la tarea 4.5.
- [ ] 3.5 Agregar `api_listar_cambios_catalogo` {contratoId, pagina, tamano} con los registros del
      contrato, de sus firmantes y de sus sitios asociados, del más reciente al más antiguo; verificar
      con pruebas la paginación de 20, el orden y que la corrección de un sitio hecha desde otro contrato
      aparece en ambos historiales.
- [ ] 3.6 Agregar `api_estado_contrato_reporte` y `api_actualizar_contrato_reporte` (D13); verificar con
      pruebas que un borrador con la copia desactualizada devuelve los datos que cambiaron, que uno en
      revisión los devuelve pero no se puede actualizar, que la versión anterior responde IC409 y que una
      revisión creada después de corregir el sitio toma el nombre corregido al actualizarse.

## 4. Dominio, repositorios, servicio y permisos

- [ ] 4.1 Agregar a `src/lib/dominio/esquemas.ts` los esquemas del cambio de bitácora, del resultado de
      una edición (cambios, impacto y efectos) y del estado del contrato de un reporte, y los métodos
      `editarContrato`, `editarSitio`, `quitarSitio`, `resumenSitios`, `corregirFirmante`,
      `cambiarFirmante` y `listarCambios` en `src/lib/server/repositorios/catalogo.ts`, y
      `estadoContrato` y `actualizarContrato` en `src/lib/server/repositorios/reportes.ts`; verificar
      con `npm run check` y con pruebas de repositorio sobre PGlite.
- [ ] 4.2 Crear `src/lib/dominio/bitacora.ts` (etiquetas de campo, `describirCambio`, `resumenImpacto`,
      `validarMotivo` y el mes desde el que aplica un cambio de firmante) y verificar con
      `src/lib/dominio/bitacora.spec.ts` los textos «Número: anterior → nuevo», «2 borradores», «1
      emitido conserva el dato anterior», los límites del motivo con espacios y «desde diciembre de
      2026» para un cambio del 15 de noviembre.
- [ ] 4.3 Declarar `Locals` en `src/app.d.ts` y crear `src/lib/server/permisos.ts` con
      `puedeEditarCatalogo` y `contextoBitacora` (D10); verificar con `src/lib/server/permisos.spec.ts`
      que sin autenticación se permite, que con autenticación solo el rol administrador puede editar y
      que el usuario sale de `locals` aunque el formulario traiga otro.
- [ ] 4.4 Agregar `estadoContrato` y `actualizarContrato` a `CapturaServicio` en
      `src/lib/server/captura.ts` y verificar en `src/lib/server/captura.spec.ts` que tras actualizar un
      borrador el DOCX generado usa el número nuevo y que el de un emitido conserva el anterior.
- [ ] 4.5 Pasar `--ajustar-vigencia` de `scripts/importar-catalogo.ts` (cambio
      `importacion-programa-anual`, D10) de `guardarContrato` con `id` a `editarContrato` con
      `origen: 'script'`, la opción nueva `--motivo` (obligatoria con `--ajustar-vigencia`, de 10 a 500
      caracteres) y el ensayo mientras no se dé `--aplicar`, y actualizar el texto de uso del comando;
      verificar con las pruebas de las funciones puras del CLI y ejecutando el ensayo y la aplicación
      sobre una copia temporal de la base (`STORAGE_DIR` fuera del repositorio) que sin `--motivo` se
      rechaza antes de tocar la base, que el ensayo muestra la vigencia antes → después sin escribir y
      que al aplicar la bitácora registra la edición con origen script y el motivo.

## 5. Pantalla del contrato

- [ ] 5.1 Agregar `confirmarDeshabilitado` a `src/lib/components/ui/Dialogo.svelte` y verificar con un
      caso nuevo en `Dialogo.svelte.spec.ts` que «Confirmar» no dispara el evento mientras está
      deshabilitado, y que las pruebas del diálogo de emisión siguen pasando.
- [ ] 5.2 Crear `src/lib/server/edicion-catalogo.ts` y agregar a
      `src/routes/catalogo/contratos/[id]/+page.server.ts` las acciones `ensayarCambio`,
      `aplicarCambio` (con `validarMotivo` en el servidor) y `registrarFirmante`, el contexto de la
      bitácora en `asociarSitio`, la respuesta 403 sin permiso y en la carga el historial
      (`?cambios=N`), el resumen de sitios y los permisos; verificar con pruebas del módulo sobre PGlite
      (tipos de cambio, motivo ausente rechazado sin escribir, permiso negado sin llamar a la base) y con
      `npm run check`.
- [ ] 5.3 Crear `src/lib/components/catalogo/DatosContrato.svelte` (lectura, «Editar», cliente fijo con
      la nota de renovación, errores junto al campo y «No hay cambios que guardar») e integrarlo en
      `ContratoView.svelte`; verificar con pruebas de componente en Chromium.
- [ ] 5.4 Crear `src/lib/components/catalogo/DialogoCambioCatalogo.svelte` (antes → después, impacto,
      casilla solo con borradores afectados y marcada por omisión, motivo con contador y «Confirmar»
      deshabilitado) y verificar con pruebas que Esc no envía nada y devuelve el foco, que el motivo
      «error» mantiene «Confirmar» deshabilitado y que se envían el motivo y la casilla.
- [ ] 5.5 Agregar en Sitios «Corregir clave o nombre» con el aviso de sitio compartido y «Quitar del
      contrato», deshabilitado con los conteos cuando hay datos; verificar con pruebas de componente
      ambos estados.
- [ ] 5.6 Reemplazar «Editar» de Firmantes por «Corregir datos» y «Cambiar firmante desde…» (fecha
      propuesta: primer día del mes siguiente) y conservar «Registrar firmante» para las altas;
      verificar con pruebas de componente que el diálogo muestra el mes desde el que aplica.
- [ ] 5.7 Crear `src/lib/components/catalogo/HistorialCambios.svelte` (sección plegable, tabla con
      fecha local, qué cambió, antes → después, motivo, usuario «—» y efectos, paginación y «Sin cambios
      registrados»); verificar con pruebas de componente.
- [ ] 5.8 Mostrar la notificación con los efectos al aplicar, el mensaje de conflicto (IC409) con la
      recarga de los datos y ocultar las acciones de edición cuando `permisos.editarCatalogo` es falso;
      verificar con pruebas de componente los tres casos.

## 6. Editor de reportes

- [ ] 6.1 Agregar `contratoCambiado` a la carga y la acción `actualizarContrato` en
      `src/routes/reportes/[id]/+page.server.ts`, y el aviso en `EditorReporte.svelte` (borrador con
      «Actualizar datos del contrato», en revisión solo el texto, emitido sin aviso, enlace al
      contrato); verificar con pruebas de componente los tres estados y que tras actualizar el aviso
      desaparece y el encabezado muestra el dato vigente.
- [ ] 6.2 Verificar con una prueba de integración sobre PGlite el recorrido completo: corregir el número
      con la casilla desmarcada, ver el aviso en el borrador, actualizarlo y comprobar que el emitido y
      su documento conservan el número anterior.

## 7. Base de desarrollo

- [ ] 7.1 Detener el servidor de desarrollo, respaldar `storage/pglite` fuera del repositorio y
      reiniciarlo para aplicar `0018`; verificar que la pantalla de cada contrato carga con «Sin cambios
      registrados» y que los borradores existentes no muestran el aviso de datos del contrato. No
      corregir datos reales: los provisionales de Proagro y Virtual los corrige el usuario desde la
      interfaz cuando tenga los datos.

## 8. Cierre

- [ ] 8.1 Ejecutar `npm run check`, `npm run lint` y `npm run test` sin errores.
- [ ] 8.2 Validar en el navegador a 1366 × 800, en tema claro y oscuro, sobre una copia de
      `storage/pglite` (y restaurar el respaldo al terminar, para no dejar registros de prueba en la
      bitácora): editar el contrato, corregir un sitio, cambiar un firmante, el diálogo con motivo y el
      historial, y el aviso en el editor; comprobar contraste AA, foco visible en el diálogo y sin
      desborde horizontal, con capturas antes y después fuera del repositorio.
- [ ] 8.3 Hacer commit y ejecutar `scripts/revision-codex.ps1` con `-Cambio` («el cambio OpenSpec
      edicion-contratos-bitacora»), `-Base` (último commit de `feat/editor-fotos`), `-Sha` (último commit
      del cambio), `-Fase edicion-contratos`, `-Ronda` y como `-ArchivosContexto` los artefactos de este
      cambio y `0018_bitacora_catalogo.sql` (máximo 2 rondas); verificar que el resumen queda en
      `docs/revisiones/edicion-contratos-bitacora.md` con los hallazgos y su resolución.
- [ ] 8.4 Agregar la entrada en `HISTORIAL.md` (fecha local, motivo, alcance, archivos, validación real
      y pendientes, sin datos personales) y actualizar `docs/CONTEXTO_PROYECTO.md` con la migración 0018,
      la bitácora del catálogo, las acciones nuevas de `/catalogo/contratos/[id]` y el estado del cambio;
      verificar que los enlaces y el formato pasan `npx prettier --check`.

## Workflow follow-up

- Corregir desde la interfaz los datos provisionales de Proagro y Virtual que sigan pendientes cuando
  el usuario tenga los datos reales.
- Con la autenticación: `src/hooks.server.ts`, tabla `perfiles`, `es_administrador` dentro de las
  funciones de edición y tipo IC403 en `ErrorDatos`.
- Archivar el cambio cuando el usuario lo apruebe, después de archivar o junto con
  `reportes-mantenimiento-for-icsi-rmt-01`.
