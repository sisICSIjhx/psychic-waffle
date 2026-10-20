# Spec Delta

## Purpose

Producir el reporte FOR-ICSI-RMT-01 como Word editable, fiel al formato que hoy entrega ICSI, a partir
de los datos capturados y sin rearmar el documento a mano.

## ADDED Requirements

### Requirement: Plantilla FOR-ICSI-RMT-01

El sistema SHALL generar el DOCX a partir de una plantilla Word versionada. La plantilla conserva el
encabezado «REPORTE DE ACTIVIDADES CON EVIDENCIA FOTOGRÁFICA», el código FOR-ICSI-RMT-01, los logotipos,
los estilos, el pie con número de página y la distribución de los reportes actuales. Cada documento SHALL
registrar la versión de plantilla que usó.

#### Scenario: Versión de plantilla registrada

- **WHEN** se genera un reporte
- **THEN** el registro del reporte indica qué versión de la plantilla produjo el documento

### Requirement: Contenido y orden de secciones

El documento SHALL contener, en este orden:

- título;
- tabla de encabezado (Usuario, No. Contrato/OC, Sitio, TAG, Periodicidad, Fecha y Tipo de Mantenimiento);
- tabla de firmas (Elaboró, Aprobó y Recibió);
- 1. Objetivo;
- 2. Alcance, con sus subapartados;
- 3. Herramientas y equipo;
- 4. Documentos de verificación, cuando aplique;
- Conclusiones y/o recomendaciones, numerada a continuación.

#### Scenario: Reporte sin tabla de verificación

- **WHEN** el reporte tiene desactivada la tabla de verificación
- **THEN** el documento omite esa sección y numera «4. CONCLUSIONES Y/O RECOMENDACIONES»

#### Scenario: Reporte con tabla de verificación

- **WHEN** el reporte, de cualquier cliente, tiene activada la tabla de verificación
- **THEN** el documento incluye «4. DOCUMENTOS DE VERIFICACIÓN» y numera «5. CONCLUSIONES Y/O RECOMENDACIONES»

### Requirement: Fotografías en el documento

Las fotografías SHALL insertarse en tablas nativas de Word bajo su alcance, con su pie «Ilustración n.m»,
en una cuadrícula de dos columnas o en la disposición antes/durante/después. SHALL conservar su
proporción, con tamaño uniforme, sin desbordar el ancho de página. Un alcance sin fotos no SHALL dejar
celdas vacías.

#### Scenario: Foto vertical y horizontal en la misma fila

- **WHEN** una fila contiene una foto vertical y otra horizontal
- **THEN** ambas conservan su proporción y caben dentro de la celda

#### Scenario: Muchas fotografías

- **WHEN** un reporte contiene 130 fotografías
- **THEN** el documento se genera completo y su tamaño de archivo se mantiene dentro del límite configurado gracias a las versiones optimizadas

### Requirement: Documento editable

El DOCX generado SHALL contener texto y tablas nativos de Word, editables en Microsoft Word, sin campos
de plantilla sin resolver.

#### Scenario: Marcadores resueltos

- **WHEN** se abre el DOCX generado
- **THEN** no aparece ningún marcador de plantilla ni texto de relleno

### Requirement: Nombre y descarga del archivo

El archivo SHALL nombrarse con el número de partida, la actividad abreviada, el TAG si existe y el
periodo, sin caracteres no válidos para Windows. Solo SHALL descargarse desde el reporte correspondiente.

#### Scenario: Nombre con TAG

- **WHEN** se genera el reporte de la partida 13, TAG PI-0001, de junio de 2026
- **THEN** el archivo se nombra de forma similar a «P13_MANOMETROS_PI-0001_2026-06.docx»

### Requirement: Prueba de conversión a PDF

El sistema SHALL poder convertir un DOCX generado a PDF cuando el conversor esté instalado. La
conversión SHALL tratarse como prueba de fidelidad y no como emisión oficial. Si el conversor no está
disponible, SHALL informarlo sin afectar la generación del DOCX.

#### Scenario: Conversor ausente

- **WHEN** se solicita el PDF y el conversor no está instalado
- **THEN** el sistema indica que la conversión no está disponible y el DOCX sigue disponible para descargar
