# Revisión con Codex — Fase 2 (prueba documental)

Cambio OpenSpec: `reportes-mantenimiento-for-icsi-rmt-01`. Rama: `feat/reportes-rmt-01`.

Ejecución: `scripts/revision-codex.ps1` con `design.md`, `tasks.md` y la spec
`generacion-documental` como contexto, en un directorio vacío y sandbox de solo lectura. Comandos
ejecutados por Codex en ambas rondas: 0. El DOCX de la plantilla es binario y no entra en el diff;
su contenido se valida con la auditoría automática y las pruebas.

## Ronda 1 (commit 9c8be51)

| Severidad | Hallazgo                                                                        | Resolución                                                                  |
| --------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Alta      | La verificación de datos personales leía el árbol de trabajo y no el índice     | Corregido: revisa la versión del índice y la del árbol de trabajo           |
| Alta      | El TAG y otros textos derivados llegaban a la plantilla sin sanear              | Corregido: saneo profundo de todo el objeto de datos                        |
| Alta      | Con 130 fotos reales el documento podía exceder el límite y rechazarse          | Corregido: perfiles de optimización adaptativos por presupuesto, con prueba |
| Media     | Se aceptaban ocurrencias inexistentes (quincena 3, día 30 de febrero, semana 7) | Corregido: límites por tipo y calendario, con pruebas                       |
| Media     | La auditoría ignoraba nombres en atributos OOXML                                | Corregido: compara atributos y nombres de partes, con prueba                |
| Media     | `prueba-documental.ts` no cargaba el `.env` local                               | Corregido: `process.loadEnvFile` si existe `.env`                           |

## Ronda 2 (commit 3e3e98b, última permitida)

| Severidad | Hallazgo                                                                          | Resolución                                                               |
| --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Alta      | La verificación omitía nombres de partes del ZIP (huérfanas o binarias)           | Corregido: incluye los nombres de todas las partes, decodificados        |
| Media     | La reducción adaptativa no degradaba fotos bajo la cuota si una pesada no bastaba | Corregido: en cada perfil degrada después las demás, con prueba del caso |

## Validación de la fase

- `npm run check`: 0 errores y 0 advertencias.
- `npm run lint`: Prettier y ESLint sin observaciones.
- `npm run test`: 6 archivos y 45 pruebas aprobadas. Incluyen 18 de reglas puras (título, periodo y
  ocurrencias, «Ilustración 2.n.m», agrupación, secciones, nombre de archivo y fecha) y 17 de
  generación: marcadores resueltos, orden de secciones con y sin verificación, fotos verticales y
  horizontales sin deformar, antes/durante/después, 130 fotos, reducción adaptativa por presupuesto,
  escapado y saneo, párrafos por renglón, fila de encabezado repetida, auditoría (incluidos
  atributos) y conversor de PDF ausente.
- Plantilla: auditoría del paquete sin hallazgos (sin autor, customXml, comentarios, revisiones, rsid
  ni plantilla adjunta) y 16 textos de la fuente verificados como ausentes.
- `scripts/verificar-datos-personales.ts`: 157 reportes analizados, 27 nombres de referencia y ningún
  archivo versionable con coincidencias.
- Prueba documental (`npm run prueba:documental`): 3 DOCX generados con fotos reales en local:

| Ejemplo                           | Fotos | Tamaño  | Páginas (Word) |
| --------------------------------- | ----- | ------- | -------------- |
| Cuadrícula con verificación       | 20    | 1,5 MB  | 9              |
| Antes/durante/después (PSV)       | 36    | 2,2 MB  | 9              |
| Volumen alto (postes R, Cerritos) | 74    | 27,7 MB | 16             |

- Apertura en Microsoft Word real (automatización COM, sin reparación): los 3 abren, el índice se
  actualiza y se exportan a PDF. LibreOffice no está instalado, así que la conversión con
  `SOFFICE_PATH` informa «no disponible», como exige la spec. La comparación visual con los originales
  se hizo con los PDF de Word; las capturas quedan en `storage/prueba-documental/comparacion/`
  (ignorado por Git, porque los originales contienen nombres reales).

## Hallazgos propios corregidos durante la fase

- Con `w:dirty="true"` en el campo del índice, Word se bloqueaba al actualizarlo; se retiró.
- Los saltos de línea dentro de un párrafo justificado estiraban los espacios; ahora cada renglón es
  un párrafo.
- Las tablas de herramientas y verificación repiten la fila de encabezado al cruzar de página.

## Punto de control pendiente (tarea 2.7)

La plantilla v1 queda abierta hasta que el usuario revise los 3 DOCX. Decisiones a confirmar:

- Antes/durante/después: fila de 3 fotos de 5,2 × 6,5 cm (diseño D5) o disposición 2 + 1 con fotos de
  unos 8 cm, como el original de Virtual.
- Título en mayúsculas (como el ejemplo de la spec) o respetando mayúsculas y minúsculas capturadas.
- Índice: Word pregunta al abrir si actualiza los campos para llenar los números de página; la
  alternativa es no preguntar y actualizarlo a mano (F9).
- Foto única en la última fila de la cuadrícula: alineada a la izquierda, como el original, o centrada.
