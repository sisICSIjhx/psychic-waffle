# Proposal

## Why

Al abrir el DOCX descargado, Microsoft Word pregunta si se actualizan los campos («Este documento
contiene campos que pueden hacer referencia a otros archivos…») y, si no se acepta, el índice queda sin
números de página. El usuario pidió (2026-10-21) que el reporte llegue con la tabla de contenido ya
actualizada, sin ese paso, como los 157 reportes originales de `insumos/`: todos tienen números de
página e hipervínculos (156) y ninguno pide actualizar. Es un paso manual menos en un flujo cuya meta es
un reporte en 30 minutos o menos.

## What Changes

**Comportamiento actual comprobado (2026-10-21, rama `feat/ux-fase-c`, commit 163c9a1):**

- La plantilla `src/lib/server/plantillas/FOR-ICSI-RMT-01.v1.docx` lleva `<w:updateFields w:val="true"/>`
  en `word/settings.xml`, que inserta `scripts/construir-plantilla.ts` (547-559) y exige
  `src/lib/server/documentos/generar.spec.ts` (334-336). Esa marca provoca el aviso; ningún campo lleva
  `w:dirty`.
- El índice guardado solo trae los títulos (`generar.ts`, línea 265, `indice.alcances`): no tiene
  números de página, hipervínculos, `PAGEREF` ni marcadores `_Toc`. Quitar solo `updateFields` dejaría
  un índice sin páginas.
- Fue una decisión del punto de control de la fase 2 (`HISTORIAL.md`, entrada del 2026-10-20, «índice
  con aviso de actualización al abrir»). **Este cambio revierte esa decisión** a petición del usuario.
- El servidor no tiene un motor de maquetación: LibreOffice no está instalado (`SOFFICE_PATH` vacío) y
  Word no debe usarse en un servidor. Word 365 sí está instalado en el equipo de desarrollo.

**Comportamiento propuesto:**

- El generador calcula la página de cada título con un modelo de paginación propio y determinista,
  calibrado contra Word 365. El prototipo del análisis acertó 284 de 284 entradas en calibración y 482
  de 485 (99,4 %) fuera de muestra, en menos de 1 ms por documento.
- El índice se escribe ya resuelto, con la estructura de los originales: un campo TOC con una entrada por
  título, cada una con hipervínculo a un marcador `_Toc` del título, numeración y texto, relleno de puntos
  y un `PAGEREF` con el número calculado. Sin `w:updateFields` ni `w:dirty`, Word abre sin aviso y
  muestra los números guardados; «Actualizar tabla» sigue disponible (decisión del usuario).
- En la franja dudosa del pie, el título pasa a la página siguiente con un salto forzado, para que el
  índice coincida con Word (decisión del usuario).
- Se tienen en cuenta las páginas de la portada y del índice: si alguna pasa a dos páginas, los números
  se desplazan.
- Plantilla v2 (`VERSION_PLANTILLA = 'FOR-ICSI-RMT-01.v2'`): sin `updateFields` y con el control del
  índice listo para recibir las entradas. Los DOCX v1 guardados no se reutilizan. El formato del
  documento no cambia.
- Se versionan solo números: los anchos de carácter de Arial (tomados de Arimo/Liberation, compatibles
  en métricas y de licencia libre) y de Aptos (extraídos de la fuente local). Ningún archivo de fuente
  entra al repositorio (decisión del usuario).
- Arnés de verificación con Word, solo en desarrollo y en Windows: genera reportes sintéticos y los 3
  de prueba, mide las páginas reales y compara el índice guardado con el que deja «Actualizar tabla».

Fuera de alcance: la conversión a PDF (sigue como prueba con LibreOffice), cambios de formato del
documento y Word en el servidor. No cambia la interfaz ni la base de datos: este cambio no reserva
migración.

Orden con los demás cambios (ver `design.md`, D11): va después de `fechas-ejecucion-multiples` (la
fecha de varios días cambia el texto de la portada, que es una entrada del modelo) y antes de
`editor-fotos` (girar fotos cambia las medidas que recibe el modelo; ese cambio debe volver a correr el
arnés).

## Capabilities

### New Capabilities

- `generacion-documental`: se **agregan** requisitos del índice del DOCX: resuelto al abrir, entradas
  con número de página y enlace, precisión medida contra Word, salto en la franja dudosa, páginas de la
  portada y del índice, plantilla v2 sin reutilizar los documentos v1, formato conservado y cálculo sin
  programas externos. Es la ruta de capacidad que define el cambio sin archivar
  `reportes-mantenimiento-for-icsi-rmt-01` (por eso no está en `openspec/specs/`). Este cambio solo usa
  `ADDED`: amplía sus requisitos «Plantilla FOR-ICSI-RMT-01» y «Documento editable» y sustituye la
  decisión de la fase 2 sobre el índice con aviso.

### Modified Capabilities

Ninguna en `openspec/specs/`.

## Impact

- Código: `src/lib/server/documentos/` (nuevos `paginacion.ts`, `indice.ts`, `sinteticos.ts` y la tabla
  generada `anchos-fuentes.ts`; `generar.ts` integra el cálculo y el posproceso del índice),
  `src/lib/server/plantillas/` (plantilla v2 y `vigente.ts`) y `scripts/construir-plantilla.ts`.
  Scripts nuevos: `scripts/extraer-anchos-fuentes.ts`, `scripts/verificar-indice-word.ts` y
  `scripts/paginas-word.ps1`. En `package.json`, el script `verificar:indice`.
- Pruebas: `generar.spec.ts` invierte la expectativa de `updateFields`. Se agregan `paginacion.spec.ts`,
  `indice.spec.ts`, `anchos-fuentes.spec.ts` y `sinteticos.spec.ts`; `captura.spec.ts` prueba la caché
  por versión de plantilla.
- Datos: sin migración. Los DOCX registrados con la v1 se regeneran en la siguiente descarga
  (`src/lib/server/captura.ts`, 252-258, compara `versionPlantilla`).
- Sin dependencias nuevas (`jszip` ya está). Microsoft Word solo se usa en desarrollo para verificar.
