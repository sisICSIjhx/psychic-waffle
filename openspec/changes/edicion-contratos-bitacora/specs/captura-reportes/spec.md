# Spec Delta

## Purpose

Capturar el reporte de actividades con evidencia fotográfica FOR-ICSI-RMT-01 a partir del catálogo,
de modo que el técnico solo registre lo que cambia en cada ejecución: fotos, estados, observaciones y
conclusiones.

## ADDED Requirements

### Requirement: Aviso de datos del contrato cambiados

Amplía «Prellenado desde el catálogo» (`reportes-mantenimiento-for-icsi-rmt-01`) y «Datos del catálogo
como resumen editable» (`ux-editor-inicio-captura`). Cada reporte SHALL conservar la copia de los datos
del contrato que recibió: usuario, contrato, sitio y firmas vigentes el primer día del mes del periodo.
Si esa copia difiere de los datos vigentes, el editor de un borrador SHALL avisarlo, nombrar los datos
que cambiaron y ofrecer «Actualizar datos del contrato».

#### Scenario: Borrador no actualizado

- **WHEN** se corrigió el número del contrato con la casilla de borradores desmarcada y se abre uno de sus borradores
- **THEN** el editor muestra «Los datos del contrato cambiaron: No. contrato / OC» con «Actualizar datos del contrato»

#### Scenario: Firma editada a mano sin cambio en el contrato

- **WHEN** el usuario cambió a mano la firma de Aprobó del borrador y el contrato no cambió
- **THEN** el editor no muestra el aviso

#### Scenario: Reporte en revisión

- **WHEN** un reporte en revisión tiene una copia distinta de los datos vigentes del contrato
- **THEN** el editor lo indica sin la acción y sugiere regresarlo a borrador para actualizarlo

#### Scenario: Reporte emitido

- **WHEN** el reporte está emitido o sustituido
- **THEN** el editor no muestra el aviso ni la acción y el documento conserva los datos que tenía

### Requirement: Actualizar los datos del contrato en el borrador

«Actualizar datos del contrato» SHALL llevar al borrador solo los datos del contrato que cambiaron
desde su copia y conservar los demás, incluidas las firmas modificadas a mano que no cambiaron en el
contrato. SHALL usar la versión que conoce el editor y rechazarse como versión desactualizada si el
borrador cambió en otra pestaña. Una revisión creada de un emitido SHALL recibir la copia del original.

#### Scenario: Actualizar el número

- **WHEN** el usuario elige «Actualizar datos del contrato» en un borrador con el número anterior
- **THEN** el encabezado muestra el número vigente, el aviso desaparece y el DOCX descargado después lo incluye

#### Scenario: Revisión creada después de una corrección

- **WHEN** se crea la revisión 1 de un reporte emitido antes de corregir el nombre de su sitio
- **THEN** la revisión empieza con el nombre anterior y el aviso, y al actualizarla toma el nombre corregido

#### Scenario: Firma escrita a mano conservada

- **WHEN** el contrato solo cambió de número y el borrador tiene a mano la firma de Elaboró
- **THEN** la actualización cambia el número y conserva esa firma

#### Scenario: Versión desactualizada

- **WHEN** el borrador se guardó en otra pestaña después de abrirlo y el usuario elige «Actualizar datos del contrato»
- **THEN** el editor indica que hay una versión más reciente y no aplica la actualización
