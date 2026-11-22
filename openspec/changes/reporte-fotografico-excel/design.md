# Design

## Context

Motivación y alcance en `proposal.md`; requisitos en `specs/reporte-fotografico-excel/spec.md`. Estado
de partida comprobado el 2026-11-22 en `feat/kpi-seguimiento-centros`:

- Todo documento es Word: `generarDocx` (`src/lib/server/documentos/generar.ts`) llena la plantilla
  `FOR-ICSI-RMT-01.v2.docx` con `docx-templates`; `ServicioCaptura.generarDocumento`
  (`src/lib/server/captura.ts`) lo guarda y registra en `documentos_generados`, y
  `src/routes/reportes/[id]/documento/+server.ts` lo sirve con el tipo MIME de Word.
- `src/lib/server/importacion/xlsx.ts` lee libros `.xlsx` con JSZip (cadenas compartidas, texto en
  línea, combinadas), con un tope de 10 MB desde la interfaz. No hay código que escriba Excel.
- El libro original (en `insumos/`, 50 MB) se abrió con JSZip leyendo solo `xl/workbook.xml`,
  `xl/styles.xml`, las hojas y los dibujos. Medidas que fijan el formato:
  - Hoja de reporte: rango `C1:P52`, área de impresión `$B$1:$Q$53`, carta horizontal, `fitToPage`,
    vista de saltos de página. Fuente predeterminada Arial 10.
  - Filas 1 a 4: logotipo del cliente (C a E), nombre del cliente (`G1:K4`) y logotipo de ICSI (M a
    P). Filas 5 a 12: contrato, orden de compra, descripción (`F7:J10`), periodos, importe,
    estimación, contratista y página. Fila 13: título. Filas 15 a 18: partida (`C16:C18`) y
    descripción (`D16:P18`). Filas 19 a 37: zona de fotos. Filas 38 a 43: actividades. Filas 45 a
    50: firmas.
  - `M5`, `M9` y `M11` son fórmulas a `'HOJA MAESTRA'!E3`, `E6` y `E9`.
  - Dibujo de cada hoja: hasta 8 fotos de 3 960 000 × 2 970 000 EMU (11 × 8.25 cm) en 4 × 2, un
    círculo blanco con número sobre la esquina inferior derecha de cada foto, dos logotipos y 1 934
    cuadros de texto vacíos (2.3 MB de XML por hoja), que son basura acumulada.
  - Las hojas ocultas (23 de 56) no cuentan en «n DE m».
- Entorno: Microsoft Excel 365 está instalado en el equipo de desarrollo; LibreOffice no
  (`SOFFICE_PATH` vacío). El servidor no tiene ninguno de los dos.

## Goals / Non-Goals

**Goals:**

- Una plantilla limpia y versionable que conserve la disposición del original.
- Un generador puro sobre JSZip, sin procesos externos, que reciba datos y devuelva el libro.
- Dejar declarado el formato de descarga de cada tipo de documento.
- Pruebas con datos ficticios y una muestra comprobada en Excel.

**Non-Goals:**

- Conectar el generador a la interfaz, a `ServicioCaptura` o a una ruta.
- Guardar estimaciones en la base, capturar sus datos o elegir los reportes que entran.
- Convertir a PDF, imprimir o registrar el libro en `documentos_generados`.
- Una biblioteca general de hojas de cálculo.

## Decisions

### D1. Clasificación: nivel 3, con OpenSpec

Es un tipo de documento nuevo y el primer formato de descarga distinto de Word: fija un contrato de
datos y una plantilla que otras partes usarán. No toca la base ni la interfaz, por lo que el riesgo en
ejecución es bajo, pero las decisiones abiertas (D10) conviene conservarlas como requisitos.

### D2. JSZip y XML directo, sin biblioteca de Excel

El generador clona la hoja modelo y sustituye celdas por dirección. Se descartó agregar `exceljs` o
`xlsx`: reescriben estilos y dibujos al guardar (se pierde la fidelidad que se pide conservar), pesan
varios MB y el proyecto ya edita OOXML como texto para el DOCX. `src/lib/server/documentos/libro-xlsx.ts`
reúne lo mínimo: celdas con texto en línea, fórmulas con resultado guardado, combinadas, alto de fila,
geometría de la hoja, anclas de imágenes y formas, y las partes fijas del paquete.

### D3. Plantilla construida desde el original y auditada

`scripts/construir-plantilla-fotografico.ts` (solo en local) toma la hoja maestra y una hoja de
reporte del libro de `insumos/` y escribe `src/lib/server/plantillas/REPORTE-FOTOGRAFICO.v1.xlsx`:

- Conserva `xl/styles.xml` y el tema completos, los anchos, los altos, las combinadas del encabezado y
  de las firmas, la configuración de página y las tres fórmulas a la hoja maestra.
- Deja como texto solo 17 rótulos fijos, comprobados por celda; si la hoja no es del formato, falla.
- Vacía todas las demás celdas (conservan su estilo) y quita las cadenas compartidas, la cadena de
  cálculo, los ajustes de impresora, los identificadores del libro y los nombres de código.
- Uniforma la zona de fotos y de actividades (filas 19 a 43): bordes laterales del original y un
  estilo único por zona. En el original esas filas cambian de hoja a hoja (combinadas sobrantes y
  estilos sueltos); las combinadas de esa zona las decide el generador. Se agrega un estilo: el de la
  última fila de actividades sin su borde inferior.
- El dibujo queda con una sola imagen, el logotipo de ICSI, con el recorte que Excel aplicaba ya hecho
  en la imagen y su proporción real. El logotipo del cliente no se versiona.
- Antes de escribir, audita el paquete con `auditarPaquete` contra todas las cadenas del libro
  original que no sean rótulos y contra el nombre de su autor. Las entradas del paquete llevan fecha
  fija para que reconstruir dé los mismos bytes.

### D4. Texto en línea y fórmulas con resultado guardado

Las celdas de texto se escriben como `inlineStr`, sin tabla de cadenas compartidas: cada hoja es
autónoma y Excel las convierte al guardar. `M5`, `M9` y `M11` conservan su fórmula a la hoja maestra
con el resultado ya escrito, y el libro pide recálculo al abrir: corregir la hoja maestra actualiza
todas las hojas, y un lector que no recalcula (el de `importacion/xlsx.ts`, un visor) muestra el valor.

### D5. Contrato de celdas en el generador

`src/lib/server/documentos/fotografico.ts` declara qué celda recibe cada dato (`CELDAS`, `FIRMAS`,
`MAESTRA`), la zona de fotos y la de actividades. `ponerCelda` exige que la celda exista en la hoja
modelo: una plantilla que no corresponde falla con «La plantilla no tiene la celda …» en vez de
entregar un libro incompleto. La versión de la plantilla es `REPORTE-FOTOGRAFICO.v1`.

### D6. Fotos: caja de 11 × 8.25 cm, cuadrícula centrada y ancla a una celda

- Hasta 8 fotos por hoja, como el original: 1 foto en 1 × 1, 2 en 2 × 1, 3 y 4 en 2 × 2, 5 y 6 en
  3 × 2, 7 y 8 en 4 × 2 (`cuadriculaFotos`). La cuadrícula se centra en la zona y la última fila se
  centra si no se llena. El reparto en hojas es una regla pura (`repartirHojas`).
- Cada foto se ajusta a su caja con `ajustarACaja` (la misma regla del DOCX) y se ancla a una sola
  celda con su tamaño exacto. El ancho real de una columna depende de la escala de pantalla del
  equipo (7 px por carácter a 100 %, 7.2 a 125 %, medido en el original); con ancla a una celda ese
  error mueve la foto unos píxeles pero no la deforma, que es lo que pasaría con ancla a dos celdas.
- Tratamiento de imagen: `prepararImagen` (orientación EXIF, giro del editor, fondo blanco, JPEG), el
  mismo del DOCX, con perfiles propios de 1024, 800 y 640 px. La foto se imprime a unos 4.5 cm de
  ancho, así que 1600 px no aportan y un libro de 33 hojas pasaría de 50 MB. Si la versión optimizada
  ya mide 1024 px o menos y no lleva giro, se usa tal cual. Límite del libro: 50 MB, como el DOCX.
- El círculo va sobre la esquina inferior derecha de la foto, asomando un poco, con el número de la
  actividad; sin actividad en la lista, la foto va sin círculo.

### D7. Actividades: una o dos columnas, texto ajustado y fila que crece

Seis renglones (filas 38 a 43). Hasta seis actividades, una columna combinada de D a O; de siete a
doce, dos columnas (D a J y K a O) repartidas por mitades. El estilo ajusta el texto, y el alto de la
fila se calcula con las métricas de Arial ya versionadas (`paginacion.ts`), porque Excel no ajusta
solo el alto de una celda combinada. La hoja sigue en una página porque está ajustada a página. Con
más de doce actividades la lista se parte en tramos de doce, cada uno en sus propias hojas con las
fotos de sus actividades (el original hace lo mismo con la partida 15).

### D8. Entrada del generador y adaptador desde el reporte

La entrada (`LibroFotografico`) separa lo que es de la estimación, del contrato, las dos firmas, el
logotipo del cliente (opcional) y la lista de reportes. No lee la base: quien lo conecte arma esa
entrada. `reporteFotograficoDe` convierte el `ReporteDocumento` que ya construye `ServicioCaptura`
para el DOCX: partida, actividad, sitio, días, alcances como actividades y fotos en el mismo orden de
aparición del DOCX, cada una con el número de su alcance. Así el libro usa las fotos ya optimizadas y
giradas que el servicio prepara.

### D9. Formato de descarga declarado por tipo de documento

`src/lib/dominio/tipos-documento.ts` registra los tipos (`reporte-mantenimiento`,
`reporte-fotografico`) con su formato, y los formatos (`docx`, `xlsx`) con extensión, tipo MIME y
nombre. El generador nuevo ya lo usa para su nombre de archivo y su tipo MIME. **No se cambia todavía**
el DOCX ni su ruta. Cuando se conecte:

- La ruta de descarga toma `Content-Type` de `formatoDeDocumento(tipo)` en vez del texto fijo.
- `documentos_generados` necesita distinguir el tipo (hoy basta `version_plantilla`, que ya es
  distinta) y el libro es de una estimación, no de un reporte: requiere su propia entidad (D10) y una
  migración.
- El PDF, si se quiere, sale de convertir el formato propio de cada tipo; hoy solo existe la prueba
  DOCX → PDF con LibreOffice (`pdf.ts`).

### D10. Decisiones que quedan al usuario

1. **Datos de la estimación** (número, fecha de entrega, periodo estimado): no existen en la base. El
   generador los recibe como entrada. Opciones: capturarlos en una ventana al generar el libro (sin
   base), o crear la entidad «estimación» por contrato y centro de costo, ligada a `contrato-cobranza`
   (que ya tiene contrato, órdenes de compra y cobranza por mes) y con los reportes que cubre.
2. **Importe contratado, orden de compra y descripción de la obra**: `contrato-cobranza` guarda
   conceptos por plantilla; falta confirmar de qué concepto sale cada uno, o si se capturan aparte.
3. **Fotos por hoja**: se dejó en 8 (4 × 2) con continuación en «13 (2)». El original tiene dos hojas
   con 14 y 15 fotos más chicas; no se reproduce.
4. **Lista de actividades**: sale de los alcances del reporte (título de cada alcance). Alternativa:
   capturar una lista aparte para este formato.
5. **Firmas**: «CONTRATISTA» y «AUTORIZA» se reciben como entrada. Falta decidir si salen de los
   firmantes del reporte («aprobó» y «recibió») o de dos firmantes propios del contrato.
6. **Logotipo del cliente**: la base no guarda logotipos; hoy es una entrada opcional.
7. **Qué reportes entran en un libro**: el original mezcla reportes de varios meses en una estimación
   parcial; hace falta la regla (por periodo estimado, por selección manual o por estado «emitido»).

## Risks / Trade-offs

- [El XML se edita como texto y un cambio manual de la plantilla puede romper el contrato de celdas] →
  la plantilla solo se regenera con el script, el generador falla si falta una celda y una prueba lo
  cubre.
- [La posición de las fotos varía unos píxeles con la escala de pantalla] → ancla a una celda con
  tamaño exacto; comprobado en Excel a 125 %.
- [El alto calculado de una actividad larga puede quedar corto o sobrado] → margen del 6 % en el
  ancho útil; la hoja se ajusta a una página.
- [Excel o un visor podrían no aceptar el paquete] → comprobado con Excel 365 (abre sin reparar); con
  LibreOffice y con visores web no se comprobó.
- [Un libro con cientos de fotos puede acercarse al límite] → perfiles de 1024 a 640 px y rechazo con
  mensaje si excede.

## Migration Plan

Sin migración ni despliegue: código y plantilla nuevos que nadie llama desde la aplicación. Para
retirarlo basta borrar los archivos nuevos y las dos líneas de `vigente.ts` y `vite.config.ts`.

## Open Questions

Las de D10. Ninguna bloquea la plantilla ni el generador; todas condicionan cómo se conecta.
