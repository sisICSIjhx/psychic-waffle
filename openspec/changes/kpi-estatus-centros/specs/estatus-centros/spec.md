## ADDED Requirements

### Requirement: Significado de los conceptos de la plantilla

El sistema MUST permitir que un concepto de plantilla declare un indicador, que esté marcado «por
definir» y, si es un documento, la carpeta a la que pertenece, y MUST validar que el indicador
corresponda al bloque, tipo y nivel del concepto y no se repita en la plantilla.

#### Scenario: Indicador incompatible

- **WHEN** se guarda una plantilla con el indicador «monto del contrato» en un concepto de tipo casilla
- **THEN** el servidor rechaza el guardado con un mensaje que nombra el concepto

#### Scenario: Concepto por definir

- **WHEN** un concepto está marcado «por definir»
- **THEN** la pantalla de captura lo muestra con la insignia «Por definir» y permite llenarlo
- **AND** no cuenta en los indicadores ni en la lista de lo que falta

#### Scenario: Plantillas existentes

- **WHEN** se aplica la migración sobre plantillas ya cargadas
- **THEN** los conceptos de monto del contrato, monto cobrado, periodicidad y estaciones de medición reciben su indicador por la etiqueta
- **AND** ningún dato capturado se pierde

### Requirement: Documentos por partida

El sistema MUST admitir conceptos que se capturan una sola vez por partida en el mes, y MUST
entregar cada actividad con la partida a la que pertenece.

#### Scenario: Reporte de una partida con varias ejecuciones

- **WHEN** una partida tiene tres actividades en el mes y se marca su reporte
- **THEN** el reporte queda marcado una vez para la partida
- **AND** cuenta como un documento esperado y un documento hecho

#### Scenario: Valor dirigido a otra actividad

- **WHEN** se envía un valor de un concepto por partida a una actividad que no es la primera de su grupo
- **THEN** el servidor lo rechaza

#### Scenario: Reportes ya marcados por actividad

- **WHEN** la migración convierte el reporte a nivel partida y alguna actividad de la partida lo tenía marcado
- **THEN** el reporte de la partida queda marcado

### Requirement: Partidas escritas a mano

El sistema MUST permitir escribir una partida que el programa no trae, con el número de veces que
se ejecuta en el mes, en los centros con actividades mensuales y en los que tienen programa anual.

#### Scenario: Partida fuera del programa anual

- **WHEN** quien edita agrega una partida con dos ejecuciones en un centro con programa anual
- **THEN** aparecen dos actividades de esa partida, señaladas como fuera del programa
- **AND** cuentan en las actividades programadas y ejecutadas del mes

#### Scenario: Centro sin actividades

- **WHEN** la plantilla del centro no programa actividades
- **THEN** el servidor rechaza la partida escrita a mano

### Requirement: Atenciones de emergencia

El sistema MUST registrar las atenciones de emergencia de un centro con fecha obligatoria y con
horario, personal que asistió y descripción opcionales.

#### Scenario: Atención con horario y personal

- **WHEN** se registra una atención con fecha, hora de inicio, hora de fin y dos personas activas
- **THEN** la atención aparece en el mes con su horario y los nombres de quienes asistieron

#### Scenario: Solo la fecha

- **WHEN** se registra una atención solo con la fecha
- **THEN** se guarda

#### Scenario: Fecha de otro mes

- **WHEN** la fecha no pertenece al mes seleccionado
- **THEN** el servidor la rechaza

### Requirement: Entrega y recepción de carpetas

El sistema MUST llevar cada carpeta por los estados pendiente, en preparación, entregada, recibida
con comentarios y recibida correctamente, exigiendo en cada uno sus datos.

#### Scenario: Entregar

- **WHEN** se marca una carpeta como entregada sin indicar quién la entrega o la fecha
- **THEN** el servidor rechaza el guardado y dice qué falta

#### Scenario: Recibida con comentarios

- **WHEN** se registra la recepción con comentarios, con quién recibe, la fecha y los comentarios
- **THEN** la carpeta queda como recibida con comentarios y sigue contando como pendiente de cierre

#### Scenario: Recibida correctamente

- **WHEN** se registra la recepción correcta sin enlace ni archivo de acuse
- **THEN** el servidor rechaza el guardado
- **AND** con el acuse, la carpeta queda cerrada y el acuse se puede descargar dentro del alcance del centro

### Requirement: Adicionales

El sistema MUST permitir registrar en cualquier centro de costo los adicionales del contrato con su
orden de compra, descripción, fecha de solicitud, periodo de ejecución, monto pactado y monto
cobrado, visibles solo con la capacidad de ver el contrato.

#### Scenario: Alta por administración

- **WHEN** un líder administrativo registra un adicional con orden de compra y monto pactado
- **THEN** el adicional aparece en el centro sin monto cobrado

#### Scenario: Cobro por contabilidad

- **WHEN** contabilidad registra el monto cobrado de un adicional
- **THEN** se guarda sin modificar sus demás datos
- **AND** contabilidad no puede cambiar el monto pactado ni eliminar el adicional

#### Scenario: Rol sin acceso

- **WHEN** un reporteador consulta el centro
- **THEN** la respuesta no contiene adicionales ni montos

### Requirement: Monto cobrado del contrato

El sistema MUST mostrar como monto cobrado del contrato la suma de la cobranza mensual registrada
por contabilidad, sin captura manual.

#### Scenario: Cobranza registrada

- **WHEN** contabilidad registra montos cobrados en dos meses
- **THEN** el contrato muestra la suma como monto cobrado, de solo lectura

### Requirement: Estatus del centro de costo

El sistema MUST calcular para cada centro de costo visible y un mes de corte los indicadores de
ejecución, estaciones de medición, documentos, carpetas, cobranza y contrato que le apliquen, un
estatus general y la lista de lo que falta, y MUST entregar los datos financieros solo a quien
puede ver el contrato.

#### Scenario: Centro al corriente

- **WHEN** todas las actividades del mes están ejecutadas, sus documentos marcados y sus carpetas recibidas correctamente
- **THEN** el estatus del centro es «Al corriente» y la lista de lo que falta está vacía

#### Scenario: Documentos faltantes

- **WHEN** hay actividades ejecutadas sin su reporte
- **THEN** el estatus es «Con pendientes» y la lista dice cuántos reportes faltan

#### Scenario: Carta de finalización faltante

- **WHEN** el contrato del centro terminó y no tiene carta de finalización, y consulta un rol que ve el contrato
- **THEN** el estatus es «Atrasado» y la lista incluye la carta

#### Scenario: Rol sin acceso al contrato

- **WHEN** un líder operativo consulta el concentrado
- **THEN** recibe los indicadores operativos de sus centros
- **AND** la respuesta no contiene montos, cobranza ni datos del contrato

#### Scenario: Centro ajeno

- **WHEN** alguien consulta el estatus de un centro fuera de su alcance
- **THEN** ese centro no aparece en la respuesta

### Requirement: Uso en teléfono por personal operativo

Las pantallas de seguimiento, contrato y cobranza y el concentrado MUST poder usarse en un teléfono
de 360 px de ancho sin desplazamiento horizontal de la página, con objetivos táctiles de al menos
44 px y dentro del sistema de diseño vigente.

#### Scenario: Marcar una actividad en teléfono

- **WHEN** una persona con permiso abre el seguimiento de su centro en un teléfono
- **THEN** ve el estatus del centro, sus partidas como tarjetas y puede marcar una actividad y sus documentos con un toque por casilla

#### Scenario: Solo consulta

- **WHEN** quien consulta no puede editar
- **THEN** ve los mismos datos sin controles de edición
