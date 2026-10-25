# Proposal

## Why

El usuario pidió mejorar la interfaz de fotos del editor: reordenarlas arrastrando dentro del alcance
y tener, al pasar el puntero, botones sobre la foto para ampliarla, reemplazarla, quitarla y girarla,
de modo que decida rápido si cada foto va en su lugar y el reporte se acerque a la meta de 30 minutos.
Hoy solo se reordena con ↑/↓, no hay vista ampliada, giro ni reemplazo, y cada tarjeta descarga la
versión de 1600 px (≈180 KB) como si fuera una miniatura.

## What Changes

**Comportamiento actual comprobado (2026-10-21, rama `feat/ux-fase-c`):**

- `src/lib/components/reportes/FotosAlcance.svelte`: tarjeta con la imagen 4:3 (la optimizada de
  1600 px con `loading="lazy"`), el pie «Ilustración 2.n.m», la descripción y, debajo, ↑/↓ (intercambian
  con la vecina visible del mismo grupo), una lista de espacio (antes/durante/después), una lista
  «Mover a…» (agrega al final del destino con `EditorReporte.moverFoto`) y «Quitar» (baja aplazada con
  «Deshacer»). Arrastrar solo sirve para cargar archivos (`dataTransfer.types` con `Files`).
- No hay vista ampliada, giro ni reemplazo. `reporte_fotos` (`supabase/migrations/0003_reportes.sql`)
  no tiene giro y el guardado solo acepta `{ id, descripcion, momento }` por foto
  (`esquemaReporteGuardado` en `src/lib/dominio/esquemas.ts`).
- `GET /reportes/[id]/fotos/[fotoId]` sirve la optimizada de 1600 px con
  `Cache-Control: private, max-age=86400, immutable` y consulta el reporte completo en cada imagen.
- El DOCX reutiliza los bytes de la optimizada en el perfil preferido
  (`prepararSegunPerfil` en `src/lib/server/documentos/generar.ts`).
- Una revisión comparte los archivos de foto con el reporte emitido que sustituye
  (`api_crear_revision` copia las rutas).

**Comportamiento propuesto:**

- **Tarjeta:** miniatura más grande que abre la vista ampliada y, sobre la foto, una barra con
  Ampliar, Girar, Reemplazar, Quitar y «Más acciones» (⋯: Mover antes, Mover después, Espacio y Mover
  a otro alcance), visible al pasar el puntero o con el foco. Sustituye a ↑/↓ y a las dos listas.
- **Arrastre para reordenar** dentro del alcance, con indicador de inserción; soltar en otra columna
  (ANTES, DURANTE, DESPUÉS) cambia el espacio. Entre alcances se usa «Mover a otro alcance».
  Alternativas de un clic (menú) y de teclado (modo de agarre en el asa) con aviso para lectores de
  pantalla.
- **Vista ampliada** por alcance con la foto de 1600 px, «3 de 12», ← y →, acciones y un «Deshacer»
  propio.
- **Reemplazar** conservando posición, pie, descripción y espacio, con «Deshacer».
- **Girar** en pasos de 90° como dato de la foto (migración `0017_fotos_rotacion.sql`), visible en el
  editor y aplicado en el DOCX. Los archivos de la foto nunca se reescriben.
- **Miniaturas de 480 px** generadas al cargar y, para las fotos anteriores, la primera vez que se
  piden.

Fuera de alcance: arrastrar entre alcances, editar la imagen (recorte, brillo), captura con la cámara
y arrastre táctil (el uso es solo en escritorio, decisión del cambio `ux-editor-inicio-captura`),
bandeja de fotos sin asignar.

Decisiones aplicadas (2026-10-21): soltar en otra columna del mismo alcance cambia el espacio
(usuario); barra con Ampliar, Girar, Reemplazar, Quitar y «⋯» visible con el puntero y con el foco;
vista ampliada por alcance con «Deshacer» propio; giro como metadato aplicado con CSS en el editor y
con sharp en el DOCX; reemplazo compuesto en el cliente con baja aplazada; miniaturas de 480 px (por
omisión).

## Capabilities

### New Capabilities

- `captura-reportes`: se **agregan** requisitos de manejo de fotos en el editor (barra de acciones,
  reordenar arrastrando con alternativas, vista ampliada, reemplazar, girar y miniaturas). Es la misma
  ruta de capacidad que definen los cambios sin archivar `reportes-mantenimiento-for-icsi-rmt-01`
  («Alcances con descripción y evidencia», «Carga de fotografías») y `ux-editor-inicio-captura`
  («Carga de fotos por arrastre», «Quitar con deshacer»); este cambio solo usa `ADDED`, amplía esos
  requisitos sin modificarlos y sustituye únicamente los controles ↑/↓ y las listas de la tarjeta.
- `generacion-documental`: se **agrega** el giro de las fotos en el documento y la garantía de que las
  ediciones de una revisión no alteran el reporte emitido. Amplía «Fotografías en el documento» de
  `reportes-mantenimiento-for-icsi-rmt-01`.

### Modified Capabilities

Ninguna en `openspec/specs/`.

## Impact

- Código: `src/lib/components/reportes/` (`FotosAlcance.svelte`, nuevos `TarjetaFoto.svelte`,
  `VisorFotos.svelte` y `arrastreFotos.ts`; `EditorReporte.svelte` para reemplazar, deshacer desde la
  vista y el giro en el guardado), reglas puras nuevas en `src/lib/dominio/fotos.ts`,
  `src/lib/dominio/esquemas.ts` y `aGuardado` en `src/lib/dominio/captura.ts`, `src/lib/server/captura.ts`
  (miniatura, limpieza, giro hacia el documento), `src/routes/reportes/[id]/fotos/[fotoId]/+server.ts`
  (`?tamano=mini`), `src/lib/server/documentos/imagenes.ts` y `generar.ts` (giro con sharp),
  `scripts/prueba-documental.ts` (caso de foto girada) y, del índice del DOCX, `sinteticos.ts`,
  `scripts/verificar-indice-word.ts` y `calibracion/paginas-word.v2.json` (giro en las semillas y nueva
  medición con Word).
- Datos: migración `supabase/migrations/0017_fotos_rotacion.sql` (columna `reporte_fotos.rotacion`,
  `json_foto` y envolturas de `api_guardar_reporte` y `api_crear_revision`). PGlite la aplica al
  reiniciar el servidor de desarrollo; en Supabase irá con el resto (tarea 3.8, pendiente).
- Orden: rama `feat/editor-fotos` apilada sobre `feat/indice-docx`. Asume que `0016_dias_ejecucion.sql`
  ya envolvió `api_guardar_reporte` (que `0017` vuelve a envolver, renombrando la de `0016` a
  `api_guardar_reporte_0016`), que `api_crear_revision` sigue siendo la de `0003` (`0017` la envuelve por
  primera vez como `api_crear_revision_0003`) y que el índice del DOCX calcula páginas con las medidas
  finales de cada foto. Como el giro cambia esas medidas, este cambio vuelve a medir el índice con Word
  (`npm run verificar:indice`) según D11 de `indice-docx-actualizado`.
- Sin dependencias nuevas.
