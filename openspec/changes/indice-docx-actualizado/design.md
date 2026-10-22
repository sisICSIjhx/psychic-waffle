# Design

## Context

Motivación y alcance en `proposal.md`; requisitos en `specs/generacion-documental/spec.md`. Estado de
partida comprobado en `feat/ux-fase-c` (commit 163c9a1):

- `generarDocx` (`src/lib/server/documentos/generar.ts`, 223-306) prepara las fotos en
  `prepararAlcances` (193-221): medida final con `ajustarACaja` sobre la caja de 8 × 6 cm (`CAJA_FOTO`,
  `src/lib/dominio/documento.ts`). Después arma `datos`, los pasa por `sanear` y llama una sola vez a
  `createReport` de `docx-templates`. No hay posproceso del paquete. El índice son solo textos
  (`indice.alcances`, línea 265).
- `scripts/construir-plantilla.ts` construye la plantilla desde un reporte real de `insumos/` (solo en
  local). `indice()` (226-253) escribe un control de contenido «Table of Contents» con el campo
  `TOC \o "1-3" \h \z \u` y entradas de solo texto (estilos `TDC1` y `TDC2`); después del índice va un
  salto de página manual. 547-559 inserta `<w:updateFields w:val="true"/>`. Los títulos del cuerpo usan
  `Level1` (basado en Título 1) y `Alcances` (basado en Título 2, numeración automática «2.%1 »).
- `VERSION_PLANTILLA` (`generar.ts`, 25) y la ruta en disco (26-28) apuntan a la v1; la aplicación usa
  la plantilla empaquetada por Vite en `src/lib/server/plantillas/vigente.ts` (`?inline`).
  `ServicioCaptura.generarDocumento` (`src/lib/server/captura.ts`, 248-296) reutiliza un DOCX si
  coinciden `reporteVersion` y `versionPlantilla`.
- `src/lib/server/documentos/ooxml.ts` edita WordprocessingML como texto (`elementos`, `bloquesCuerpo`,
  `escaparXml`); `auditoria.ts` audita el paquete.
- Entorno: el servidor no tiene Word ni LibreOffice. El equipo de desarrollo tiene Microsoft Word 365
  16.0.20430 (modo de compatibilidad 15), que se automatiza por COM. Arial y Aptos no se incrustan en
  el DOCX; Aptos es una fuente en la nube de Office (`%LOCALAPPDATA%\Microsoft\FontCache\4\CloudFonts\Aptos\`).
  Open Sans y Arimo Bold sí van incrustadas (licencias libres). Arimo y Liberation Sans no están
  instaladas en el equipo.
- Análisis y prototipos, fuera del repositorio y temporales:
  `C:\Users\sistemas\AppData\Local\Temp\claude\C--reportes-icsi\a1717158-7016-44c9-ab51-58edfe7c7ec8\scratchpad\analisis\resultado-indice-docx.md`
  y su carpeta `indice-docx\` (`paginacion.mjs`, `indice-calculado.mjs`, `paginas-word.ps1`,
  `gen-aleatorios.mjs`, `comparar.mjs`, `ttf.mjs`). Este diseño recoge las reglas y constantes
  calibradas (D3) para que la implementación no dependa de esa carpeta.
- Orden: este cambio va en `feat/indice-docx`, apilada sobre `feat/fechas-multiples` (cambio
  `fechas-ejecucion-multiples`). No tiene migración reservada.

## Goals / Non-Goals

**Goals:**

- Entregar el índice resuelto con un cálculo puro, determinista y rápido (< 5 ms por documento), sin
  procesos externos en ejecución.
- Que el modelo tome exactamente los datos que recibe la plantilla, para que los cambios de datos (fechas
  de varios días, fotos giradas) le lleguen sin código adicional.
- Precisión medida y repetible con Word: un arnés de desarrollo y pruebas con resultados de Word
  guardados que corren en cualquier equipo.

**Non-Goals:**

- Cambiar el formato del documento o la fuente de los pies (decisión del usuario: se versionan los
  anchos de Aptos).
- Paginar igual que LibreOffice, Word para Mac o la web, o versiones anteriores a Word 365 (riesgo
  documentado).
- Generar el PDF; `pdf.ts` no cambia.
- Interfaz, base de datos y migraciones.

## Decisions

### D1. Modelo de paginación propio con el índice precalculado

El generador calcula la página de cada título con un modelo que reproduce las reglas de Word medidas en
el análisis (D3) y escribe el índice ya resuelto (D7), sin `updateFields` ni `w:dirty`, con salto
forzado en la franja dudosa (D6). Es la opción (a)+(d1) del análisis, elegida por el usuario.
Alternativas descartadas:

- LibreOffice sin interfaz para actualizar el índice: no está instalado, su paginación no es la de Word
  (otras fuentes para Aptos, otra justificación), pesa cientos de MB, tarda segundos por documento y,
  si reescribe el DOCX, arriesga la portada y los estilos.
- Índice sin números, solo con hipervínculos: exacto, pero se aparta de los 157 originales y deja el
  papel sin referencia de página.
- Word en el servidor: sin soporte de Microsoft para servidores, exige Windows y licencia.
- Marcar el TOC con `w:dirty`: Word lo actualiza al abrir, se bloqueó al automatizarlo en la fase 2
  (`docs/revisiones/fase-2.md`) y no garantiza que no haya aviso.
- Solo quitar `updateFields`: el índice queda sin números ni enlaces.

### D2. Una sola fuente de datos para la plantilla y el modelo

El modelo no lee el reporte del dominio: lee el objeto `datos` ya saneado que recibe `createReport`
(portada, encabezado, firmas, objetivo, introducción, alcances con descripción y celdas, herramientas,
verificación, conclusiones y número de conclusiones) y la altura final de cada foto que sale de
`prepararAlcances` (EMU → pt). La conversión es la función pura `entradaPaginacion(datos)` en
`paginacion.ts`; para eso `prepararAlcances` conserva en cada celda la medida en cm que ya calcula.
Así, lo que Word recibe y lo que el modelo mide no pueden divergir: textos limpios, pies
«Ilustración 2.n.m», orden de aparición de las fotos y la fecha formada del encabezado.
Alternativa descartada: calcular desde `ReporteDocumento`. Duplicaría `parrafos`, `pieIlustracion`,
`ordenDeAparicion` y la agrupación de filas, y cualquier cambio en esas reglas desfasaría el índice.

### D3. `src/lib/server/documentos/paginacion.ts`: traslado del prototipo y reglas calibradas

Módulo puro en TypeScript, sin `fs`, sin estado global y sin leer fuentes del sistema. Exporta los tipos
`EntradaPaginacion`, `Bloque` y `ResultadoPaginacion`; `renglones(texto, ancho, fuente, pt, opciones)`;
`bloquesDelModelo(entrada)` (otro nombre que `bloquesCuerpo` de `ooxml.ts`, para no confundirlos);
`paginar(bloques, paginaInicial, geometria)`; `calcularIndice(entrada)`, que devuelve las entradas
`{ nivel, numero, texto, pagina, saltoForzado }`, las páginas totales y la traza opcional; y la
constante `GEOMETRIA_V2`, con `versionPlantilla: 'FOR-ICSI-RMT-01.v2'`.

| Prototipo (fuera del repositorio)           | Destino                                                                        | Cambios al trasladar                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paginacion.mjs`                            | `src/lib/server/documentos/paginacion.ts`                                      | Tipado; anchos desde `anchos-fuentes.ts` (D4); constantes en `GEOMETRIA_V2`; sin `TRAZA` ni `configurar` globales (opciones por parámetro); entrada de D2; portada e índice (D5); salto forzado (D6) |
| `indice-calculado.mjs`, `verificar-xml.mjs` | `src/lib/server/documentos/indice.ts` y sus pruebas                            | Integrado en `generarDocx` (D7); estructura exacta de los originales; identificadores sin colisión; error si no cuadran los títulos                                                                  |
| `ttf.mjs`, `anchos.mjs`, `gpos.mjs`         | `scripts/extraer-anchos-fuentes.ts`                                            | Lee los archivos indicados y escribe solo números (D4)                                                                                                                                               |
| `gen-aleatorios.mjs`, `generar-prueba.mjs`  | `src/lib/server/documentos/sinteticos.ts` y `scripts/verificar-indice-word.ts` | Generación pura por semilla en `src/` (la usan las pruebas) e imágenes y DOCX en el script (D9); agrega fechas de varios días, listas de TAG y nombres largos y títulos muy largos                   |
| `paginas-word.ps1` (y `lineas2-word.ps1`)   | `scripts/paginas-word.ps1`                                                     | Agrega renglones por párrafo y fin de la portada; mismas protecciones (D9)                                                                                                                           |
| `comparar.mjs`                              | `scripts/verificar-indice-word.ts`                                             | Criterios de D10 y archivo de resultados de Word para las pruebas                                                                                                                                    |

Geometría de la v2 (la misma de la v1, medida con Word):

| Elemento              | Valor                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Página de contenido   | 12240 × 15810 twips; márgenes superior 1843, inferior 720, izquierdo y derecho 1418; cuerpo de y = 92,15 a 754,5 pt (662,35 pt útiles) y 470,2 pt de ancho (9404 twips)      |
| Portada               | Márgenes 1701/720/720/720 twips; con los datos de prueba termina en y = 717,6 pt (≈ 37 pt libres, unos 2 renglones)                                                          |
| Índice                | Entradas cada 22 pt desde y = 119,4 pt; caben unas 28 entradas de un renglón                                                                                                 |
| Numeración de páginas | Portada en 1, índice en 2 y cuerpo desde 3 (salto manual tras el índice; la numeración no se reinicia)                                                                       |
| Interlineado sencillo | Arial: (2355/2048) × tamaño (13,8 pt a 12 pt), de `winAscent + winDescent + lineGap`; Aptos: (2500/2048) × tamaño (10,99 pt a 9 pt), de las métricas tipográficas            |
| `Level1`              | Arial 12 negrita, antes 6 pt, después 0, interlineado × 1,4 (336 auto), `keepNext` y `keepLines`                                                                             |
| `Alcances`            | Arial 12 negrita, antes 2 pt, después 2 pt, interlineado × 278/240; número «2.N » desde 18 pt y texto desde 36 pt                                                            |
| Párrafo del cuerpo    | Arial 12, antes y después 6 pt, interlineado × 276/240, justificado                                                                                                          |
| Celda de foto         | (etiqueta: 6 + 13,8) + 6 + alto de la foto + 2 + renglones del pie × 10,99 + 8 pt; columna de 4702 twips (foto sola: 9404); pie en Aptos cursiva 9 con 216 twips de márgenes |
| Herramientas          | Encabezado 22,75 pt (17,15 al repetirse); fila max(16,75; n × 13,8) + 0,5 pt; anchos de texto (1195, 1946, 6323) − 216 twips                                                 |
| Verificación          | Encabezado 27,2 pt (21,7 al repetirse); fila max(38,35; n × 13,8) + 0,5 pt; anchos de texto efectivos (4071, 1657, 2502) − 216 twips                                         |

Reglas calibradas (cada una subió la precisión en las semillas 1-24, de 261 a 284 de 284 entradas):

- R1. El espacio entre párrafos es el mayor entre el posterior del anterior y el anterior del
  siguiente, también dentro de las celdas; después de una fila de tabla solo cuenta el anterior.
- R2. El interlineado sale de las métricas de la fuente (tabla anterior) multiplicado por el factor del
  estilo.
- R3. Control de viudas: un párrafo de 3 renglones o menos no se divide; al dividir quedan al menos 2
  renglones en cada página.
- R4. Las filas de fotos (`cantSplit`) no se dividen y miden según la tabla (error de ±0,6 pt frente a
  Word); las filas antes/durante llevan `keepNext` con la fila siguiente.
- R5. En texto justificado, Word comprime los espacios para que entre la palabra siguiente si
  exceso / (espacios × ancho del espacio) ≤ 0,245 y exceso ≤ 0,42 × ancho de esa palabra (0 errores en
  369 casos medidos). Corte voraz en espacios y después de guion.
- R6. En `Alcances`, si el número «2.N » pasa de la sangría (36 pt), la tabulación salta a la siguiente
  tabulación predeterminada (múltiplos de 35,4 pt).
- R7. El interlineado adicional del último renglón puede quedar bajo el margen inferior (holgura =
  interlineado − 13,8 pt).
- R8. La fila de encabezado de una tabla no queda sola al pie (va con la primera fila de datos); las
  filas de datos de 4 renglones o más se pueden dividir y en la página siguiente se repite el
  encabezado.
- R9. Los títulos con `keepNext` arrastran lo que los acompaña: el título siguiente, la primera fila o
  los primeros renglones (con R3) del bloque siguiente.

Las constantes viven en `GEOMETRIA_V2` y solo se usan por medio de ese objeto. Una prueba falla si su
`versionPlantilla` no es `VERSION_PLANTILLA` o si los márgenes, el tamaño de página y el espaciado de
`Level1`, `Alcances`, `Descripcin`, `TDC1` y `TDC2` leídos de la plantilla v2 no coinciden con la
geometría (D10).

### D4. Anchos de carácter versionados como números

`scripts/extraer-anchos-fuentes.ts`, traslado de `ttf.mjs`, lee los archivos de fuente que se le
indican (cmap 4 y 12, `hmtx`, `hhea`, `OS/2`, `head`, `name` y los pares de `kern` o de GPOS si se
usan) y escribe `src/lib/server/documentos/anchos-fuentes.ts`. Es un módulo generado, con un encabezado
«generado, no editar» que dice el origen, la licencia y la versión de cada fuente, y que contiene solo
números: unidades por em, métricas verticales y el avance de cada carácter cubierto. Ni contornos ni
archivos de fuente entran al repositorio.

- Arial normal y negrita: desde Arimo o Liberation Sans (Regular y Bold, Apache 2.0 u OFL, con los
  mismos avances que Arial). Los archivos se obtienen de su fuente oficial, con autorización del usuario,
  en una carpeta fuera del repositorio. El modelo usa la negrita en `Level1` y `Alcances`.
- Aptos normal y cursiva: desde la caché local de Office. El script identifica cada estilo por la tabla
  `name`. La normal se usa en las entradas del índice (estilo `Normal`) y en las firmas de la portada; la
  cursiva, en los pies de foto.
- Cobertura: latín básico, latín-1, latín extendido A y puntuación general (rayas, comillas tipográficas,
  puntos suspensivos, viñeta, grado, «×», «±»). Para cualquier otro carácter se usa el ancho promedio de
  la fuente (`xAvgCharWidth`), y una prueba exige cobertura total de los textos de `scripts/datos-prueba`
  y del vocabulario sintético.
- Kerning: el prototipo calculó con los pares de `kern` de Arial y el análisis midió que su efecto en
  los renglones decisivos es 0. Se versionan los pares de Arimo solo si mejoran la precisión de D10;
  si no, el modelo calcula sin kerning.
- Referencias para la prueba: en Arial, «M» = 1706, «a» = 1139 y el espacio = 569 de 2048 unidades.

### D5. Páginas previas al cuerpo: portada e índice

`calcularIndice` obtiene la página inicial del cuerpo como 1 + páginas de la portada + páginas del
índice, y no la supone fija en 3.

- Portada: es la sección 1. El cuadro de texto del título está anclado, no crece (`noAutofit`) y no
  mueve el flujo. Las filas que crecen son las celdas variables del encabezado (usuario, contrato,
  sitio, TAG, periodicidad, fecha y tipo; Open Sans, anchos de la rejilla de la plantilla) y de las
  firmas (nombre, cargo y empresa; Aptos). El modelo suma a la altura fija calibrada la altura de esas
  filas con `renglones`. Si pasa del margen inferior, la portada ocupa 2 páginas.
- Índice: cada entrada mide sus renglones (Aptos 12; ancho hasta la tabulación derecha de 9394 twips,
  menos la sangría, el número de entrada y el número de página). Si las entradas no caben desde y =
  119,4 pt hasta el margen inferior, el índice ocupa 2 páginas.
- Las páginas de la portada y del índice se validan con el arnés (D9), con semillas que llevan muchos
  TAG, nombres largos, fechas de varios días y 14 alcances con títulos largos.
- **Pendiente de confirmar con el usuario:** las celdas del encabezado de la portada usan Open Sans,
  que la decisión 3 no menciona (solo Aptos y Arial). Open Sans tiene licencia libre y ya va incrustada
  en la plantilla, así que su tabla de anchos se extraería de la misma forma que las demás (D4). Sin esa
  tabla no se puede calcular si la portada pasa a 2 páginas. Hasta que el usuario confirme, la tarea
  correspondiente no se implementa.

### D6. Salto forzado en la franja dudosa

Para cada título, `paginar` calcula la holgura: margen inferior − (y + espacio anterior + renglones del
título + lo que lo acompaña por R9). Si |holgura| ≤ ε, el título se marca con `saltoForzado` y el modelo
lo coloca al inicio de la página siguiente. Así cubre los dos sentidos: lo que apenas cabe y lo que
apenas no cabe. `ε` es parte de `GEOMETRIA_V2`, con un valor inicial de 1,5 pt (el caso límite del
análisis, «4. CONCLUSIONES» de prueba-2, quedó a 0,2 pt). Solo se ajusta si el arnés muestra un caso
que lo exija.

`escribirIndice` agrega `<w:pageBreakBefore/>` al `w:pPr` de esos títulos en el orden del esquema:
después de `w:pStyle`, `w:keepNext` y `w:keepLines`, y antes de los demás elementos. El espacio
anterior de un título con salto forzado, al inicio de página, se mide con el arnés y se fija en el
modelo (en el prototipo es 0).
Alternativa descartada: forzar también filas o párrafos. Una fila no admite `pageBreakBefore` y forzar
párrafos cambia el formato más de lo que el usuario aceptó. Los errores que no nacen en un título se
corrigen con «Actualizar tabla».

### D7. Índice y marcadores en un posproceso del paquete (`src/lib/server/documentos/indice.ts`)

`escribirIndice(docx, calculo)` corre después de `createReport`. Abre el paquete con JSZip, edita
`word/document.xml` como texto con `ooxml.ts` y vuelve a generar el paquete. JSZip reutiliza los datos
comprimidos de las partes que no cambian, como las fotos. Pasos:

1. Recorre los párrafos `Level1` y `Alcances` posteriores al control del índice, en orden. Si su número
   no es el de las entradas calculadas, lanza un error y no entrega el documento.
2. A cada título le pone un marcador `_Toc` con nombre determinista (`_Toc` + número de 9 cifras por
   posición) y un `w:id` mayor que cualquier marcador existente: `w:bookmarkStart` después de
   `</w:pPr>` y `w:bookmarkEnd` antes de `</w:p>`.
3. Sustituye el párrafo de reserva del control del índice por las entradas, con la estructura de los
   originales. Cada entrada es un párrafo `TDC1` o `TDC2` con la tabulación derecha con puntos en 9394
   twips (y en `TDC2`, la tabulación izquierda en 960). Lleva `w:hyperlink w:anchor="_Toc…"
w:history="1"` con el estilo de carácter `Hipervnculo` y `w:noProof`, la numeración («1. OBJETIVO»,
   o «2.1», tabulación y título), la tabulación y el campo `PAGEREF _Toc… \h` con el número calculado,
   y `w:webHidden` en la tabulación y en el número. El campo TOC exterior abre (begin, instrucción y
   separate) en la primera entrada y cierra en la última. Los textos pasan por `escaparXml`.
4. Agrega `pageBreakBefore` a los títulos con salto forzado (D6).
5. Comprueba que `word/settings.xml` no tiene `w:updateFields` y que no hay `w:dirty` en el documento,
   los encabezados ni los pies. Si los hay, lanza un error: la plantilla v2 no los trae.

Alternativa descartada: escribir el índice con XML literal de `docx-templates`. `sanear` elimina a
propósito su delimitador de todos los textos, para que ningún dato capturado se interprete como XML.
Habría que abrir esa protección y mezclar textos del usuario con XML crudo en la plantilla, y aun así
los atributos `w:anchor` no admiten comandos.

### D8. Plantilla v2, versión y caché

- `scripts/construir-plantilla.ts` escribe `FOR-ICSI-RMT-01.v2.docx`. Ya no inserta `updateFields` y
  comprueba que no queda ninguno (al revés que hoy). `indice()` deja en el control de contenido el
  título «Contenido» (`TtuloTDC`) y un párrafo `TDC1` de reserva con el campo TOC vacío (begin,
  instrucción, separate y end). Así el paquete es válido por sí solo; `escribirIndice` sustituye ese
  párrafo. Se quitan `indice.alcances` de `datos` y el bucle de la plantilla. Se ejecuta en local con
  el mismo reporte fuente de `insumos/` que produjo la v1, y después se audita.
- Antes de retirar la v1 se comparan las partes de ambos paquetes: solo deben diferir `word/settings.xml`
  y el control del índice dentro de `word/document.xml`. Después se retira la v1 del árbol (queda en el
  historial de Git) y se actualizan `vigente.ts`, la ruta y `VERSION_PLANTILLA` de `generar.ts`, la
  constante de `generar.spec.ts` y el comentario de `scripts/prueba-documental.ts`.
- La caché de `generarDocumento` ya compara `versionPlantilla`. Con la v2, ningún DOCX v1 se reutiliza
  y la siguiente descarga genera y registra uno nuevo. Las cadenas `'FOR-ICSI-RMT-01.v1'` de
  `captura.spec.ts` y `repositorios.spec.ts` son datos de prueba del registro y pueden quedarse.

### D9. Reportes sintéticos y arnés con Word solo en desarrollo

- `src/lib/server/documentos/sinteticos.ts` (puro, sin imágenes): `reporteSintetico(semilla, base)`
  devuelve los datos del reporte y las dimensiones de cada foto. Conserva el generador congruencial
  del prototipo (`estado = semilla × 7919`, multiplicador 1103515245, incremento 12345, módulo 2³¹) y su
  orden de sorteos. Agrega casos de portada (de 1 a 12 TAG, nombres y cargos largos, fechas de uno o
  varios días formadas con la función del cambio 2) y títulos de hasta 183 caracteres. El vocabulario
  sale de `scripts/datos-prueba/manometros-cuadricula.json`, sin datos personales. Lo usan las pruebas y
  el arnés.
- `scripts/paginas-word.ps1`: abre cada DOCX en una instancia propia y oculta de Word, en solo lectura.
  Si se conecta a una instancia existente, aborta sin tocarla. Lee la página de cada título (nivel de
  esquema 1 y 2), los renglones de cada párrafo del cuerpo, el fin de la portada, las páginas totales y
  el texto del índice antes y después de `TablesOfContents(1).Update()`. Cierra sin guardar y llama a
  `Quit` en un bloque `finally`.
- `scripts/verificar-indice-word.ts` (`npm run verificar:indice`): genera en
  `storage/verificacion-indice/` (ignorado) los 3 documentos de prueba con las fotos de relleno de
  `prueba-documental` (cada tercera, vertical; nunca las de `insumos/`, para que sea determinista) y los
  reportes sintéticos del rango de semillas pedido. Llama al arnés y escribe
  `src/lib/server/documentos/calibracion/paginas-word.<versión>.json` con la versión de plantilla, la
  versión de Word y, por documento, las páginas de los títulos, los renglones por párrafo, las páginas
  de la portada y del índice y si el índice guardado es igual al actualizado. Compara con el modelo e
  imprime los criterios de D10. Con `-- <docx…>` solo compara el índice guardado con el actualizado, sin
  modelo, para documentos con fotos reales. Fuera de Windows o sin Word termina con un mensaje claro y
  código distinto de 0. No abre la base de datos ni forma parte de `npm run test`.

### D10. Pruebas y criterios de precisión

Conjunto de verificación: semillas 1-24 (calibración del análisis), 25-64 (validación del análisis) y
65-104 (nuevas, no usadas para calibrar), más los 3 documentos de prueba (`scripts/datos-prueba`, 37
entradas). Antes del cambio el prototipo medía 284 de 284 entradas en 1-24, 482 de 485 en 25-64 (39 de
40 documentos exactos) y 36 de 37 en los de prueba, sin salto forzado.

Criterios de aceptación con la v2 (medidos con el arnés y repetidos sin Word por las pruebas a partir
del archivo de resultados):

- ≥ 99 % de entradas exactas en todo el conjunto y en el subconjunto 25-104.
- Los 3 documentos de prueba exactos, con su índice guardado idéntico al que deja «Actualizar tabla».
- Ninguna diferencia mayor de una página.

Pruebas (proyecto `server` de Vitest):

- `anchos-fuentes.spec.ts`: referencias de D4, interlineados y cobertura de caracteres.
- `sinteticos.spec.ts`: determinismo por semilla y casos de portada e índice presentes.
- `paginacion.spec.ts`:
  - renglones contra Word (objetivo 100 %, como los 193 de 193 párrafos del análisis);
  - paridad con el prototipo contra `paginas-word.v1.json` (salto forzado desactivado);
  - criterios de la v2 contra `paginas-word.v2.json`;
  - salto forzado con holguras de ±0,2 pt y de más de ε;
  - portada e índice de 2 páginas;
  - geometría contra la plantilla y versión.
- `indice.spec.ts`: marcadores, entradas, campos `begin`/`separate`/`end` balanceados, ninguna referencia
  sin marcador, identificadores sin colisión, orden de `pPr` con `pageBreakBefore` y error cuando no
  cuadran los títulos.
- `generar.spec.ts`: invierte 334-336 (sin `updateFields`), sin `w:dirty`, un marcador por título, un
  hipervínculo y un `PAGEREF` por entrada, páginas iguales a las del modelo, `versionPlantilla` v2,
  `auditarPaquete` sin hallazgos y comparación de la v1 con la v2.
- `captura.spec.ts`: un DOCX v1 registrado no se reutiliza y el v2 sí.
- `src/lib/server/importacion/reporte-docx.spec.ts`, que lee un DOCX generado, sigue pasando sin
  cambios.

### D11. Cambios que alteran las entradas del modelo

- Cambio 2, `fechas-ejecucion-multiples` (anterior; rama `feat/fechas-multiples`, migración
  `0016_dias_ejecucion.sql`): la celda Fecha de la portada pasa a mostrar el texto de `fechasEncabezado`
  (por ejemplo, «15, 16, 20-25 / MAYO / 2026») en una celda de 5670 twips en Open Sans, que puede ocupar
  más renglones y alargar la portada (D5). El modelo lee el texto ya formado de
  `datos.encabezado.fecha` (D2), así que no necesita conocer los segmentos; el generador sintético
  incluye fechas de uno y varios días. Si la rama base no trae el cambio 2 terminado, este cambio no
  empieza.
- Cambio 4, `editor-fotos` (posterior; rama `feat/editor-fotos`, migración `0017_fotos_rotacion.sql`):
  el giro (0, 90, 180 o 270) se aplica con sharp e intercambia ancho y alto antes de `ajustarACaja`.
  Una foto 16:9 girada pasa de 4,5 a 6 cm de alto y cambia la altura de su fila (R4). Arrastrar una
  foto a otra columna cambia las filas de antes/durante/después. El modelo toma las medidas finales de
  `prepararAlcances` (D2), así que no necesita código nuevo, pero el cambio 4 debe aplicar el giro antes
  de medir, agregar el giro a `sinteticos.ts`, volver a correr `npm run verificar:indice` y cumplir D10.
  No necesita una versión nueva de plantilla: girar cambia la versión del reporte y la caché se renueva.
- Regla general: un cambio en la plantilla, sus estilos o márgenes, `CAJA_FOTO` o los textos fijos sube
  la versión de plantilla, crea una `GEOMETRIA_vN` y vuelve a calibrar. La prueba de geometría de D3 lo
  exige.

## Risks / Trade-offs

- [El modelo es heurístico: fuera de muestra fallaron 3 de 485 entradas en cascada desde un título, y
  hubo un caso límite de 0,2 pt] → salto forzado (D6), criterios de D10 sobre 104 semillas y «Actualizar
  tabla» como corrección. El campo sigue vivo.
- [Word 2016/2019, Word para Mac o la web y LibreOffice pueden paginar distinto] → el índice refleja la
  maquetación de Word 365 (compatibilidad 15), la que usa el equipo; se documenta en `HISTORIAL.md`.
- [Aptos no se incrusta: en un equipo sin Aptos cambian los pies y la paginación] → mismo
  comportamiento que los originales; «Actualizar tabla» lo corrige en ese equipo.
- [Cambios de plantilla sin recalibrar] → `GEOMETRIA_V2` atada a la versión y prueba de geometría que
  falla (D3, D11).
- [La portada o el índice pasan a 2 páginas] → modelados (D5) y validados con semillas extremas. Si no
  se confirma la tabla de Open Sans, la portada queda sin modelo y el riesgo, abierto.
- [Licencias] → solo números; Arial desde Arimo/Liberation (libres); los anchos de Aptos se versionan
  con la aceptación del usuario.
- [El arnés deja una instancia oculta de Word abierta] → `Quit` en `finally` y verificación de procesos
  al terminar. El análisis dejó una (PID 10760), que el usuario puede cerrar desde el Administrador de
  tareas.
- [El posproceso alarga la generación de documentos grandes] → JSZip reutiliza las partes comprimidas.
  Se mide en los 3 documentos y se registra; el objetivo es menos de 0,5 s adicionales en el de 74 fotos.
- [Los prototipos están en una carpeta temporal] → este diseño contiene las reglas y constantes (D3) y
  la tarea 1.2 los respalda fuera del repositorio.

## Migration Plan

1. Crear `feat/indice-docx` sobre `feat/fechas-multiples` y comprobar la suite.
2. Arnés y reportes sintéticos; medición de la v1 sin `updateFields` (`paginas-word.v1.json`).
3. Anchos de fuentes, modelo y pruebas de paridad con el prototipo.
4. Plantilla v2, posproceso del índice e integración en `generarDocx`.
5. Medición de la v2 (`paginas-word.v2.json`), criterios de D10 y revisión manual en Word.
6. Reversión: revertir los commits. Al volver a la v1, la caché regenera con la v1 (los DOCX v2
   registrados no se reutilizan). No hay migración de datos; los DOCX guardados en
   `storage/documentos/` no se borran. No hace falta detener el servidor ni respaldar `storage/pglite`:
   nada toca la base.

## Open Questions

- Tabla de anchos de Open Sans para la portada (D5): requiere la confirmación del usuario antes de la
  tarea 4.3.
- Origen de Arimo o Liberation Sans (D4): ninguna está instalada. Arimo Bold va incrustada en la
  plantilla, pero Arimo Regular no. El usuario autoriza la descarga desde la fuente oficial o entrega
  los archivos antes de la tarea 3.1.
