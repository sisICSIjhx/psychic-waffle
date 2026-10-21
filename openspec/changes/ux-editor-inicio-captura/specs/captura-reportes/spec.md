# Spec Delta

## Purpose

Capturar el reporte de actividades con evidencia fotográfica FOR-ICSI-RMT-01 a partir del catálogo,
de modo que el técnico solo registre lo que cambia en cada ejecución: fotos, estados, observaciones y
conclusiones.

## ADDED Requirements

### Requirement: Búsqueda de la partida

Al crear un reporte, la partida SHALL elegirse con un selector que permita buscar por número o por
texto de la actividad, sin distinguir mayúsculas ni acentos, y que muestre en cada opción el número, la
actividad completa y la periodicidad. El selector SHALL poder usarse solo con el teclado.

#### Scenario: Buscar por texto

- **WHEN** el usuario escribe «potenciales» en el selector de partidas de Cerritos
- **THEN** el selector muestra la partida 7 «TOMA DE POTENCIALES TUBO-SUELO» con su periodicidad

#### Scenario: Buscar por número

- **WHEN** el usuario escribe «7»
- **THEN** la partida número 7 aparece en primer lugar, antes de las que solo contienen el 7 en su texto

#### Scenario: Sin resultados

- **WHEN** la búsqueda no coincide con ninguna partida
- **THEN** el selector lo indica en texto y conserva lo escrito

### Requirement: Partidas agrupadas por el trabajo pendiente

El selector SHALL agrupar las partidas en «Con borrador», «Pendientes» (meses vencidos anteriores al
mes de referencia o pendientes en él) y «Otras partidas». Cada partida SHALL aparecer una sola vez: con
algún borrador en esos meses va en «Con borrador», con su estado y mes pendientes en icono y texto. El
mes de referencia SHALL ser el pedido en la dirección o el mes en curso.

#### Scenario: Partida vencida primero

- **WHEN** en octubre de 2026 la partida 3 tiene junio de 2026 vencido y la partida 7 está pendiente en octubre
- **THEN** ambas aparecen en «Pendientes», la 3 primero con «Vencida · junio 2026» y la 7 con «Pendiente · octubre 2026»

#### Scenario: Partida pendiente con borrador

- **WHEN** la partida 12 está pendiente en octubre de 2026 y ya tiene un borrador de ese mes
- **THEN** aparece solo en «Con borrador», con «Pendiente · octubre 2026» y la indicación del borrador, y no en «Pendientes»

### Requirement: Mes sugerido según el pendiente

Al elegir una partida sin mes indicado en la dirección, la captura SHALL sugerir su mes vencido más
antiguo o, si no tiene vencidos, el mes en curso. La sugerencia SHALL poder cambiarse.

#### Scenario: Partida con un mes vencido

- **WHEN** el usuario elige la partida 3, vencida en junio de 2026, sin mes en la dirección
- **THEN** la captura propone junio de 2026 como periodo

### Requirement: Contexto resuelto como resumen

Cuando el cliente tenga un solo contrato vigente y el contrato un solo sitio, la captura SHALL mostrarlos
como un resumen (cliente, contrato y sitio) con la acción «Cambiar», en lugar de listas con una sola
opción. Los pasos de la captura SHALL verse numerados con lo ya elegido resumido.

#### Scenario: Cliente con un solo contrato y sitio

- **WHEN** el usuario entra a capturar por un cliente con un contrato vigente y un sitio
- **THEN** la captura muestra «cliente · contrato · sitio» con «Cambiar» y empieza en la elección de la partida

### Requirement: Aviso de reporte existente

Al elegir partida y periodo, si ya existe un borrador o un reporte emitido de esa partida, mes y
ocurrencia, la captura SHALL avisarlo antes de crear otro, con sus TAG y un enlace para abrirlo. El
aviso no SHALL impedir crear el reporte nuevo.

#### Scenario: Borrador existente

- **WHEN** el usuario elige la partida 7 y mayo de 2026, y ya hay un borrador de esa partida y mes
- **THEN** la captura muestra «Ya existe un borrador de esta partida y periodo» con el enlace para continuarlo

#### Scenario: Reporte de otro TAG

- **WHEN** existe un reporte emitido de la partida y mes para el TAG PI-0001 y el usuario elige PI-1001
- **THEN** el aviso indica el TAG del reporte existente y permite crear el reporte de PI-1001

### Requirement: Barra de estado del editor

El editor SHALL mantener visible una barra con el contexto del reporte (cliente, partida y periodo), su
estado en icono y texto, el estado del guardado, el número de datos que faltan para enviarlo a revisión y
la acción principal del estado. La barra no SHALL superar 64 px de alto en escritorio; en móvil SHALL
usar dos líneas, más la del motivo de «Descargar DOCX» cuando falte la fecha.

#### Scenario: Borrador incompleto

- **WHEN** un borrador tiene 4 datos pendientes para enviarse a revisión
- **THEN** la barra muestra «Faltan 4» y la acción «Enviar a revisión»

#### Scenario: Reporte en revisión

- **WHEN** el reporte está en revisión
- **THEN** la barra ofrece «Emitir» como acción principal y «Regresar a borrador» como secundaria

### Requirement: Guardado visible con reintento

La barra SHALL indicar si hay cambios sin guardar, si se está guardando o la hora relativa del último
guardado. Si un guardado falla, SHALL decirlo con la causa y ofrecer «Reintentar»; lo capturado SHALL
seguir en pantalla.

#### Scenario: Guardado reciente

- **WHEN** el autoguardado terminó hace 5 segundos
- **THEN** la barra muestra «Guardado hace 5 s»

#### Scenario: Fallo de conexión

- **WHEN** un guardado falla porque no hay conexión con el servidor
- **THEN** la barra muestra «No se guardó» con la causa y «Reintentar», y al elegirlo vuelve a guardar sin perder lo escrito

### Requirement: Índice de secciones con completitud

El editor SHALL ofrecer un índice de sus secciones y alcances en el orden del documento, que marque cada
una como completa o con la cantidad de datos pendientes, en icono y texto, y que lleve a la sección
elegida. En pantallas angostas el índice SHALL presentarse como una lista desplegable.

#### Scenario: Alcance incompleto

- **WHEN** el alcance 2.2 está «Con observación» sin texto
- **THEN** el índice marca «2. Alcance» y «2.2» con un pendiente, y al elegir 2.2 lleva el foco a ese alcance

### Requirement: Resumen de pendientes al enviar a revisión

En un borrador, «Enviar a revisión» SHALL estar disponible aunque falten datos. Si faltan, el sistema
SHALL mostrar un resumen con un enlace a cada campo pendiente, SHALL mover el foco al resumen y no SHALL
cambiar el estado del reporte.

#### Scenario: Envío con datos faltantes

- **WHEN** el usuario elige «Enviar a revisión» sin fecha de ejecución ni conclusiones
- **THEN** el sistema muestra el resumen con los dos pendientes, el reporte sigue en Borrador y el enlace de la fecha lleva el foco a ese campo

### Requirement: Error junto al campo

Cuando un campo requerido para la revisión quede vacío o no sea válido al salir de él, el editor SHALL
mostrar el error en texto junto al campo, asociado a él para los lectores de pantalla, con la corrección
esperada.

#### Scenario: Fecha fuera del periodo

- **WHEN** el usuario escribe una fecha de ejecución fuera del mes del reporte y sale del campo
- **THEN** el campo muestra el rango de fechas permitido junto a él y queda marcado como inválido

### Requirement: Datos del catálogo como resumen editable

Las firmas y el objetivo, que vienen del catálogo y casi no cambian, SHALL mostrarse como resumen de
lectura con «Editar»; usuario, contrato, sitio y periodicidad vienen del contrato y SHALL mostrarse de
solo lectura, con la indicación de corregirlos en el catálogo. Lo que cambia en cada ejecución SHALL
quedar abierto, y una sección con datos pendientes SHALL mostrarse abierta.

#### Scenario: Editar las firmas

- **WHEN** el usuario elige «Editar» en las firmas
- **THEN** se muestran los campos de Elaboró, Aprobó y Recibió con sus valores y los cambios se autoguardan

#### Scenario: Firma incompleta

- **WHEN** a la firma de Aprobó le falta el nombre requerido para la revisión
- **THEN** la sección de firmas se muestra abierta con el campo señalado

### Requirement: Verificación de un clic

El estado de verificación de cada alcance SHALL elegirse con botones de una sola pulsación (OK, No
aplica y Con observación), operables con el teclado. El campo de observaciones SHALL mostrarse con «Con
observación» o cuando ya tenga texto, y solo con «Con observación» SHALL ser obligatorio.

#### Scenario: Marcar con observación

- **WHEN** el usuario pulsa «Con observación» en el alcance 2.1
- **THEN** aparece el campo de observaciones de 2.1, marcado como obligatorio

#### Scenario: Observación capturada antes

- **WHEN** un alcance en OK ya tiene una observación escrita
- **THEN** el campo de observaciones se sigue mostrando con su texto

### Requirement: Fecha de ejecución con atajo

El campo de fecha de ejecución SHALL ofrecer la acción «Hoy» cuando la fecha de hoy esté dentro del
periodo del reporte, y SHALL mostrar el rango permitido cuando no lo esté.

#### Scenario: Hoy dentro del periodo

- **WHEN** el reporte es de octubre de 2026 y hoy es 21 de octubre de 2026
- **THEN** «Hoy» llena la fecha con el 21 de octubre de 2026

#### Scenario: Hoy fuera del periodo

- **WHEN** el reporte es de mayo de 2026 y hoy es 21 de octubre de 2026
- **THEN** no se ofrece «Hoy» y se muestra el rango del 1 al 31 de mayo de 2026

### Requirement: Carga de fotos por arrastre

Cada alcance, y cada espacio antes, durante y después, SHALL aceptar fotos soltadas sobre él además del
botón «Agregar fotos», que SHALL seguir disponible como alternativa al arrastre.

#### Scenario: Soltar varias fotos

- **WHEN** el usuario suelta tres fotos JPEG sobre el alcance 2.1
- **THEN** las tres se cargan en ese alcance con la numeración siguiente

#### Scenario: Soltar un archivo no válido

- **WHEN** el usuario suelta un PDF junto con dos fotos
- **THEN** el PDF se rechaza con la causa y las dos fotos se cargan

### Requirement: Progreso de carga por archivo

Durante una carga, el editor SHALL mostrar el avance por archivo («Cargando 3 de 12») y, al terminar,
cada rechazo con el nombre del archivo y su causa, sin detener la carga de los demás.

#### Scenario: Carga de doce fotos

- **WHEN** el usuario carga doce fotos y la tercera supera 15 MB
- **THEN** el avance cuenta las doce, la tercera se informa con su causa y las otras once se cargan

### Requirement: Quitar con deshacer

Quitar una foto o un alcance SHALL hacerse sin confirmación y SHALL mostrar una notificación con
«Deshacer» durante al menos 10 segundos. Deshacer SHALL restaurar el elemento con sus fotos, pies,
orden y espacio, aunque el autoguardado haya ocurrido en ese tiempo.

#### Scenario: Deshacer una foto

- **WHEN** el usuario quita la Ilustración 2.1.2 y elige «Deshacer» a los 5 segundos
- **THEN** la foto vuelve a su lugar con su pie y la numeración anterior

#### Scenario: Sin deshacer

- **WHEN** la notificación termina sin que el usuario elija «Deshacer»
- **THEN** la foto queda quitada del reporte

### Requirement: Emisión con diálogo propio

Emitir SHALL pedir confirmación en un diálogo propio que resuma lo que se emite (título, revisión y
número de fotos), explique que un reporte emitido no se modifica y deje el foco inicial en «Cancelar».
`Esc` SHALL cerrar el diálogo sin emitir.

#### Scenario: Cancelar con Esc

- **WHEN** el usuario abre el diálogo de emisión y pulsa Esc
- **THEN** el diálogo se cierra, el reporte sigue En revisión y el foco vuelve al botón «Emitir»

### Requirement: Descarga con motivo

«Descargar DOCX» SHALL estar siempre visible en el editor. Cuando no se pueda generar el documento,
SHALL mostrarse deshabilitado con el motivo en texto.

#### Scenario: Sin fecha de ejecución

- **WHEN** el borrador no tiene fecha de ejecución
- **THEN** «Descargar DOCX» aparece deshabilitado con el texto «Indique la fecha de ejecución»
