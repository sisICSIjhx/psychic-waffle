# Proposal

## Why

Además del reporte FOR-ICSI-RMT-01 en Word, ICSI entrega con cada estimación de Proagroindustrias
(contrato `PRO-AGRO-PRV-016-2026`, sitios EM-30184 y EM-30185) un «reporte fotográfico» horizontal en
Excel: un libro con una hoja por partida ejecutada. Hoy se arma a mano copiando hojas y pegando
fotos. El usuario pidió (2026-11-22) tener ese formato como plantilla de la plataforma, sin
conectarlo todavía a ningún botón, y que se descargue en Excel, porque hasta ahora todo supone Word.

## What Changes

**Comportamiento actual comprobado (2026-11-22, rama `feat/kpi-seguimiento-centros`):**

- La plataforma solo genera un tipo de documento: el DOCX FOR-ICSI-RMT-01
  (`src/lib/server/documentos/generar.ts`, plantilla `src/lib/server/plantillas/FOR-ICSI-RMT-01.v2.docx`).
- El formato de descarga está supuesto, no declarado: `nombreArchivo` termina en `.docx`
  (`src/lib/dominio/documento.ts`), la ruta `src/routes/reportes/[id]/documento/+server.ts` responde
  siempre con el tipo MIME de Word y `ServicioCaptura.generarDocumento` (`src/lib/server/captura.ts`)
  llama solo a `generarDocx`.
- El libro que se arma a mano (en `insumos/`, sin versionar) tiene una «HOJA MAESTRA» (fecha de entrega
  de la estimación, periodo estimado y número de estimación) y 56 hojas iguales, 33 visibles: datos
  del contrato y de la estimación con «PÁGINA n DE m», partida y descripción con las fechas de
  ejecución, hasta 8 fotos en cuadrícula de 4 × 2 con un círculo numerado sobre cada una, la lista
  numerada de actividades y las firmas «CONTRATISTA» y «AUTORIZA». Carta horizontal, ajustada a una
  página. Pesa 50 MB por las fotos y por 1 934 cuadros de texto vacíos en cada hoja.
- La base no guarda el número de estimación, la fecha de entrega ni el periodo estimado.

**Comportamiento propuesto:**

- Plantilla `REPORTE-FOTOGRAFICO.v1.xlsx` junto a la del DOCX: la hoja maestra y una hoja modelo con
  los estilos, anchos, altos, celdas combinadas, página horizontal y área de impresión del original,
  los rótulos fijos y el logotipo de ICSI. Sin datos: ni contrato, ni importes, ni actividades, ni
  firmantes, ni fotos, ni el logotipo del cliente.
- Generador que recibe los datos de la estimación, del contrato, las firmas y una lista de reportes
  (partida, actividad, sitio, días de ejecución, actividades y fotos) y produce el libro `.xlsx`: una
  hoja por reporte, hojas de continuación cuando hay más de 8 fotos, fotos ajustadas a su caja sin
  deformarse, círculo con el número de la actividad que ilustra cada foto y paginación «n DE m».
- Un adaptador convierte un reporte de la plataforma en esa entrada: sus alcances son las actividades
  numeradas y cada foto lleva el número de su alcance.
- Cada tipo de documento declara su formato de descarga (Word o Excel) en un registro del dominio; el
  resultado del generador lleva su tipo, su nombre de archivo `.xlsx` y su tipo MIME.
- **Sin conectar a la interfaz**: no hay botón, menú, enlace ni ruta nueva, y la ruta
  `/reportes/[id]/documento` no cambia. El generador se ejerce desde las pruebas y desde un script de
  muestra con datos ficticios.

Fuera de alcance: dónde se capturan y guardan los datos de la estimación, de dónde sale el logotipo
del cliente, la pantalla para elegir los reportes de una estimación, el registro del libro generado,
la conversión a PDF y cualquier cambio de base de datos. Este cambio no reserva migración.

## Capabilities

### New Capabilities

- `reporte-fotografico-excel`: libro de Excel del reporte fotográfico de estimación (plantilla sin
  datos, hoja maestra, una hoja por reporte con continuación, fotos, actividades numeradas, firmas y
  paginación) y declaración del formato de descarga de cada tipo de documento.

### Modified Capabilities

Ninguna en `openspec/specs/`. La generación del DOCX no cambia.

## Impact

- Código nuevo: `src/lib/dominio/reporte-fotografico.ts` y `src/lib/dominio/tipos-documento.ts`
  (reglas puras), `src/lib/server/documentos/fotografico.ts` (generador) y
  `src/lib/server/documentos/libro-xlsx.ts` (escritura mínima de libros sobre JSZip).
- Plantilla: `src/lib/server/plantillas/REPORTE-FOTOGRAFICO.v1.xlsx`; `plantillas/vigente.ts` la
  empaqueta con `?inline` y `vite.config.ts` incluye `**/*.xlsx` como recurso.
- Scripts: `scripts/construir-plantilla-fotografico.ts` (`npm run plantilla:fotografico`, solo en
  local, lee el libro de `insumos/`) y `scripts/prueba-fotografico.ts` (`npm run prueba:fotografico`).
- Pruebas: `src/lib/dominio/reporte-fotografico.spec.ts` y
  `src/lib/server/documentos/fotografico.spec.ts` (proyecto `server`, datos ficticios).
- Sin dependencias nuevas (`jszip` y `sharp` ya están), sin migración y sin cambios en rutas ni
  componentes. Microsoft Excel solo se usa en desarrollo para comprobar una muestra.
