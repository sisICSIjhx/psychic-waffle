# Tasks

Cada fase (B: editor; C: inicio y captura) se trabaja en su rama y cierra con estos pasos:

1. `npm run check`, `npm run lint` y `npm run test` sin errores.
2. Revisión en el navegador a 1366 × 800 y 375 × 812, en tema claro y oscuro: contraste, objetivos de
   24 px (44 px táctil), foco visible y sin desborde horizontal, con capturas antes y después fuera del
   repositorio.
3. Commit y `scripts/revision-codex.ps1` con `-Cambio`, `-Base` y como contexto
   `docs/PLAN_DISENO_UX.md` y los artefactos de este cambio (como máximo 2 rondas).
4. Resumen en `docs/revisiones/ux-fase-B.md` o `ux-fase-C.md` y entrada en `HISTORIAL.md`.

Decisiones del usuario aplicadas (`design.md`): uso solo en escritorio y la misma persona envía a
revisión y emite; por eso no hay tareas de cámara ni de vistas o acciones por rol.

## 1. Base compartida (fase B)

- [x] 1.1 Crear la rama `feat/ux-fase-b` a partir de la rama con la fase A y comprobar que
      `npm run test` pasa antes de cambiar nada.
- [x] 1.2 Crear `src/lib/components/ui/Dialogo.svelte` sobre `<dialog>` (foco inicial en la opción
      segura, `Esc` cancela y el foco vuelve al botón que lo abrió) y verificarlo con una prueba de
      componente.
- [x] 1.3 Crear `src/lib/components/ui/notificaciones.ts` y `Notificaciones.svelte` (región
      `role="status"` en `+layout.svelte`, acción «Deshacer» y plazo) y verificar con pruebas que
      «Deshacer» funciona dentro del plazo y que al vencer se ejecuta la acción final.
- [x] 1.4 Crear `src/lib/components/ui/BotonesSegmentados.svelte` (`radiogroup`, una pulsación,
      flechas y tabulación itinerante) y verificarlo con una prueba de teclado.
- [x] 1.5 Agregar `destinoDeObservacion(observacion, reporte)` y `completitudPorSeccion` a
      `src/lib/dominio/captura.ts` y verificar con pruebas que cada observación de
      `validarParaRevision` tiene sección y campo de destino, y que el destino de un alcance es su
      `id` también después de reordenar o quitar alcances.

## 2. Editor: estructura y navegación (fase B)

- [x] 2.1 Reorganizar la barra del editor (contexto, insignia, guardado con hora relativa y
      «Reintentar», «Faltan N», «Descargar» y la acción principal) y verificar con pruebas el texto del
      guardado, el reintento tras un fallo y, en el navegador, 64 px o menos en escritorio y dos líneas
      en móvil.
- [x] 2.2 Dar `id` estable a secciones y alcances, crear `IndiceSecciones.svelte` (columna fija desde
      1100 px y desplegable en angosto) y verificar que marca completitud y lleva el foco al destino.
- [x] 2.3 Mostrar el resumen de pendientes al elegir «Enviar a revisión» con datos faltantes y
      verificar que el estado sigue en Borrador, que el foco va al resumen y que cada enlace enfoca su
      campo.
- [x] 2.4 Mostrar el error junto al campo al salir de él (con `aria-describedby`; la fecha indica el
      rango permitido) y verificarlo con una prueba de la fecha fuera del periodo.
- [x] 2.5 Crear `SeccionResumen.svelte` y usarlo en encabezado fijo, firmas y objetivo; verificar que
      «Editar» muestra los campos, que se autoguarda y que una sección con pendientes se abre sola.
- [x] 2.6 Agregar «Hoy» a la fecha de ejecución y verificar con fecha fija que aparece dentro del
      periodo y que fuera de él se muestra el rango.

## 3. Editor: verificación, fotos y acciones (fase B)

- [x] 3.1 Usar `BotonesSegmentados` en la verificación y mostrar observaciones con «Con observación» o
      con texto previo; verificarlo con pruebas de ambos casos.
- [x] 3.2 Quitar alcances y fotos con «Deshacer» (baja aplazada, D4) y verificar con pruebas que
      deshacer restaura después de un autoguardado, que al vencer el plazo se quita y que descargar,
      enviar, emitir o navegar aplican antes las bajas pendientes.
- [x] 3.3 Hacer de cada grupo de fotos una zona para soltar archivos, conservando el botón, y verificar
      con una prueba de `drop` que se cargan las fotos y se informa el archivo rechazado.
- [x] 3.4 Mostrar el avance por archivo («Cargando 3 de 12») y verificarlo con una prueba de carga con
      un rechazo intermedio.
- [x] 3.5 Emitir con `Dialogo` (título, revisión y fotos; foco en «Cancelar») y verificar que `Esc` no
      emite y devuelve el foco a «Emitir».
- [x] 3.6 Mostrar «Descargar DOCX» siempre, deshabilitado con el motivo cuando falta la fecha, y
      verificarlo con una prueba de componente.

## 4. Cierre de la fase B

- [x] 4.1 Ejecutar los pasos de cierre (comprobaciones, navegador, Codex, `docs/revisiones/ux-fase-B.md`
      e `HISTORIAL.md`) y verificar que no queda ningún hallazgo A del plan abierto en el editor.

## 5. Datos para la fase C

- [ ] 5.1 Crear la rama `feat/ux-fase-c`, agregar `supabase/migrations/0013_resumen_reportes_partida.sql`
      (`partidaId` y `sitioId` en `api_listar_reportes`) y el campo en `esquemaReporteResumen`;
      verificar con una prueba sobre PGlite que las filas los traen y pedir al usuario reiniciar el
      servidor de desarrollo para aplicarla.
- [ ] 5.2 Agregar `listarTodos(filtro)` al repositorio de reportes (recorre las páginas de 100 hasta el
      total) y verificar con una prueba sobre PGlite con más de 100 borradores que no omite ninguno.
- [ ] 5.3 Agregar `siguienteTrabajo` a `src/lib/dominio/planeacion.ts` y verificar con pruebas el orden
      por urgencia, lo que falta por mes y los borradores por partida, mes y ocurrencia.
- [ ] 5.4 Agregar al dominio la búsqueda normalizada, la agrupación de partidas (vencidos anteriores con
      su mes y estado del mes de referencia) y el mes sugerido, y verificar con pruebas acentos,
      mayúsculas, coincidencia exacta por número, los tres grupos (una partida pendiente con borrador
      solo en «Con borrador», con su estado) y la sugerencia del vencido más antiguo.

## 6. Inicio «Mi trabajo» (fase C)

- [ ] 6.1 Ampliar la carga de `src/routes/+page.server.ts` (todos los borradores del rango de meses con
      `listarTodos`, siguiente trabajo y `?ver=`) y verificarla con una prueba del componente con datos
      de ejemplo.
- [ ] 6.2 Mostrar el avance del mes con barra de progreso y el estado sin programas vigentes, y
      verificar ambos escenarios con pruebas.
- [ ] 6.3 Mostrar las tarjetas accionables con sus destinos y el color de peligro solo con vencidos, y
      verificarlo con pruebas.
- [ ] 6.4 Mostrar la lista del siguiente trabajo con «Capturar» o «Continuar borrador», «Ver todos» y el
      estado «al día», y verificar con pruebas y en el navegador que de un pendiente al editor hay 3
      clics o menos.
- [ ] 6.5 Renombrar la vista de inicio a «Mi trabajo» en `navegacion.ts` y en el menú, y actualizar las
      pruebas de navegación y de la barra lateral.

## 7. Captura (fase C)

- [ ] 7.1 Crear `src/lib/components/ui/SelectorBusqueda.svelte` (combobox con grupos y estado sin
      resultados) y verificarlo con pruebas de teclado y de lector de pantalla (roles y
      `aria-activedescendant`).
- [ ] 7.2 Ampliar la carga de `src/routes/captura/+page.server.ts` con los vencidos y el estado del mes
      de referencia de cada partida, el mes sugerido, todos los borradores del sitio en el rango de
      meses y los reportes de la partida y mes elegidos, y verificarlo con una prueba sobre PGlite.
- [ ] 7.3 Usar el selector en `CapturaView.svelte`, mostrar el contexto resuelto como resumen con
      «Cambiar» y los pasos numerados, conservando `?partida=` y `?mes=`; verificarlo con pruebas y con el
      enlace desde la planeación.
- [ ] 7.4 Mostrar el aviso de reporte existente (por ocurrencia, con TAG y enlace) sin impedir crear, y
      verificar los escenarios de borrador existente y de otro TAG.

## 8. Cierre de la fase C

- [ ] 8.1 Ejecutar los pasos de cierre de la fase C (incluye `docs/revisiones/ux-fase-C.md`) y
      actualizar `docs/CONTEXTO_PROYECTO.md` con la vista «Mi trabajo» y el estado del cambio.

## Workflow follow-up

- Pruebas con 3 a 5 personas que capturen reportes y medición del tiempo por etapa (plan, sección 7).
- Archivar el cambio cuando el usuario lo apruebe, después de archivar o junto con
  `reportes-mantenimiento-for-icsi-rmt-01`.
