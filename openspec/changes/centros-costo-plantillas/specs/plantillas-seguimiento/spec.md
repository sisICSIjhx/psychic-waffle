# Spec Delta

## Purpose

Definir por configuración, no por código, qué información de seguimiento lleva cada centro de
costo: si tiene contrato, de dónde salen sus actividades y qué conceptos registra en cada bloque.

## ADDED Requirements

### Requirement: Plantilla de seguimiento

Una plantilla SHALL tener nombre único, descripción opcional, modo de contrato (obligatorio,
opcional o sin contrato), origen de las actividades (programa anual, captura por mes o ninguno) y
conceptos ordenados. Cada concepto SHALL tener bloque (contrato, órdenes de compra, programa,
documentos o carpetas), etiqueta, tipo y nivel. Un bloque SHALL aplicar a un centro de costo cuando
su plantilla tiene algún concepto de ese bloque.

#### Scenario: Plantilla con documentos por actividad

- **WHEN** se guarda una plantilla con los conceptos de documentos «ODT», «AST» y «PT» de tipo
  casilla
- **THEN** los tres quedan en el bloque de documentos con nivel actividad y en ese orden

### Requirement: Combinaciones válidas

El nivel SHALL quedar fijado por el bloque (contrato → contrato, órdenes de compra → orden de
compra, documentos → actividad, carpetas → periodo), salvo en el bloque programa, que SHALL admitir
periodo o actividad. Las carpetas SHALL ser de tipo carpeta y solo ellas. La etiqueta SHALL ser
única dentro de su bloque sin distinguir mayúsculas ni acentos.

#### Scenario: Nivel no válido

- **WHEN** se envía un concepto de documentos con nivel periodo
- **THEN** se rechaza con «El nivel no corresponde al bloque»

#### Scenario: Etiqueta repetida

- **WHEN** una plantilla trae «ODT» y «odt» en documentos
- **THEN** se rechaza con «Concepto repetido en el bloque»

### Requirement: Conceptos estables al editar

Al guardar una plantilla, los conceptos que ya existían SHALL conservar su identificador; los que se
quitan SHALL borrarse y los nuevos SHALL añadirse.

#### Scenario: Cambiar una etiqueta

- **WHEN** se renombra «Hoja de campo» a «Hojas de campo» y se guarda
- **THEN** el concepto conserva su identificador

### Requirement: Compartir, duplicar y eliminar

Varios centros de costo SHALL poder usar la misma plantilla. Quien edita el catálogo SHALL poder
duplicar una plantilla con otro nombre (con todos sus conceptos) y eliminar una que ningún centro
de costo use. Eliminar una plantilla en uso MUST fallar con un mensaje que diga cuántos centros la
usan. Consultar, crear y editar plantillas SHALL ser solo de quien edita el catálogo.

#### Scenario: Duplicar

- **WHEN** se duplica la plantilla «Mensual con ODM» como «Mensual con ODM (Salamanca)»
- **THEN** la copia tiene los mismos datos y conceptos con identificadores nuevos, y ningún centro
  de costo cambia de plantilla

#### Scenario: Eliminar en uso

- **WHEN** se intenta eliminar una plantilla que usan 3 centros de costo
- **THEN** se rechaza con «La usan 3 centros de costo»
