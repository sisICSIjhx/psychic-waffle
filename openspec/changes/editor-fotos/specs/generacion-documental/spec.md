# Spec Delta

## Purpose

Producir el reporte FOR-ICSI-RMT-01 como Word editable, fiel al formato que hoy entrega ICSI, a partir
de los datos capturados y sin rearmar el documento a mano.

## ADDED Requirements

### Requirement: Fotografías giradas en el documento

El documento SHALL insertar cada foto con el giro guardado; a 90° o 270°, con el ancho y el alto
intercambiados, conservando su proporción y dentro de la caja uniforme de «Fotografías en el
documento». El giro SHALL conservarse en cualquier perfil de reducción. Una foto sin giro SHALL
insertarse igual que antes de este cambio.

#### Scenario: Foto horizontal girada 90°

- **WHEN** una foto de 640 × 480 px tiene un giro de 90°
- **THEN** el documento la inserta vertical, de 4,5 × 6 cm, dentro de la caja de 8 × 6 cm

#### Scenario: Giro de 180°

- **WHEN** una foto de 640 × 480 px tiene un giro de 180°
- **THEN** el documento la inserta invertida y con el tamaño de la foto sin girar (8 × 6 cm)

#### Scenario: Reporte sin fotos giradas

- **WHEN** ninguna foto del reporte tiene giro
- **THEN** las imágenes del documento son las mismas que se insertaban antes de este cambio

#### Scenario: Documento que necesita un perfil más ligero

- **WHEN** el documento excede el límite de tamaño y las fotos se reducen con un perfil más ligero
- **THEN** las fotos giradas conservan su giro y sus medidas intercambiadas

### Requirement: Documento emitido sin cambios por su revisión

Girar, reemplazar o quitar una foto en una revisión no SHALL alterar los archivos de la foto ni el
documento del reporte emitido que sustituye, aunque ambos compartan los archivos.

#### Scenario: Giro en la revisión

- **WHEN** en la revisión se gira 90° una foto que comparte archivos con el reporte emitido
- **THEN** el DOCX del reporte emitido sigue mostrando esa foto sin girar y los archivos de la foto no cambian

#### Scenario: Reemplazo en la revisión

- **WHEN** en la revisión se reemplaza esa foto y vence el plazo para deshacer
- **THEN** el reporte emitido conserva la foto anterior y su documento no cambia
