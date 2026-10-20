# Spec Delta

## Purpose

Mantener en un solo lugar los clientes, contratos, sitios, partidas con sus alcances, equipos y
firmantes que alimentan la planeación y el prellenado de cada reporte de mantenimiento.

## ADDED Requirements

### Requirement: Registro de clientes, contratos y sitios

El sistema SHALL registrar clientes (razón social), contratos u órdenes de compra (número, cliente,
periodo de vigencia) y sitios (clave EM/ERM y nombre). Un sitio SHALL pertenecer a uno o más contratos y
su clave SHALL ser única.

#### Scenario: Sitio duplicado por escritura distinta

- **WHEN** se intenta registrar «EM-30185 AREA VI» y ya existe «EM-30185 ÁREA VI»
- **THEN** el sistema rechaza el registro e indica el sitio existente con la misma clave

#### Scenario: Contrato vigente

- **WHEN** se consulta un contrato cuyo periodo incluye la fecha actual
- **THEN** el sistema lo presenta como vigente y disponible para la captura

### Requirement: Catálogo de partidas por contrato y sitio

Cada partida SHALL tener número, actividad, descripción, distribución (Producción o Mantenimiento),
periodicidad, cantidad anual, entrega, requisitos de ODM/PT/AST, responsable de materiales (ICSI o
cliente) y reportes homologados. El número de partida SHALL ser único dentro de un contrato y sitio.

#### Scenario: Misma actividad con distinto número en otro sitio

- **WHEN** «Manómetros» es la partida 13 en la ERM 30184 y la partida 08 en la ERM 30185
- **THEN** el sistema conserva ambas numeraciones sin conflicto

#### Scenario: Número de partida repetido

- **WHEN** se registra una partida con un número ya usado en el mismo contrato y sitio
- **THEN** el sistema rechaza el registro

### Requirement: Alcances de partida ordenados

Cada partida SHALL tener una lista ordenada de alcances. Cada elemento SHALL clasificarse como alcance
ejecutable, nota o referencia normativa. Solo los alcances ejecutables SHALL incluirse en la captura y
en la tabla de verificación.

#### Scenario: Nota excluida de la verificación

- **WHEN** una partida incluye «Nota: No incluye materiales, estos deberán ser suministrados por el cliente»
- **THEN** la nota se muestra como información de la partida y no aparece en la tabla de verificación

### Requirement: Plantilla de contenido por partida

Cada partida SHALL poder almacenar un objetivo, una lista de herramientas y equipo (cantidad y
descripción), un texto base de conclusiones, la disposición de las fotografías (cuadrícula o
antes/durante/después) y si propone la tabla de verificación. Estos datos SHALL usarse para prellenar
los reportes nuevos.

#### Scenario: Partida derivada de reportes

- **WHEN** una partida de Proagro o Virtual se registra a partir de sus reportes y no de un catálogo oficial
- **THEN** la partida queda marcada «por confirmar» hasta que el usuario la confirme o la reemplace con el catálogo

#### Scenario: Partida sin plantilla de contenido

- **WHEN** una partida no tiene objetivo ni herramientas registrados
- **THEN** el sistema permite capturar el reporte e indica qué campos faltan antes de generarlo

### Requirement: Equipos e instrumentos por sitio

El sistema SHALL registrar equipos con TAG único por sitio y, cuando aplique, tipo, marca, modelo,
rango y número de serie. Una partida SHALL poder asociarse a los equipos que atiende.

#### Scenario: Reporte por instrumento

- **WHEN** la partida de manómetros tiene asociados PI-0001, PI-1001 y PI-1002
- **THEN** la captura ofrece elegir uno o varios de esos TAG para el reporte

### Requirement: Firmantes por contrato

El sistema SHALL registrar por contrato los firmantes de las funciones «Elaboró», «Aprobó» y «Recibió»,
con nombre, cargo y empresa, y su periodo de vigencia. Los datos de los firmantes SHALL tratarse como
datos personales: no se incluyen en semillas versionadas ni en documentación.

#### Scenario: Cambio de firmante

- **WHEN** un firmante deja de estar vigente y se registra otro
- **THEN** los reportes nuevos usan el firmante vigente y los ya emitidos conservan el que tenían

### Requirement: Importación del catálogo desde Excel

El sistema SHALL importar partidas, alcances y programa anual desde un archivo con la estructura de
«CATALOGO DE ALCANCES.xlsx». Antes de guardar, SHALL mostrar un resumen de lo que creará, actualizará u
omitirá. Repetir la importación de un mismo archivo SHALL ser idempotente.

#### Scenario: Importación inicial

- **WHEN** se importa el catálogo de Cerritos con 55 partidas
- **THEN** el sistema muestra 55 partidas por crear con sus alcances y, al confirmar, las registra

#### Scenario: Reimportación sin cambios

- **WHEN** se importa otra vez el mismo archivo
- **THEN** el sistema informa que no hay cambios y no duplica registros

#### Scenario: Archivo con estructura distinta

- **WHEN** el archivo no tiene las columnas esperadas
- **THEN** el sistema rechaza la importación e indica la hoja y la columna faltantes, sin guardar cambios parciales
