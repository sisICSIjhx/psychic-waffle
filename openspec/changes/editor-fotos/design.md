# Design

## Context

Motivación y alcance en `proposal.md`; requisitos en `specs/captura-reportes/spec.md` y
`specs/generacion-documental/spec.md`. Estado de partida comprobado en `feat/ux-fase-c`:

- `src/lib/components/reportes/FotosAlcance.svelte` (sintaxis heredada) recibe `bind:fotos`, numera con
  `ordenDeAparicion` y `pieIlustracion` (`src/lib/dominio/documento.ts`), oculta las bajas pendientes
  (`ocultas`) y emite `cargar`, `mover` y `quitar`. Cada grupo (todas, o ANTES/DURANTE/DESPUÉS) es zona
  para soltar archivos y solo reacciona a `dataTransfer.types` con `Files`.
- `EditorReporte.svelte` encola las operaciones con el servidor (`encolar`), carga una foto por petición
  (`cargarFotos`, acción `fotos` de `src/routes/reportes/[id]/+page.server.ts`), aplaza las bajas con
  «Deshacer» (`quitarConDeshacer`, `aplicarBaja`, `aplicarBajasPendientes`) y autoguarda por huella
  (`huella` sobre `paraGuardar`, que usa `aGuardado` de `src/lib/dominio/captura.ts`).
- `Notificaciones.svelte` es un `div` fijo (z-index 60) montado en `src/routes/+layout.svelte`, fuera de
  la capa superior: bajo un `<dialog>` abierto con `showModal()` queda inerte.
- `src/lib/server/captura.ts`: `cargarFotos` guarda `fotos/<reporte>/<uuid>-original.<ext>` y
  `fotos/<reporte>/<uuid>.jpg` (1600 px, sin EXIF); `leerFoto` busca la foto en el reporte completo;
  `limpiar` borra original y optimizada; `documentoDe` pasa al generador los bytes y las medidas de la
  optimizada.
- `src/routes/reportes/[id]/fotos/[fotoId]/+server.ts` llama a `servicio.obtener` (JSON completo del
  reporte) en cada imagen y responde con caché `immutable`.
- `supabase/migrations/0003_reportes.sql`: `reporte_fotos` sin giro; `json_foto`, `api_agregar_foto`,
  `api_guardar_reporte` (reasigna alcance y orden por la posición en el arreglo y devuelve
  `{ reporte, fotosEliminadas }` solo con rutas sin uso) y `api_crear_revision` (copia alcances y fotos
  con el mismo orden y las mismas rutas). `api_aplicar_catalogo` (0007) llama a `api_guardar_reporte`
  por nombre. Las migraciones se aplican una vez y se registran en `interno.migraciones`
  (`src/lib/server/bd/migraciones.ts`).
- `src/lib/server/documentos/generar.ts`: `prepararSegunPerfil` reutiliza los bytes de la optimizada
  en el perfil 0; `prepararAlcances` ajusta cada foto a `CAJA_FOTO` (8 × 6 cm) con `ajustarACaja`.
  `src/lib/server/documentos/imagenes.ts`: `prepararImagen` con sharp 0.35.5 (`.rotate()` EXIF, lado
  mayor, `flatten`, JPEG mozjpeg).
- Tokens de `src/app.css`: `--objetivo-min` (32 px; 44 px con `pointer: coarse`), `--surface`,
  `--border`, `--shadow`, `--text`, `--primary`, `--danger`. Iconos como SVG en línea; sin
  dependencias de arrastre.

Cambios previos de la pila que se asumen (`decisiones.md`, orden 1 a 3): `0016_dias_ejecucion.sql`
envolvió `api_guardar_reporte` (su base quedó como `api_guardar_reporte_0003`) conservando la firma
`(p jsonb) returns jsonb` y la respuesta `{ reporte, fotosEliminadas }`, y fijó la convención de
envolturas reenvolvibles (D3 de `fechas-ejecucion-multiples`: renombrar la definición vigente a
`<función>_<NNNN>`). `0016` no toca `api_crear_revision`: copia los días con un trigger, así que sigue
siendo la definición de `0003`. `esquemaReporteGuardado` y `documentoDe` traen los días de ejecución;
el índice del DOCX (`indice-docx-actualizado`, plantilla v2) calcula páginas con las medidas de las
celdas que deja `prepararAlcances` (`entradaPaginacion`, D2 de ese cambio).

## Goals / Non-Goals

**Goals:**

- Que revisar, ordenar y corregir fotos ocurra sobre la propia foto, con todo lo que se arrastra
  disponible también con un clic y con el teclado (WCAG 2.5.7 y 2.1.1, `docs/PLAN_DISENO_UX.md`).
- Reglas de orden y giro puras y probadas en `src/lib/dominio/`; la interfaz solo las invoca.
- No reescribir nunca un archivo de foto: las revisiones comparten archivos con el emitido y la caché
  de las imágenes es `immutable`.
- Entregar en dos partes revisables: primero la interfaz y las miniaturas (sin migración) y después el
  giro (migración 0017).

**Non-Goals:**

- Arrastrar entre alcances, arrastre táctil y captura con la cámara (uso solo en escritorio).
- Editar la imagen (recorte, brillo) o girar en ángulos que no sean múltiplos de 90°.
- Cambiar los formatos, los límites ni la validación de la carga, ni el plazo de «Deshacer».
- Mover las notificaciones globales a la capa superior.

## Decisions

### D1. Componentes nuevos dentro de `FotosAlcance`

`TarjetaFoto.svelte` (imagen-botón, barra, menú «Más acciones» y asa), `VisorFotos.svelte` (vista
ampliada) y `arrastreFotos.ts` (estado del arrastre interno compartido por las instancias de
`FotosAlcance` de la página), todos en `src/lib/components/reportes/` y con sintaxis heredada.
`FotosAlcance` sigue siendo dueño de `fotos` (`bind:fotos`) y de los eventos hacia el editor; se agregan
`reemplazar { fotoId, archivo }` y `deshacer { fotoId }`, y las props `tituloAlcance` y `reemplazando`.
Alternativa descartada: svelte-dnd-action o SortableJS: dependencia nueva, compatibilidad por comprobar
con la sintaxis heredada y `bind:fotos`, y choque con las zonas de carga de archivos.

### D2. Barra sobre la foto y menú «Más acciones»

La barra va arriba a la derecha del marco 4:3, con Ampliar, Girar a la derecha, Reemplazar, Quitar y
«Más acciones», botones de `var(--objetivo-min)` con SVG en línea, fondo opaco `var(--surface)`, borde
`var(--border)`, sombra `var(--shadow)` e iconos en `var(--text)` (Quitar en `var(--danger)`), de modo
que el contraste no dependa de la foto. Se oculta con `opacity: 0` (nunca `display: none` ni
`visibility: hidden`, que la sacarían del orden de tabulación) y se muestra con `.foto:hover`,
`.foto:focus-within` y siempre con `@media (hover: none)`. Cada botón lleva `aria-label` con el pie
(«Quitar la Ilustración 2.1.3») y `title`. La lista pasa a `minmax(min(220px, 100%), 1fr)` («miniaturas
más grandes» del plan) para que quepan los cinco botones (5 × 32 px + separaciones).
«Más acciones» sigue el patrón de divulgación (botón con `aria-expanded` y `aria-controls` y una lista de
botones), no el de menú ARIA: Mover antes, Mover después, Espacio (tres botones con `aria-pressed`, solo
en antes/durante/después) y Mover a otro alcance (segundo nivel con «2.n Título»). Las opciones sin
efecto quedan deshabilitadas; `Esc` y el clic fuera cierran y devuelven el foco a «Más acciones». En
solo lectura no hay barra, asa ni arrastre: la imagen-botón solo amplía.

### D3. Reglas puras en `src/lib/dominio/fotos.ts`

- `reordenarFoto(fotos, { fotoId, destinoId, lado, momento }, ocultas)`: devuelve un arreglo nuevo con la
  foto antes o después de `destinoId`, o al final de su grupo si `destinoId` es `null`; con `momento`
  cambia el espacio. Las ocultas conservan su posición relativa y las fotos sin momento cuentan como
  DURANTE (como `agruparAntesDuranteDespues`). Un `destinoId` ajeno al arreglo no cambia nada.
- `moverPaso(fotos, fotoId, paso, disposicion, ocultas)`: sustituye a `mover` de `FotosAlcance`
  (intercambio con la vecina visible del grupo) y la usan el menú y el teclado.
- `moverDeColumna(fotos, fotoId, sentido, ocultas)`: pasa la foto a la columna vecina en la misma
  posición, limitada al tamaño del destino.
- `girar(rotacion, sentido)` y `escalaGirada(medidas, rotacion, marco)`: el siguiente múltiplo de 90° y
  la escala con la que una foto girada 90° o 270° cabe completa en su marco (1 con 0° y 180°).

Pruebas en `src/lib/dominio/fotos.spec.ts` (proyecto server).

### D4. Arrastre nativo con tipo propio

El origen es la imagen-botón y el asa (`draggable="true"`); nunca el `li`, porque un ancestro
arrastrable impide seleccionar texto en la descripción, y el `<img>` lleva `draggable="false"`. En
`dragstart` se escribe `application/x-icsi-foto` con el id, `effectAllowed = 'move'` y en
`arrastreFotos` el `{ fotoId, alcanceId }`. En `dragover` sobre una tarjeta o un grupo del mismo alcance
se llama a `preventDefault` y se calcula el lado por la mitad horizontal de la tarjeta (vertical si la
lista muestra una sola columna); el indicador es una barra de 3 px en `var(--primary)` de ese lado. Sobre
otro alcance no se llama a `preventDefault` y el navegador muestra que no se acepta. Soltar sobre el
espacio libre de un grupo deja la foto al final de ese grupo; `drop` aplica `reordenarFoto` con el
`momento` del grupo de destino y anuncia el resultado como el teclado (D5). `arrastrar` (carga) sale si
`types` incluye el tipo propio; `evitarAbrirArchivo` del editor no cambia porque solo mira `Files`.

### D5. Modo de agarre con el teclado

El asa es un botón «Reordenar la Ilustración 2.1.3» con `aria-describedby` hacia las instrucciones.
Espacio o Enter la toman y guardan una copia del arreglo; en la cuadrícula ← y ↑ mueven antes y → y ↓
después (`moverPaso`); en antes/durante/después ↑ y ↓ mueven dentro de la columna y ← y → cambian de
columna (`moverDeColumna`). Cada paso reasigna `fotos`, devuelve el foco al asa de la foto movida tras
`tick()` y evita el desplazamiento de la página. Espacio o Enter sueltan; Esc restaura la copia; perder el
foco suelta. Una región `aria-live="polite"` de `FotosAlcance` anuncia «Ilustración 2.1.3 tomada,
posición 3 de 6», «Ilustración 2.1.1, posición 1 de 6» o «Se canceló…». No se usa Alt+←/→ (Atrás y
Adelante del navegador en Windows).

### D6. Vista ampliada por alcance con «Deshacer» propio

`VisorFotos` usa `<dialog>` con `showModal()`, como `Dialogo.svelte` (foco atrapado, `Esc` por el evento
`cancel`, fondo inerte), y se monta solo al abrirse. Recorre `ordenDeAparicion(visibles, disposicion)`
sin dar la vuelta; el encabezado muestra «2.1 Título · Ilustración 2.1.3 · 3 de 12». La imagen es la
optimizada (`/reportes/[id]/fotos/[fotoId]`) con `object-fit: contain` y el giro de D9; ‹ y › y ← y →
cambian de foto salvo con el foco en `input`, `textarea` o `select`; las vecinas se precargan con
`new Image()`. Al cerrar, `FotosAlcance` enfoca tras `tick()` Ampliar de la foto mostrada.
En un borrador ofrece girar a la izquierda y a la derecha, la descripción (misma función que la
tarjeta), Reemplazar, Mover a otro alcance y Quitar. Quitar emite `quitar` como la tarjeta, pasa a la
siguiente visible (o a la anterior si era la última) y muestra dentro de la vista un `role="status"`
con «Deshacer» mientras la foto siga en `ocultas`; ese botón emite `deshacer` y el editor llama a
`notificaciones.deshacer(bajas[fotoId])`. Mover a otro alcance también pasa a la siguiente. Sin fotos
restantes, la vista se cierra y el foco va a «Agregar fotos» del grupo.
Alternativa descartada: recorrer todo el reporte: mezcla alcances justo cuando se decide si la foto va
en ese alcance (decisión por omisión).

### D7. Reemplazar compuesto en el cliente

Reemplazar abre un `<input type="file">` sin `multiple` con el mismo `ACEPTA`. `EditorReporte` agrega
`reemplazarFoto(alcanceId, fotoId, archivo)`: marca `reemplazando[fotoId]` (la tarjeta muestra
«Reemplazando…» con la imagen anterior), y dentro de `encolar` guarda, envía la acción `fotos` existente
con el alcance y el momento de la anterior y, al llegar la foto nueva:

- si la anterior sigue en el reporte y no está en `bajas`, inserta la nueva en su índice y alcance
  actuales con su `descripcion` y `momento`, y llama a `quitarConDeshacer` con «Se reemplazó la
  Ilustración 2.n.m.» y un `alDeshacer` adicional que saca la nueva del arreglo (el siguiente
  autoguardado la elimina y `api_guardar_reporte` devuelve sus rutas para limpiarlas);
- si ya no está, deja la nueva al final del alcance y avisa que la anterior ya no estaba;
- si se rechaza el archivo, lo informa en `rechazadas` con su causa y no toca la anterior; un conflicto
  de versión sigue el camino de `manejarFallo`, como en `cargarFotos`.

La nueva empieza sin giro y tiene id nuevo, lo que evita la caché `immutable`; el original anterior se
conserva hasta que vence el plazo. Alternativa descartada: `api_reemplazar_foto` atómica: exige
migración y pierde «Deshacer» porque borra el original.

### D8. Giro como metadato: migración `0017_fotos_rotacion.sql`

1. `reporte_fotos.rotacion smallint not null default 0` con
   `constraint reporte_fotos_rotacion_valida check (rotacion in (0, 90, 180, 270))`.
2. `json_foto` redefinida (cuerpo de 0003 más `'rotacion'`): el reporte y la respuesta de
   `api_agregar_foto` la traen sin otros cambios.
3. Envoltura de `api_guardar_reporte`: la definición vigente (la envoltura de 0016) se renombra a
   `api_guardar_reporte_0016`, según la convención de D3 de `fechas-ejecucion-multiples` (un nombre con
   dígitos no pasa `validarFuncion`, así que la aplicación solo llama la envoltura exterior), con el
   bloque idempotente de `0007_captura.sql` (consulta a `pg_proc` antes del `rename`). La nueva valida
   que cada `rotacion` presente en `p -> 'alcances' -> fotos` sea 0, 90, 180 o 270
   (`error_api('IC422', …, motivo 'rotacion')` antes de guardar nada), llama a la base, actualiza
   `rotacion = coalesce((foto ->> 'rotacion')::smallint, f.rotacion)` solo en las fotos del envío que
   pertenecen al reporte y devuelve el resultado con `reporte` recalculado
   (`jsonb_set(…, '{reporte}', json_reporte(id))`). No vuelve a subir la versión. `api_aplicar_catalogo`
   pasa por ella al llamar por nombre.
4. Primera envoltura de `api_crear_revision` (la definición de 0003 se renombra a
   `api_crear_revision_0003`, con el mismo bloque idempotente): tras crear la revisión copia `rotacion`
   de las fotos del original emparejando por orden de alcance, orden de foto y `ruta_optimizada`, que la
   base copia idénticos, y devuelve `json_reporte` de la revisión. Los días de ejecución ya los copió el
   trigger de `0016`.
5. Bloque de permisos al final (`service_role`, como en 0007).

En `src/lib/dominio/esquemas.ts`: `ROTACIONES_FOTO = [0, 90, 180, 270] as const`,
`esquemaFoto.rotacion` con valor 0 por omisión y `rotacion` opcional en las fotos de
`esquemaReporteGuardado`. `aGuardado` envía siempre `rotacion`: omitirla significa «conservar», así que
un giro de vuelta a 0 no se guardaría. Como la huella del editor usa `paraGuardar`, girar dispara el
autoguardado. El repositorio y `+page.server.ts` no cambian.
Alternativas descartadas: reescribir la optimizada girada en una ruta nueva (migración igualmente, un
viaje y una recompresión por clic, el original queda sin girar) y girar en un `canvas` y subirla como
reemplazo (pierde el original de la cámara y recomprime en cada giro).

### D9. Giro en pantalla con CSS

El `<img>` de la tarjeta y de la vista se gira con `transform: rotate(<r>deg) scale(<s>)` dentro de un
marco con `overflow: hidden`; `s = escalaGirada({ ancho, alto }, r, marco)` con el marco 4:3 en la
tarjeta y las medidas de la caja (`bind:clientWidth`/`clientHeight`) en la vista. Transición de 150 ms,
sin ella con `prefers-reduced-motion: reduce`. La miniatura y la optimizada no se giran en el archivo.
Girar anuncia «Ilustración 2.1.3 girada a 90°» en la región `aria-live` de `FotosAlcance`.

### D10. Giro en el DOCX con sharp

`FotoDocumento.rotacion?: 0 | 90 | 180 | 270`; `documentoDe` la pasa. `prepararImagen` acepta `giro`:
con un valor distinto de 0 usa `.autoOrient().rotate(giro)` (sharp admite una sola rotación por
canalización además de la EXIF; medido 1600 × 1200 → 1200 × 1600); con 0 la canalización no cambia.
`prepararSegunPerfil` solo reutiliza los bytes en el perfil 0 si no hay giro, y pasa `giro` en todos los
perfiles; así `ajustarACaja` recibe las medidas intercambiadas. `VERSION_PLANTILLA` no cambia: girar sube
la versión del reporte y `generarDocumento` ya no reutiliza el DOCX de otra versión. Descartado el
`rotation` de docx-templates 4.15.0: solo agrega `a:xfrm rot` y deja `wp:extent` sin intercambiar.

### D11. Miniaturas de 480 px con ruta derivada

`rutaMiniatura(rutaOptimizada)` en `src/lib/server/captura.ts` convierte `fotos/<reporte>/<uuid>.jpg` en
`fotos/<reporte>/<uuid>-mini.jpg`. `cargarFotos` la genera de los bytes optimizados con
`prepararImagen(optimizada, { ladoMayor: 480, calidad: 70 })` (medido: 19-28 ms y 16-29 KB frente a
≈180 KB); si falla, la foto se registra igual. `ServicioCaptura.leerMiniatura(reporte, fotoId)` la lee o,
si falta, la genera desde la optimizada, la guarda (`almacenamiento.guardar` es atómico) y la devuelve.
La ruta acepta `?tamano=mini`; sin parámetro sirve la optimizada y con otro valor responde 400; misma
caché `immutable` (la URL es distinta). `limpiar` borra también la miniatura, así que las revisiones la
comparten como la optimizada. La tarjeta pide la miniatura y la vista la optimizada.
Alternativa descartada: columna `ruta_miniatura`: migración y contrato para un dato derivable. La
convención de ruta deberá conservarse cuando el almacenamiento pase a SharePoint.

### D12. Consulta de la foto en cada imagen, según medición

Antes de escribir 0017 se mide con un reporte sintético de 130 fotos el GET de la miniatura. Si la
mediana supera 30 ms, 0017 agrega `api_obtener_foto({ reporteId, fotoId })` (devuelve `json_foto` de una
foto del reporte o IC404) y la ruta, `leerFoto` y `leerMiniatura` la usan en lugar de `servicio.obtener`.
Si no la supera, la ruta queda como está y las cifras se anotan en `HISTORIAL.md`.

## Risks / Trade-offs

- [El visor modal deja inerte e invisible el aviso global «Deshacer»] → «Deshacer» propio dentro de la
  vista (D6); al cerrarla, la notificación global sigue con su plazo.
- [Reescribir un archivo en su ruta alteraría la foto del emitido y la caché seguiría mostrando la
  anterior] → el giro es un dato y el reemplazo crea una foto con id nuevo; ningún archivo se reescribe.
- [0016 cambió la firma o la forma de respuesta de las funciones que se envuelven] → la tarea 1.2 lo
  comprueba antes de escribir 0017; las envolturas solo dependen de `(p jsonb) returns jsonb`, de
  `{ reporte, fotosEliminadas }` y del `id` del JSON del reporte.
- [Un guardado sin `rotacion` (envío `keepalive` de una pestaña anterior al cambio) reiniciaría los
  giros] → `coalesce` con `f.rotacion` y prueba específica.
- [Un ancestro arrastrable impide seleccionar texto; un `<img>` arrastrado puede llevar `Files`] → solo la
  imagen-botón y el asa son arrastrables, `<img draggable="false">` y el tipo propio se revisa primero.
- [La anterior se quita o se mueve mientras el reemplazo espera en la cola] → regla de D7 con prueba.
- [Rendimiento con 130 fotos sin datos reales (hoy 4 fotos en 3 reportes)] → medición de D12.
- [Cada foto girada añade 110-130 ms al generar el DOCX (medido)] → `enParalelo` existente y caché por
  versión del reporte.
- [El cuerpo `keepalive` supera 64 KB] → `rotacion` agrega ≈14 bytes por foto (≈1,8 KB con 130); el
  riesgo y su mitigación son los de D4 de `ux-editor-inicio-captura`.
- [El modelo de páginas de `indice-docx-actualizado` usa las medidas de la foto sin girar o los
  resultados de Word guardados dejan de corresponder a los documentos de prueba] → el giro se aplica
  antes de `ajustarACaja`, así que `entradaPaginacion` recibe las medidas intercambiadas; la tarea 9.4
  agrega el giro a `src/lib/server/documentos/sinteticos.ts`, vuelve a correr `npm run verificar:indice`
  y exige los criterios de D10 de ese cambio (D11 de `indice-docx-actualizado`).
- [Tres cambios sin archivar con deltas de `captura-reportes` y `generacion-documental`] → solo `ADDED`
  con nombres nuevos; archivar después de `reportes-mantenimiento-for-icsi-rmt-01` y
  `ux-editor-inicio-captura`.
- [`Foto` exige `rotacion` y los datos de prueba no la traen] → se actualizan las funciones de ejemplo de
  las pruebas de `FotosAlcance` y `EditorReporte`.

## Migration Plan

1. Entrega 1, sin migración: dominio, miniaturas, tarjeta, arrastre, vista ampliada y reemplazo
   (grupos 2 a 7 de `tasks.md`).
2. Entrega 2: `0017_fotos_rotacion.sql`, esquemas y giro en el editor y el DOCX (grupos 8 y 9). Para
   aplicarla en la base de desarrollo: detener el servidor de desarrollo, respaldar `storage/pglite`
   fuera del repositorio y reiniciarlo; PGlite la aplica al abrir la base y la registra en
   `interno.migraciones`. En Supabase se aplicará con el resto (tarea 3.8 del cambio anterior).
3. Reversión: la interfaz se revierte por commit. Para los datos, una migración posterior elimina las
   envolturas, devuelve su nombre a `api_guardar_reporte_0016` y `api_crear_revision_0003` y quita la
   columna (se pierden los
   giros; los archivos no cambian); en desarrollo basta restaurar el respaldo de `storage/pglite`. Las
   miniaturas son archivos de más que se pueden borrar: se regeneran al pedirlas.

## Decisiones del usuario

Tomadas el 2026-10-21 (respuesta del usuario o por omisión de los análisis):

1. Soltar una foto en otra columna (ANTES, DURANTE, DESPUÉS) del mismo alcance cambia su espacio
   (usuario).
2. Barra con Ampliar, Girar, Reemplazar, Quitar y «⋯», visible con el puntero y con el foco, con
   alternativa de un clic y de teclado; vista ampliada por alcance con «Deshacer» propio; giro como
   metadato aplicado con CSS y con sharp, sin reescribir archivos; reemplazo compuesto en el cliente;
   miniaturas de 480 px al cargar y bajo demanda (por omisión).
