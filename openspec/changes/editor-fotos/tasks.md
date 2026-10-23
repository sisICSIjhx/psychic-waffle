# Tasks

El cambio se entrega en dos partes revisables en la misma rama: la entrega 1 (grupos 2 a 7, sin
migración) y la entrega 2 (grupos 8 y 9, migración `0017_fotos_rotacion.sql`). El grupo 10 cierra el
cambio completo. Decisiones aplicadas en `design.md` (sección «Decisiones del usuario»).

## 1. Preparación

- [x] 1.1 Crear la rama `feat/editor-fotos` a partir de `feat/indice-docx` (orden 4 de la pila
      `feat/programa-anual` → `feat/fechas-multiples` → `feat/indice-docx`) y comprobar que
      `npm run test` pasa antes de cambiar nada.
- [ ] 1.2 Buscar en `supabase/migrations/` la última definición de `api_guardar_reporte` (la envoltura
      de `0016_dias_ejecucion.sql`), `api_crear_revision` (la de `0003_reportes.sql`, que `0016` no
      envuelve) y `json_foto` (`0003`), y comprobar que conservan `(p jsonb) returns jsonb`, la
      respuesta `{ reporte, fotosEliminadas }` y el `id` en el JSON del reporte, y que no existen todavía
      `api_guardar_reporte_0016` ni `api_crear_revision_0003`; si algo difiere, ajustar D8 de
      `design.md` antes de empezar el grupo 8.

## 2. Reglas puras de fotos (entrega 1)

- [x] 2.1 Crear `src/lib/dominio/fotos.ts` con `reordenarFoto` (D3) y verificar en
      `src/lib/dominio/fotos.spec.ts` que mover la tercera foto antes de la primera la renumera como
      2.2.1, que soltar en otra columna cambia su `momento`, que un destino nulo la deja al final de su
      grupo, que las fotos ocultas conservan su posición relativa y que un destino ajeno no cambia nada.
- [x] 2.2 Agregar `moverPaso` y `moverDeColumna` y verificar con pruebas que en los extremos del grupo
      no hay efecto, que se saltan las ocultas y que la posición se limita al tamaño de la columna de
      destino.
- [x] 2.3 Agregar `girar` y `escalaGirada` y verificar con pruebas que cuatro giros a la derecha vuelven
      a 0, que girar a la izquierda desde 0 da 270, que con 0° y 180° la escala es 1 y que una foto de
      640 × 480 px girada 90° en un marco 4:3 da escala 0,75.

## 3. Miniaturas (entrega 1)

- [x] 3.1 Agregar `rutaMiniatura` y generar `<uuid>-mini.jpg` (480 px, calidad 70) en
      `ServicioCaptura.cargarFotos` (D11); verificar en `src/lib/server/captura.spec.ts` que una foto de
      2000 × 1500 px deja una miniatura de 480 × 360 px y que un fallo al crearla no rechaza la foto.
- [x] 3.2 Agregar `ServicioCaptura.leerMiniatura` (lee o genera y guarda) y `?tamano=mini` en
      `src/routes/reportes/[id]/fotos/[fotoId]/+server.ts` (400 con otro valor); verificar en
      `captura.spec.ts` que una foto sin miniatura la obtiene y la conserva para la siguiente lectura, y
      con `curl -I` contra el servidor de desarrollo que responde `image/jpeg` con la caché `immutable`
      y 400 con `?tamano=grande`.
- [x] 3.3 Hacer que `limpiar` borre también la miniatura y verificar en `captura.spec.ts` que quitar una
      foto elimina original, optimizada y miniatura, y que en una revisión que comparte archivos con el
      emitido no se borra ninguno de los tres.
- [x] 3.4 Medir con un reporte sintético de 130 fotos (D12): detener el servidor de desarrollo, respaldar
      `storage/pglite` fuera del repositorio, crear el reporte con un script fuera del repositorio,
      medir la mediana del GET de miniatura y los bytes transferidos al recorrer el editor, y después
      restaurar el respaldo y borrar `storage/fotos/<id del reporte sintético>/`; anotar las cifras y la
      decisión sobre `api_obtener_foto` (umbral de 30 ms) para el grupo 8 y para `HISTORIAL.md`.

## 4. Tarjeta y barra de acciones (entrega 1)

- [x] 4.1 Crear `src/lib/components/reportes/TarjetaFoto.svelte` y usarla en `FotosAlcance.svelte` (D1 y
      D2): imagen-botón «Ampliar la Ilustración 2.n.m» con `?tamano=mini` y `<img draggable="false">`,
      barra con Ampliar, Reemplazar, Quitar y «Más acciones» (Girar se agrega en 9.1) y lista con
      `minmax(min(220px, 100%), 1fr)`, sin ↑/↓ ni las dos listas; verificar con
      `FotosAlcance.svelte.spec.ts` actualizado los nombres accesibles con el pie, el orden de
      tabulación, la barra visible con el foco y que en solo lectura solo existe Ampliar.
- [x] 4.2 Agregar «Más acciones» con el patrón de divulgación (Mover antes, Mover después, Espacio con
      `aria-pressed` y Mover a otro alcance, que emite `mover`) y verificar con pruebas que «Mover antes»
      renumera, que está deshabilitada en la primera foto del grupo, que Espacio cambia el `momento`,
      que Mover a otro alcance emite el alcance elegido y que Esc cierra y devuelve el foco al botón.

## 5. Arrastre y teclado (entrega 1)

- [x] 5.1 Crear `src/lib/components/reportes/arrastreFotos.ts` e implementar el arrastre nativo con el
      tipo `application/x-icsi-foto`, el indicador de inserción y la exclusión del tipo propio en
      `arrastrar` (D4); verificar con pruebas que despachen `DragEvent` con `DataTransfer` que reordena
      y renumera, que soltar en otra columna cambia el espacio, que soltar en el espacio libre del grupo
      deja la foto al final, que otro alcance (dos `FotosAlcance` en la prueba) no la acepta y que nunca
      se emite `cargar`.
- [x] 5.2 Agregar el asa con el modo de agarre y la región `aria-live` (D5) y verificar con pruebas de
      teclado que Espacio, ← dos veces y Espacio dejan la foto como 2.1.1 y anuncian «Ilustración 2.1.1,
      posición 1 de 6», que Esc restaura la posición, que en antes/durante/después ← y → cambian de
      columna y que el foco sigue en el asa de la foto movida.

## 6. Vista ampliada (entrega 1)

- [x] 6.1 Crear `src/lib/components/reportes/VisorFotos.svelte` (D6: `<dialog>` modal, encabezado,
      contador, ‹ y ›, ← y → salvo en campos, precarga de vecinas y regreso del foco) y verificar con
      pruebas que abrir desde la 2.1.3 muestra «3 de 12», que → muestra «4 de 12», que ← en la
      descripción no cambia de foto, que Esc devuelve el foco a Ampliar de la foto mostrada y que en
      solo lectura no hay acciones.
- [x] 6.2 Agregar en la vista la descripción, Reemplazar, Mover a otro alcance y Quitar con «Deshacer»
      propio, y en `EditorReporte.svelte` el manejo de `deshacer` con `notificaciones.deshacer`;
      verificar en `EditorReporte.svelte.spec.ts` que quitar desde la vista muestra la siguiente y el
      «Deshacer» interno, que deshacer restaura el pie y la posición, y que quitar la única foto cierra la
      vista, enfoca «Agregar fotos» y deja visible la notificación.

## 7. Reemplazar (entrega 1)

- [x] 7.1 Agregar `reemplazarFoto` en `EditorReporte.svelte` y el botón Reemplazar en la tarjeta y en la
      vista (D7), con `alDeshacer` adicional en `quitarConDeshacer`; verificar en
      `EditorReporte.svelte.spec.ts` con `enviar` simulado que se conservan posición, pie, descripción y
      espacio, que «Deshacer» restaura la anterior y saca la nueva, que un archivo rechazado deja la
      anterior intacta, que si la anterior se quitó durante la cola la nueva queda al final con aviso y
      que el siguiente guardado envía el orden esperado.
- [x] 7.2 Ejecutar `npm run check`, `npm run lint` y `npm run test` sin errores y hacer el commit de la
      entrega 1 para poder revisarla por separado.

## 8. Giro: datos (entrega 2)

- [ ] 8.1 Escribir `supabase/migrations/0017_fotos_rotacion.sql` (D8: columna con `check`, `json_foto`,
      envolturas idempotentes de `api_guardar_reporte` y `api_crear_revision`, error IC422 y bloque de
      permisos; más `api_obtener_foto` solo si 3.4 superó el umbral) y verificar en `captura.spec.ts`
      sobre PGlite en memoria que se guarda y se devuelve un giro de 90°, que un guardado sin `rotacion`
      lo conserva, que 45 se rechaza sin cambiar la versión ni los datos, que aplicar el catálogo lo
      conserva, que la revisión lo copia (con sus días de ejecución) y que una foto recién cargada trae
      0; y en `src/lib/server/bd/cliente.spec.ts`, que `validarFuncion` rechaza
      `api_guardar_reporte_0016` y `api_crear_revision_0003`.
- [ ] 8.2 Agregar `ROTACIONES_FOTO` y `rotacion` a `esquemaFoto` (0 por omisión) y a las fotos de
      `esquemaReporteGuardado` (opcional) en `src/lib/dominio/esquemas.ts`, incluirla siempre en
      `aGuardado` y actualizar los datos de ejemplo de las pruebas; verificar con `npm run check` sin
      errores y en `src/lib/dominio/captura.spec.ts` que `aGuardado` envía la `rotacion` de cada foto,
      también cuando es 0.
- [ ] 8.3 Aplicar 0017 en la base de desarrollo: detener el servidor de desarrollo, respaldar
      `storage/pglite` fuera del repositorio y reiniciarlo; verificar que arranca sin errores, que
      `interno.migraciones` registra `0017_fotos_rotacion.sql` y que un borrador existente se abre y se
      autoguarda con sus fotos en 0°.

## 9. Giro: editor y documento (entrega 2)

- [ ] 9.1 Agregar Girar a la derecha en la barra de `TarjetaFoto` y girar a la izquierda y a la derecha
      en `VisorFotos`, con `escalaGirada` y el aviso en `aria-live` (D9); verificar con pruebas que dos
      clics dejan `rotacion` en 180 y el `<img>` con `rotate(180deg)`, que una foto de 640 × 480 px a 90°
      usa escala 0,75, que el autoguardado (`enviar` simulado) envía la `rotacion` y que en solo lectura
      la foto se ve girada sin el botón.
- [ ] 9.2 Agregar `rotacion` a `FotoDocumento`, `giro` a `prepararImagen`, el atajo del perfil 0 solo sin
      giro en `prepararSegunPerfil` y el paso de `rotacion` en `documentoDe` (D10); verificar en
      `src/lib/server/documentos/generar.spec.ts` con `extensionesCm` que una foto de 640 × 480 px a 90°
      mide 4,5 × 6 cm, que a 180° mide 8 × 6 cm, que sin giro los bytes son los de la optimizada y que un
      perfil más ligero conserva las medidas intercambiadas; en `captura.spec.ts`, que girar en la
      revisión no cambia la imagen del DOCX del emitido ni sus archivos; y en `paginacion.spec.ts`, que
      `entradaPaginacion` recibe la altura de la foto girada (6 cm en lugar de 4,5 cm) y que
      `calcularIndice` la usa.
- [ ] 9.3 Agregar `rotacion` a las fotos de ejemplo de `scripts/prueba-documental.ts` con un caso de fotos
      giradas 90°, 180° y 270°; ejecutar `npm run prueba:documental` y verificar en Microsoft Word que el
      DOCX abre sin reparación, sin aviso de actualizar el índice y con las fotos giradas completas en su
      caja.
- [ ] 9.4 Agregar el giro a `reporteSintetico` de `src/lib/server/documentos/sinteticos.ts` (fotos
      giradas 90° y 270° en algunas semillas, sin cambiar el orden de sorteos de las semillas ya medidas
      salvo que se vuelvan a medir todas) y a la generación de `scripts/verificar-indice-word.ts`. Ejecutar
      `npm run verificar:indice` (Windows con Word, D9 de `indice-docx-actualizado`) y volver a guardar
      `src/lib/server/documentos/calibracion/paginas-word.v2.json` si cambiaron las semillas o los 3
      documentos de prueba. Verificar los criterios de D10 de ese cambio (al menos 99 % de entradas
      exactas, los 3 documentos de prueba exactos y ninguna diferencia mayor de una página) y que
      `paginacion.spec.ts` pasa con el archivo nuevo; no se cierra el cambio sin cumplirlos.

## 10. Cierre

- [ ] 10.1 Ejecutar `npm run check`, `npm run lint` y `npm run test` sin errores.
- [ ] 10.2 Validar en el navegador a 1366 × 800 en tema claro y oscuro: contraste AA de la barra y del
      foco sobre una foto muy clara y una muy oscura, sin desborde horizontal (también con «Más
      acciones» abierto en la última columna), y el recorrido solo con teclado (barra, menú, agarre y
      vista ampliada), con capturas fuera del repositorio.
- [ ] 10.3 Hacer commit y ejecutar `scripts/revision-codex.ps1` con `-Base` (último commit de
      `feat/indice-docx`), `-Sha` (último commit del cambio), `-Fase editor-fotos`, `-Ronda`,
      `-Cambio 'el cambio OpenSpec editor-fotos'` y `-ArchivosContexto` con `proposal.md`, `design.md`,
      `tasks.md` y las specs de este cambio, como máximo 2 rondas; corregir los hallazgos y registrar el
      resumen en `docs/revisiones/editor-fotos.md`.
- [ ] 10.4 Agregar la entrada en `HISTORIAL.md` (fecha local, motivo, alcance, archivos, validación real
      con las cifras de 3.4 y la precisión del índice medida en 9.4, y pendientes) y verificar su formato
      con `npx prettier --check HISTORIAL.md`.
- [ ] 10.5 Actualizar `docs/CONTEXTO_PROYECTO.md` (migraciones hasta 0017, `?tamano=mini` en
      `/reportes/[id]/fotos/[fotoId]` y estado del cambio) y verificar su formato con
      `npx prettier --check docs/CONTEXTO_PROYECTO.md`.

## Workflow follow-up

- Archivar el cambio cuando el usuario lo apruebe, después de `reportes-mantenimiento-for-icsi-rmt-01` y
  `ux-editor-inicio-captura`, y antes o junto con los cambios posteriores de la pila.
- Aplicar `0017_fotos_rotacion.sql` en Supabase junto con las demás migraciones (tarea 3.8).
- Medir con el usuario el tiempo real de un reporte con la nueva interfaz de fotos (meta de 30 minutos).
