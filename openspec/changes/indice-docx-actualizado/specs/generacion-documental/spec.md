# Spec Delta

## Purpose

Producir el reporte FOR-ICSI-RMT-01 como Word editable, fiel al formato que hoy entrega ICSI, a partir
de los datos capturados y sin rearmar el documento a mano.

## ADDED Requirements

### Requirement: Índice resuelto al abrir el documento

El DOCX generado SHALL abrir en Microsoft Word sin pedir que se actualicen los campos y con el índice
ya resuelto, como los reportes originales. Ningún campo SHALL quedar marcado para actualizarse al
abrir. Amplía «Plantilla FOR-ICSI-RMT-01» y «Documento editable» del cambio
`reportes-mantenimiento-for-icsi-rmt-01` y sustituye la decisión de la fase 2 de entregar el índice con
aviso de actualización.

#### Scenario: Abrir el documento descargado

- **WHEN** el usuario descarga el DOCX de un reporte y lo abre en Microsoft Word
- **THEN** Word no muestra el aviso de campos que pueden hacer referencia a otros archivos y el índice muestra cada título con su número de página

#### Scenario: Paquete sin actualización pendiente

- **WHEN** se inspecciona el paquete del DOCX generado
- **THEN** sus ajustes no piden actualizar los campos al abrir y ningún campo del documento, de los encabezados ni de los pies está marcado como pendiente de actualizar

### Requirement: Entradas del índice con número de página y enlace

Cada título de nivel 1 y cada alcance SHALL tener una entrada en el índice con la numeración del
cuerpo («1. OBJETIVO», «2.1» seguido del título del alcance, conclusiones con su número), relleno de
puntos y la página en que empieza el título. Cada entrada SHALL llevar a su título, y el índice SHALL
seguir siendo una tabla de contenido que Word puede actualizar.

#### Scenario: Reporte con verificación

- **WHEN** se genera un reporte con 3 alcances y tabla de verificación
- **THEN** el índice lista en orden «1. OBJETIVO», «2. ALCANCE», «2.1», «2.2» y «2.3» con el título de cada alcance, «3. HERRAMIENTAS Y EQUIPO», «4. DOCUMENTOS DE VERIFICACIÓN» y «5. CONCLUSIONES Y/O RECOMENDACIONES», cada entrada con su número de página

#### Scenario: Reporte sin verificación

- **WHEN** el reporte no incluye la tabla de verificación
- **THEN** el índice no tiene «DOCUMENTOS DE VERIFICACIÓN» y termina en «4. CONCLUSIONES Y/O RECOMENDACIONES» con su página

#### Scenario: Ir al título desde el índice

- **WHEN** el usuario sigue en Word la entrada «2.3» del índice
- **THEN** Word lleva al título del tercer alcance en el cuerpo

#### Scenario: Ninguna entrada sin destino

- **WHEN** se inspecciona el DOCX generado
- **THEN** cada título del cuerpo tiene un marcador propio, y cada hipervínculo y cada referencia de página del índice apuntan a un marcador que existe

#### Scenario: Actualizar desde Word

- **WHEN** el usuario elige «Actualizar tabla» sobre el índice
- **THEN** Word lo reconoce como tabla de contenido y lo regenera con las mismas entradas y enlaces

### Requirement: Precisión de las páginas del índice

Las páginas del índice SHALL coincidir con las que asigna Microsoft Word 365 en al menos el 99 % de las
entradas del conjunto de verificación de reportes sintéticos, en al menos el 98,5 % de las entradas del
subconjunto que no se usó para calibrar y en todas las entradas de los 3 documentos de prueba. Una diferencia residual SHALL ser de una sola página y SHALL corregirse con
«Actualizar tabla» sin dañar el documento.

#### Scenario: Documentos de prueba

- **WHEN** se generan los 3 documentos de prueba (cuadrícula con verificación, antes/durante/después y volumen alto) y se actualiza su índice en Word
- **THEN** el índice guardado es idéntico al que deja la actualización

#### Scenario: Conjunto de verificación

- **WHEN** se comparan las páginas calculadas con las que Word asigna a los títulos de los reportes sintéticos del conjunto de verificación
- **THEN** coinciden al menos el 99 % de las entradas del conjunto y el 98,5 % de las del subconjunto que no se usó para calibrar

#### Scenario: Diferencia residual

- **WHEN** un caso límite queda con una entrada distinta de la página real
- **THEN** la diferencia es de una página y «Actualizar tabla» la corrige

### Requirement: Título en el borde inferior de la página

Cuando un título, con lo que debe acompañarlo en la misma página, termine tan cerca del margen
inferior que la paginación de Word sea dudosa (dentro de la tolerancia de la versión de plantilla, por
encima o por debajo del margen), el documento SHALL empezar ese título en la página siguiente y el
índice SHALL indicar esa página. Fuera de esa franja SHALL conservarse el flujo natural del documento.

#### Scenario: Título en la franja dudosa

- **WHEN** el título «4. CONCLUSIONES Y/O RECOMENDACIONES» y su primer renglón terminarían 0,2 pt por encima del margen inferior de la página 15
- **THEN** el título empieza en la página 16 y su entrada del índice indica 16

#### Scenario: Título que apenas no cabe

- **WHEN** el título de un alcance y su primer renglón excederían el margen inferior por 0,2 pt
- **THEN** el título empieza en la página siguiente aunque Word pudiera ajustarlo en la anterior, y el índice indica esa página

#### Scenario: Título lejos del borde

- **WHEN** un título y lo que lo acompaña caben con más de un renglón libre al final de la página
- **THEN** el título no lleva salto forzado y queda en esa página

### Requirement: Páginas de la portada y del índice

Los números del índice SHALL contar las páginas que ocupan la portada y el propio índice. Si los datos
de la portada (muchos TAG, nombres largos o varios días de ejecución) o las entradas del índice ocupan
una página más, los números del cuerpo SHALL desplazarse en consecuencia.

#### Scenario: Portada e índice de una página

- **WHEN** la portada y el índice ocupan una página cada uno
- **THEN** el cuerpo empieza en la página 3 y la entrada «1. OBJETIVO» indica la página 3

#### Scenario: Portada de dos páginas

- **WHEN** la lista de TAG del encabezado hace que la portada ocupe dos páginas
- **THEN** el índice empieza en la página 3, la entrada «1. OBJETIVO» indica la página 4 y Word coincide

#### Scenario: Índice de dos páginas

- **WHEN** un reporte tiene 14 alcances con títulos de varios renglones y el índice ocupa dos páginas
- **THEN** el cuerpo empieza en la página siguiente al índice y los números del índice lo reflejan

### Requirement: Plantilla v2 y documentos anteriores

Los documentos SHALL generarse con la versión de plantilla FOR-ICSI-RMT-01.v2 y registrar esa versión.
Un documento generado antes con la v1 no SHALL reutilizarse: la siguiente descarga SHALL generar y
registrar uno con la v2, sin cambiar el contenido, la versión ni el estado del reporte. Amplía
«Plantilla FOR-ICSI-RMT-01» del cambio `reportes-mantenimiento-for-icsi-rmt-01`.

#### Scenario: Documento v1 guardado

- **WHEN** un reporte emitido tiene registrado un DOCX de su versión generado con la v1 y el usuario lo descarga
- **THEN** el sistema genera un DOCX con la v2, lo registra y lo entrega, y el reporte sigue emitido con la misma versión

#### Scenario: Segunda descarga

- **WHEN** el usuario vuelve a descargar ese reporte sin cambios
- **THEN** el sistema reutiliza el DOCX v2 ya registrado

### Requirement: Formato del documento conservado

La plantilla v2 SHALL conservar el formato de la v1: portada, encabezado, firmas, estilos, fuentes,
márgenes, tablas, fotos y pies. Solo SHALL cambiar el contenido del índice y, cuando corresponda, el
salto forzado de un título. El paquete SHALL seguir incrustando solo fuentes de licencia libre.

#### Scenario: Comparar las plantillas

- **WHEN** se comparan las partes de las plantillas v1 y v2
- **THEN** solo difieren los ajustes (sin actualización de campos al abrir) y el control de contenido del índice

#### Scenario: Mismo reporte con ambas versiones

- **WHEN** se genera el mismo reporte con la v1 y con la v2
- **THEN** el cuerpo tiene el mismo contenido y formato, y solo se mueven los títulos que llevan salto forzado

#### Scenario: Fuentes del paquete

- **WHEN** se inspecciona el paquete de un DOCX v2
- **THEN** no contiene archivos de fuentes propietarias, igual que la v1

### Requirement: Cálculo sin programas externos

La generación del DOCX con el índice resuelto SHALL funcionar en el servidor sin Microsoft Word,
LibreOffice ni servicios externos, y sin leer las fuentes instaladas en el equipo. Microsoft Word SHALL
usarse solo en desarrollo, para verificar la precisión.

#### Scenario: Servidor sin Word ni LibreOffice

- **WHEN** se descarga un DOCX en un servidor sin Word ni LibreOffice
- **THEN** el documento se genera con el índice resuelto y sus números de página

#### Scenario: Equipo sin las fuentes del documento

- **WHEN** el servidor no tiene instaladas Arial ni Aptos
- **THEN** las páginas calculadas son las mismas que en un equipo que sí las tiene
