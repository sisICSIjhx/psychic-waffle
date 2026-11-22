# Spec Delta

## Purpose

Producir el «reporte fotográfico» de una estimación como libro de Excel horizontal, fiel al que hoy se
arma a mano, a partir de los reportes capturados en la plataforma y de los datos de la estimación.

## ADDED Requirements

### Requirement: Plantilla del reporte fotográfico sin datos

La plataforma SHALL tener una plantilla de Excel del reporte fotográfico que conserve la disposición
del formato original: hoja maestra, hoja de reporte con sus rótulos, estilos, anchos de columna, altos
de fila, celdas combinadas del encabezado y de las firmas, página carta horizontal ajustada a una
página y área de impresión. La plantilla SHALL NOT contener datos de un contrato real: ni nombres de
firmantes, ni importes, ni actividades, ni fotos, ni el logotipo del cliente.

#### Scenario: Contenido de la plantilla

- **WHEN** se inspecciona la plantilla versionada
- **THEN** tiene la hoja maestra y una hoja modelo, sus únicos textos son los rótulos fijos del formato y su única imagen es el logotipo de ICSI

#### Scenario: Auditoría antes de versionar

- **WHEN** se reconstruye la plantilla a partir del libro original
- **THEN** el proceso falla si algún texto de ese libro que no sea un rótulo fijo, o el nombre de su autor, queda en la plantilla

### Requirement: Libro con hoja maestra y una hoja por reporte

El generador SHALL producir un libro `.xlsx` con la hoja «HOJA MAESTRA» y una hoja por cada reporte
recibido, en el orden recibido. Cada hoja de reporte SHALL llevar los datos del contrato, el número de
partida y la descripción con la actividad, el sitio y las fechas de ejecución.

#### Scenario: Estimación con dos reportes

- **WHEN** se genera el libro de una estimación con los reportes de las partidas 13 y 4
- **THEN** el libro tiene las hojas «HOJA MAESTRA», «13» y «4», y cada hoja de reporte muestra el cliente, el contrato, la orden de compra, la descripción de la obra o servicio, el periodo de contrato, el importe contratado, el contratista, su partida y su descripción

#### Scenario: Fechas de ejecución en la descripción

- **WHEN** un reporte se ejecutó el 3 y el 7 de septiembre de 2026
- **THEN** su descripción termina con «FECHA DE EJECUCIÓN: 03/09/2026 Y 07/09/2026», y un tramo de varios días se escribe «DEL 15/09/2026 AL 20/09/2026»

#### Scenario: Importe sin capturar

- **WHEN** el contrato no tiene importe
- **THEN** la celda del importe contratado queda en blanco y el libro se genera

### Requirement: Datos de la estimación tomados de la hoja maestra

La hoja maestra SHALL llevar la fecha de entrega de la estimación, el periodo estimado y el número de
estimación. Cada hoja de reporte SHALL tomar esos tres datos de la hoja maestra y mostrarlos aunque el
programa que abra el libro no recalcule.

#### Scenario: Datos de la estimación en cada hoja

- **WHEN** se genera el libro de la estimación «07 (PARCIAL)» con entrega el 2 de octubre de 2026 y periodo del 1 al 30 de septiembre de 2026
- **THEN** la hoja maestra y cada hoja de reporte muestran ese número, esa fecha y «01 SEPTIEMBRE 2026 AL 30 SEPTIEMBRE 2026»

#### Scenario: Corrección en la hoja maestra

- **WHEN** el usuario cambia el número de estimación en la hoja maestra del libro descargado
- **THEN** todas las hojas de reporte muestran el número nuevo

### Requirement: Disposición conservada en cada hoja

Cada hoja de reporte SHALL conservar la disposición de la plantilla: las mismas celdas combinadas del
encabezado y de las firmas, los mismos anchos de columna, la página horizontal ajustada a una página y
el área de impresión. Los estilos del libro SHALL ser los de la plantilla.

#### Scenario: Hojas iguales a la plantilla

- **WHEN** se compara cada hoja de reporte generada con la hoja modelo
- **THEN** tiene sus anchos de columna, su configuración de página y todas sus celdas combinadas

#### Scenario: Apertura en Excel

- **WHEN** se abre el libro generado en Microsoft Excel
- **THEN** Excel lo abre sin ofrecer repararlo y cada hoja de reporte ocupa una página horizontal

### Requirement: Fotos en la zona de fotos

Las fotos de cada reporte SHALL colocarse en la zona de fotos de su hoja, en una cuadrícula centrada de
hasta 4 columnas por 2 filas, cada una ajustada a una caja de 11 × 8.25 cm sin deformarse y con el giro
elegido en el editor. Una hoja SHALL llevar como máximo 8 fotos; las restantes SHALL pasar a hojas de
continuación del mismo reporte, que repiten sus datos y se nombran con la partida y un consecutivo.
Un reporte sin fotos SHALL tener su hoja.

#### Scenario: Reporte con nueve fotos

- **WHEN** el reporte de la partida 13 tiene 9 fotos
- **THEN** el libro tiene las hojas «13» con 8 fotos y «13 (2)» con 1, ambas con la misma descripción y la misma lista de actividades

#### Scenario: Foto vertical

- **WHEN** una foto es más alta que ancha
- **THEN** ocupa el alto de su caja y conserva su proporción

#### Scenario: Reporte sin fotos

- **WHEN** un reporte no tiene fotos
- **THEN** su hoja se genera con la zona de fotos vacía

### Requirement: Actividades numeradas y número en cada foto

Cada hoja SHALL listar las actividades realizadas numeradas («1.\_ …») debajo de las fotos: en una
columna hasta seis actividades y en dos columnas hasta doce. Cada foto SHALL llevar un círculo con el
número de la actividad que ilustra. Un texto que no cabe en un renglón SHALL verse completo. Si un
reporte tiene más de doce actividades, la lista SHALL continuar en otra hoja del mismo reporte con las
fotos de esas actividades.

#### Scenario: Reporte de la plataforma

- **WHEN** el libro se arma con un reporte capturado en la plataforma
- **THEN** sus alcances aparecen como actividades numeradas en su orden y cada foto lleva el número de su alcance

#### Scenario: Siete actividades

- **WHEN** un reporte tiene 7 actividades
- **THEN** la hoja las muestra en dos columnas

#### Scenario: Actividad con texto largo

- **WHEN** el texto de una actividad no cabe en un renglón
- **THEN** su fila crece para mostrarlo completo y la hoja sigue ocupando una página

#### Scenario: Foto sin actividad

- **WHEN** una foto no corresponde a ninguna actividad de la lista
- **THEN** se coloca sin círculo

### Requirement: Paginación y firmas

Cada hoja de reporte SHALL mostrar «n DE m», donde m es el total de hojas de reporte del libro
(incluidas las de continuación) y n su posición. Cada hoja SHALL llevar las firmas «CONTRATISTA» y
«AUTORIZA» con nombre, cargo y empresa.

#### Scenario: Paginación con continuación

- **WHEN** el libro tiene las hojas «13», «13 (2)» y «4»
- **THEN** muestran «1 DE 3», «2 DE 3» y «3 DE 3»

#### Scenario: Firmas en todas las hojas

- **WHEN** se genera el libro con las dos firmas
- **THEN** todas las hojas de reporte muestran el nombre, el cargo y la empresa de quien firma por el contratista y de quien autoriza

### Requirement: Formato de descarga declarado por tipo de documento

Cada tipo de documento SHALL declarar su formato de descarga. El reporte FOR-ICSI-RMT-01 SHALL
declarar Word y el reporte fotográfico SHALL declarar Excel. El resultado del generador del reporte
fotográfico SHALL incluir su tipo de documento, un nombre de archivo con extensión `.xlsx` formado solo
por caracteres válidos en Windows y el tipo MIME de Excel.

#### Scenario: Nombre y tipo del libro

- **WHEN** se genera el libro del contrato «CONTRATO-PRUEBA-001», estimación «07 (PARCIAL)»
- **THEN** el resultado se llama «REPORTE-FOTOGRAFICO_CONTRATO-PRUEBA-001_EST-07-PARCIAL.xlsx» y su tipo MIME es el de un libro de Excel

#### Scenario: Formato de cada tipo

- **WHEN** se consulta el formato de descarga de cada tipo de documento
- **THEN** el reporte de mantenimiento responde Word (`.docx`) y el reporte fotográfico responde Excel (`.xlsx`)

### Requirement: Generador sin conectar a la interfaz

Mientras no se decida dónde se capturan los datos de la estimación, el reporte fotográfico SHALL NOT
aparecer en la interfaz: ningún botón, menú, enlace ni ruta lo ofrece, y la descarga del DOCX de un
reporte no cambia.

#### Scenario: Descarga del reporte de mantenimiento

- **WHEN** el usuario descarga el documento de un reporte desde el editor
- **THEN** recibe el DOCX FOR-ICSI-RMT-01 como antes

### Requirement: Errores y límites del libro

El generador SHALL rechazar con un mensaje claro un libro sin reportes, un reporte sin días de
ejecución, una fecha inválida, una plantilla que no corresponde al formato y un libro que excede el
límite de tamaño después de reducir las fotos. Los textos SHALL escribirse sin caracteres de control y
sin alterar el XML del libro.

#### Scenario: Libro sin reportes

- **WHEN** se pide un libro sin ningún reporte
- **THEN** el generador lo rechaza y no produce archivo

#### Scenario: Libro demasiado grande

- **WHEN** las fotos, ya reducidas al perfil más ligero, hacen que el libro exceda el límite
- **THEN** el generador lo rechaza indicando el peso y el límite

#### Scenario: Textos con caracteres especiales

- **WHEN** un texto contiene «&», «<», comillas o caracteres de control
- **THEN** el libro se abre y muestra el texto sin los caracteres de control

### Requirement: Datos personales fuera de lo versionable

La plantilla, las pruebas, las especificaciones y el historial SHALL NOT contener nombres de firmantes,
importes ni fotos de los insumos. Las pruebas SHALL usar datos ficticios.

#### Scenario: Verificación de datos

- **WHEN** se ejecuta `npm run verificar:datos`
- **THEN** ningún archivo versionable, incluida la plantilla `.xlsx`, contiene nombres de los insumos
