## ADDED Requirements

### Requirement: Acceso por rol al contrato y la cobranza

El servidor MUST entregar el contrato, sus montos, las órdenes de compra, la carta de finalización
y la cobranza solo a administrador, líder administrativo, mesa directiva y contabilidad, y el enlace
del programa anual solo a administrador, líderes y mesa directiva, siempre con sesión iniciada y
dentro de los centros de costo de quien consulta.

#### Scenario: Sin sesión o sin rol autorizado

- **WHEN** alguien sin sesión, o un reporteador, abre la pantalla de contrato y cobranza
- **THEN** el servidor responde 403 y no consulta ningún dato

#### Scenario: Rol con acceso parcial

- **WHEN** un líder operativo abre su centro de costo
- **THEN** recibe el enlace del programa anual
- **AND** la respuesta no contiene contrato, montos, órdenes, carta ni cobranza

#### Scenario: Centro de costo ajeno

- **WHEN** un líder administrativo consulta o guarda en un centro que no tiene asignado
- **THEN** el servidor responde 404

### Requirement: Datos del contrato y órdenes de compra

El sistema MUST permitir a administrador y líder administrativo registrar los datos del contrato y
las órdenes de compra de un centro de costo según los conceptos de su plantilla, validando cada
valor contra el tipo del concepto.

#### Scenario: Contrato según la plantilla

- **WHEN** se guardan el número, el enlace y el monto de un centro cuya plantilla los define
- **THEN** quedan registrados para ese centro y un campo vacío elimina su dato

#### Scenario: Orden de compra adicional

- **WHEN** se agrega una orden marcada como adicional con fecha de solicitud y monto
- **THEN** aparece en la lista de órdenes del centro y puede editarse o quitarse

#### Scenario: Valor no válido

- **WHEN** se envía un monto negativo, un texto en un monto o un enlace que no es de SharePoint
- **THEN** el servidor rechaza el cambio y conserva lo guardado

### Requirement: Enlaces de SharePoint

El sistema MUST guardar el contrato, el programa anual y la carta de finalización como enlaces HTTPS
de SharePoint, sin admitir archivos.

#### Scenario: Enlace del programa anual

- **WHEN** un editor guarda el enlace del programa anual de un centro
- **THEN** quienes pueden verlo lo abren desde la pantalla del centro

### Requirement: Carta de finalización con aviso

El sistema MUST registrar la fecha y el enlace de la carta de finalización y avisar cuando el
contrato del centro ya terminó y la carta falta.

#### Scenario: Contrato terminado sin carta

- **WHEN** la vigencia del contrato del centro terminó antes de hoy y no hay fecha de carta
- **THEN** la pantalla muestra un aviso de carta faltante

#### Scenario: Contrato vigente

- **WHEN** el contrato sigue vigente o la carta ya tiene fecha
- **THEN** no se muestra el aviso

### Requirement: Cobranza mensual

El sistema MUST permitir a contabilidad y al administrador registrar por centro y mes la
estimación, la prefactura, la factura, si se cobró y el monto cobrado, y mostrarlo en consulta a
los demás roles con acceso al contrato.

#### Scenario: Captura de contabilidad

- **WHEN** contabilidad marca la estimación de un mes y captura el monto cobrado
- **THEN** el mes queda guardado y el total cobrado del año lo incluye

#### Scenario: Rol de consulta

- **WHEN** mesa directiva o un líder administrativo intenta guardar la cobranza
- **THEN** el servidor rechaza la petición con 403
