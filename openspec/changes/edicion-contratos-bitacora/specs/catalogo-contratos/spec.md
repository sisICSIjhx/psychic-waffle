# Spec Delta

## Purpose

Mantener en un solo lugar los clientes, contratos, sitios, partidas con sus alcances, equipos y
firmantes que alimentan la planeación y el prellenado de cada reporte de mantenimiento.

## ADDED Requirements

### Requirement: Corrección de los datos del contrato

Amplía «Registro de clientes, contratos y sitios» (`reportes-mantenimiento-for-icsi-rmt-01`). El
sistema SHALL permitir corregir el número, la descripción y la vigencia de un contrato registrado. El
cliente no SHALL cambiar: una renovación o una orden de compra nueva se registra como contrato nuevo.
El número SHALL seguir siendo único por cliente, y una edición sin diferencias SHALL rechazarse sin
registrar nada.

#### Scenario: Corregir un número provisional

- **WHEN** se corrige el número «VIRTUAL-POR-CONFIRMAR» del contrato de Virtual, que no tiene reportes, y se confirma con su motivo
- **THEN** el catálogo, la planeación y la captura muestran el número nuevo y la bitácora registra el número anterior y el nuevo

#### Scenario: Número repetido

- **WHEN** el número corregido ya pertenece a otro contrato del mismo cliente
- **THEN** el sistema rechaza el cambio junto al campo e indica el contrato existente, sin abrir la confirmación

#### Scenario: Sin cambios

- **WHEN** se guarda el formulario del contrato sin modificar ningún dato
- **THEN** el sistema indica «No hay cambios que guardar» y no registra nada en la bitácora

#### Scenario: Cliente fijo

- **WHEN** se edita un contrato
- **THEN** el formulario muestra el cliente sin poder cambiarlo e indica que una renovación se registra como contrato nuevo

### Requirement: Vigencia corregida sin dejar datos fuera

La vigencia corregida de un contrato SHALL abarcar todos los meses que ya tienen reportes en cualquier
estado, los periodos de sus programas anuales y los meses programados o con realizados registrados. Un
mes está dentro de la vigencia si alguno de sus días cae en ella. Si algo queda fuera, el sistema SHALL
rechazar el cambio e indicar qué queda fuera y en qué meses.

#### Scenario: Programa fuera de la vigencia

- **WHEN** se intenta cambiar la vigencia de Proagro a 2026-05-01..2027-04-30 y sus programas de EM-30184 y EM-30185 abarcan de marzo de 2026 a febrero de 2027
- **THEN** el sistema rechaza el cambio e indica los programas de EM-30184 y EM-30185 con marzo y abril de 2026 fuera de la vigencia

#### Scenario: Ampliar la vigencia

- **WHEN** se amplía el fin de la vigencia de un contrato y se confirma con su motivo
- **THEN** el contrato sigue vigente y la captura ofrece también los meses agregados

### Requirement: Corrección de la clave o el nombre del sitio

Amplía «Registro de clientes, contratos y sitios». Desde un contrato, el sistema SHALL permitir
corregir la clave o el nombre de un sitio asociado a él. El sitio es el mismo para todos los contratos
que lo usan: la corrección SHALL aplicarse a todos y la confirmación SHALL nombrarlos. La clave
corregida SHALL seguir siendo única con la misma regla del registro de sitios.

#### Scenario: Corregir el nombre

- **WHEN** el sitio EM-30185 quedó registrado con un error de escritura, «ÁREA IV» en lugar de «ÁREA VI», y se corrige el nombre con su motivo
- **THEN** el catálogo, la captura y la planeación muestran el nombre corregido y los reportes emitidos conservan el que tenían

#### Scenario: Sitio compartido

- **WHEN** el sitio que se corrige también está asociado a otro contrato
- **THEN** la confirmación indica el número de ese contrato antes de guardar

#### Scenario: Clave de otro sitio

- **WHEN** la clave corregida coincide con la de otro sitio registrado
- **THEN** el sistema rechaza el cambio e indica el sitio existente

### Requirement: Asociar y quitar sitios del contrato

El sistema SHALL permitir asociar a un contrato un sitio nuevo o ya registrado, y quitar un sitio del
contrato solo si en ese contrato y sitio no hay partidas, programas ni reportes. Quitar un sitio SHALL
pedir confirmación con motivo y no SHALL borrar el sitio del catálogo. No SHALL ofrecerse mover las
partidas, programas o reportes de un sitio a otro.

#### Scenario: Quitar un sitio asociado por error

- **WHEN** se quita del contrato un sitio sin partidas, programas ni reportes en él y se confirma con su motivo
- **THEN** el sitio deja de aparecer en el contrato, sigue registrado en el catálogo y la bitácora registra la quita

#### Scenario: Sitio con datos

- **WHEN** el sitio tiene partidas, programas o reportes en el contrato
- **THEN** «Quitar del contrato» aparece deshabilitado con cuántas partidas, programas y reportes tiene, y el servidor también rechaza la petición

### Requirement: Corrección de los datos de un firmante

Sustituye la edición directa de un firmante de «Firmantes por contrato»
(`reportes-mantenimiento-for-icsi-rmt-01`). «Corregir datos» SHALL modificar el nombre, el cargo, la
empresa o las fechas de vigencia del mismo registro y SHALL reservarse para errores de escritura de la
misma persona. Las fechas corregidas no SHALL traslaparse con otro firmante de la misma función del
contrato.

#### Scenario: Error de escritura en el cargo

- **WHEN** se corrige el cargo del firmante de Aprobó y se confirma con su motivo
- **THEN** los reportes nuevos proponen el cargo corregido, los emitidos conservan el anterior y la bitácora registra el cargo antes y después

#### Scenario: Fechas traslapadas

- **WHEN** la fecha de inicio corregida cae dentro de la vigencia de otro firmante de la misma función
- **THEN** el sistema rechaza la corrección e indica el traslape

### Requirement: Cambio de firmante desde una fecha

«Cambiar firmante desde…» SHALL cerrar la vigencia del firmante actual de una función el día anterior
a la fecha elegida y registrar a la persona nueva desde esa fecha hasta el fin que tenía el anterior, en
una sola operación. La fecha SHALL ser posterior al inicio de la vigencia del actual y no posterior a su
fin. Cada reporte SHALL seguir tomando el firmante vigente el primer día del mes de su periodo.

#### Scenario: Cambio desde el inicio de un mes

- **WHEN** el firmante de Recibió cambia desde 2026-11-01
- **THEN** el anterior queda vigente hasta 2026-10-31, los reportes nuevos de noviembre en adelante proponen al nuevo y los de octubre y anteriores al anterior

#### Scenario: Fecha a mitad de mes

- **WHEN** el cambio es desde 2026-11-15
- **THEN** la confirmación indica que los reportes desde diciembre de 2026 usarán al nuevo firmante

#### Scenario: Fecha fuera de la vigencia del actual

- **WHEN** la fecha elegida es igual o anterior al inicio de la vigencia del firmante actual
- **THEN** el sistema rechaza el cambio e indica la primera fecha permitida

### Requirement: Confirmación del cambio con su impacto

Antes de guardar una edición del contrato, de un sitio o de un firmante, o de quitar un sitio, el
sistema SHALL calcular el cambio sin aplicarlo y mostrar un diálogo con cada dato antes → después y el
impacto: borradores que se pueden actualizar, reportes en revisión y reportes emitidos o sustituidos
que conservan el dato, y otros contratos del sitio. «Cancelar» o Esc SHALL cerrar sin guardar.

#### Scenario: Resumen del cambio de número

- **WHEN** se corrige el número de un contrato con 2 borradores y 1 emitido
- **THEN** el diálogo muestra «Número: anterior → nuevo», «2 borradores» con la casilla «Actualizar también los borradores» marcada y «1 emitido conserva el número anterior»

#### Scenario: Cancelar

- **WHEN** el usuario pulsa Esc en el diálogo de confirmación
- **THEN** no se guarda nada, no se escribe en la bitácora y el foco vuelve al botón que abrió el diálogo

#### Scenario: Error detectado antes del diálogo

- **WHEN** el cálculo detecta un número repetido o una vigencia que deja datos fuera
- **THEN** no se abre el diálogo y el error se muestra junto al campo

### Requirement: Motivo obligatorio del cambio

Toda edición o quita SHALL llevar un motivo de 10 a 500 caracteres, sin contar espacios al inicio ni al
final. «Confirmar» SHALL estar deshabilitado mientras el motivo no sea válido, y el servidor SHALL
rechazar la edición sin motivo válido aunque la petición no venga del diálogo. Las altas de contrato,
sitio, asociación de sitio o firmante no SHALL exigir motivo.

#### Scenario: Motivo corto

- **WHEN** el motivo escrito es «error»
- **THEN** «Confirmar» sigue deshabilitado y el campo indica que faltan al menos 5 caracteres

#### Scenario: Petición sin motivo

- **WHEN** llega al servidor una edición del contrato sin motivo
- **THEN** el servidor la rechaza sin cambiar datos ni escribir en la bitácora

#### Scenario: Alta sin motivo

- **WHEN** se registra el primer firmante de Elaboró de un contrato
- **THEN** se guarda sin pedir motivo y la bitácora lo registra como alta

### Requirement: Actualización opcional de los borradores

Amplía «Firmantes por contrato», donde los emitidos conservan el firmante que tenían. Con «Actualizar
también los borradores», marcada por omisión, el sistema SHALL llevar el dato nuevo a los borradores
afectados, salvo a los campos modificados a mano en cada reporte, y su documento descargado después
SHALL reflejarlo. Los reportes en revisión, emitidos y sustituidos no SHALL cambiar.

#### Scenario: Borradores actualizados

- **WHEN** se corrige el número de un contrato con la casilla marcada y el contrato tiene 2 borradores y 1 emitido
- **THEN** ambos borradores muestran el número nuevo y su DOCX lo incluye, y el emitido y su DOCX conservan el anterior

#### Scenario: Casilla desmarcada

- **WHEN** se confirma la corrección con la casilla desmarcada
- **THEN** los borradores conservan el número anterior y el editor muestra en ellos el aviso de datos del contrato cambiados

#### Scenario: Firma modificada a mano

- **WHEN** un borrador tiene a mano una firma de Aprobó distinta a la del contrato y el firmante de Aprobó cambia con la casilla marcada
- **THEN** ese borrador conserva su firma y el editor muestra el aviso de datos del contrato cambiados

#### Scenario: Reporte en revisión

- **WHEN** un reporte del contrato está en revisión al confirmar el cambio
- **THEN** conserva el dato anterior y la confirmación indica regresarlo a borrador para actualizarlo

#### Scenario: Editor abierto en otra pestaña

- **WHEN** un borrador actualizado está abierto en otra pestaña con su versión anterior
- **THEN** el siguiente guardado de esa pestaña se rechaza como versión desactualizada, sin sobrescribir el dato nuevo

### Requirement: Cambios simultáneos en el catálogo

Cada edición del contrato, de un sitio o de un firmante SHALL indicar la versión del dato que el
usuario vio. Si el dato cambió después, el sistema SHALL rechazar la edición sin aplicar nada y pedir
que se recargue la pantalla.

#### Scenario: Dos pestañas con el mismo contrato

- **WHEN** dos personas abren el mismo contrato y la primera corrige su número
- **THEN** la confirmación de la segunda se rechaza con «El contrato cambió desde que lo abrió; recargue para ver los datos actuales»

### Requirement: Bitácora de cambios del catálogo

El sistema SHALL registrar en una bitácora de solo agregar, en la misma operación que el cambio, cada
alta, edición, cambio de firmante, asociación y quita del contrato, sus sitios y sus firmantes: entidad,
acción, cada dato antes → después, motivo, efectos, origen (interfaz o script), usuario y fecha. Los
registros no SHALL modificarse ni borrarse. Sin autenticación, el usuario SHALL quedar vacío.

#### Scenario: Registro de una corrección

- **WHEN** se confirma la corrección del nombre del sitio EM-30185 con un borrador actualizado
- **THEN** la bitácora tiene un registro con «Nombre: ÁREA IV → ÁREA VI», el motivo, 1 borrador actualizado, origen interfaz y usuario vacío

#### Scenario: Intento de modificar la bitácora

- **WHEN** se intenta actualizar o borrar un registro de la bitácora directamente en la base
- **THEN** la base rechaza la operación

#### Scenario: Fallo durante el cambio

- **WHEN** el cambio falla después de validarse, al actualizar los borradores
- **THEN** no queda aplicado el cambio ni su registro en la bitácora

#### Scenario: Altas desde scripts

- **WHEN** `npm run importar -- --aplicar` crea un contrato y le asocia un sitio
- **THEN** la bitácora registra ambas altas con origen script

#### Scenario: Ajuste de vigencia desde la importación de programa

- **WHEN** se aplica la importación de un programa con el ajuste de la vigencia del contrato y su motivo, por línea de comandos
- **THEN** la vigencia se corrige con las mismas validaciones que en la interfaz y la bitácora registra la vigencia antes → después, el motivo y el origen script; sin motivo, el comando se rechaza sin tocar la base

### Requirement: Datos personales en la bitácora

Los nombres, cargos y empresas de firmantes que guarde la bitácora SHALL tratarse como datos
personales, igual que la tabla de firmantes: no SHALL incluirse en semillas, specs ni en el historial
del proyecto, y solo SHALL mostrarse dentro de la aplicación, en el historial del contrato.

#### Scenario: Historial de un cambio de firmante

- **WHEN** se cambia el firmante de Recibió de un contrato
- **THEN** el historial del contrato muestra el nombre anterior y el nuevo, y las pruebas automatizadas usan solo nombres ficticios

### Requirement: Historial de cambios del contrato

La pantalla del contrato SHALL tener una sección plegable «Historial de cambios» con los registros de la
bitácora del contrato, de sus firmantes y de sus sitios (también los hechos desde otro contrato que
comparte el sitio), del más reciente al más antiguo, en páginas de 20: fecha y hora de la Ciudad de
México, qué cambió, antes → después, motivo, usuario («—» sin autenticación) y efectos.

#### Scenario: Consultar el historial

- **WHEN** se abre «Historial de cambios» de un contrato después de corregir su número
- **THEN** el primer registro muestra la fecha local, «Contrato · Número», el número anterior → nuevo, el motivo, «—» como usuario y los borradores actualizados

#### Scenario: Sitio corregido desde otro contrato

- **WHEN** el nombre de un sitio compartido se corrige desde otro contrato
- **THEN** el cambio aparece también en el historial de este contrato

#### Scenario: Contrato sin cambios

- **WHEN** el contrato no tiene registros en la bitácora
- **THEN** la sección indica «Sin cambios registrados»

### Requirement: Edición del catálogo reservada a administradores

El servidor SHALL decidir en un solo punto si la persona puede editar el contrato, sus sitios y sus
firmantes. Sin autenticación SHALL permitirlo a todos; con autenticación, solo a administradores, y las
demás personas SHALL ver los datos y el historial sin acciones de edición. El usuario de la bitácora
SHALL tomarse de la sesión validada por el servidor, nunca de la petición.

#### Scenario: Sin autenticación

- **WHEN** no hay autenticación configurada
- **THEN** cualquier persona ve «Editar» en el contrato y la bitácora registra el usuario vacío

#### Scenario: Persona sin permiso

- **WHEN**, con autenticación, una persona que no es administradora envía una edición del contrato
- **THEN** el servidor responde que no tiene permiso, sin calcular ni aplicar el cambio

#### Scenario: Usuario escrito en la petición

- **WHEN** una petición de edición incluye un campo con un identificador de usuario
- **THEN** el servidor lo ignora y registra el usuario de la sesión
