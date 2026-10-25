# Spec Delta

## Purpose

Capturar el reporte de actividades con evidencia fotográfica FOR-ICSI-RMT-01 a partir del catálogo,
de modo que el técnico solo registre lo que cambia en cada ejecución: días de ejecución, fotos,
estados, observaciones y conclusiones.

## ADDED Requirements

### Requirement: Varios días de ejecución por reporte

Cada reporte SHALL registrar sus días de ejecución como una lista de segmentos, cada uno de un día o de
un rango de días seguidos, todos del mes de su periodo, en orden ascendente y sin repetir días. El
sistema SHALL conservar la forma capturada: una lista de días seguidos no se convierte en rango ni un
rango en lista. Sustituye la fecha única de «Datos del encabezado validados»
(`reportes-mantenimiento-for-icsi-rmt-01`).

#### Scenario: Lista de días seguidos

- **WHEN** el usuario captura «02, 03, 04» en un reporte de mayo de 2026
- **THEN** el reporte guarda tres segmentos de un día y no un rango del 2 al 4

#### Scenario: Rango de días

- **WHEN** el usuario captura «05-08» en un reporte de mayo de 2026
- **THEN** el reporte guarda un segmento del 5 al 8 de mayo de 2026

#### Scenario: Segmentos en desorden

- **WHEN** el usuario captura «20-25, 15, 16»
- **THEN** el reporte guarda los segmentos en orden: «15, 16, 20-25»

#### Scenario: Día de otro mes

- **WHEN** un guardado trae un día de junio de 2026 para un reporte de mayo de 2026
- **THEN** el sistema rechaza el guardado como dato inválido y el reporte conserva sus días anteriores

### Requirement: Días dentro del periodo para revisión

Para enviar a revisión o emitir, el reporte SHALL tener al menos un día de ejecución y todos SHALL caer
en su periodo: el mes, la semana de lunes a domingo recortada al mes o la quincena. Si no se cumple, el
sistema SHALL impedir el cambio de estado y señalar el campo de días con el periodo permitido.
Sustituye la regla de fecha de «Datos del encabezado validados»
(`reportes-mantenimiento-for-icsi-rmt-01`).

#### Scenario: Reporte sin días

- **WHEN** el usuario intenta enviar a revisión un reporte sin días de ejecución
- **THEN** el sistema impide el envío y señala el campo de días con «Capture los días de ejecución.»

#### Scenario: Días fuera de la semana

- **WHEN** un reporte de la semana 2 de mayo de 2026 tiene los días «04-06, 11, 12» y se intenta enviar a revisión
- **THEN** el sistema impide el envío con «Días fuera del periodo del reporte (del 4 al 10 de mayo de 2026): 11, 12.»

#### Scenario: Cambio de estado sin validación previa

- **WHEN** una petición de envío a revisión o de emisión llega al servidor para un reporte sin días
- **THEN** el servidor la rechaza como error de validación del campo de días y el estado no cambia

### Requirement: Captura de los días con texto y vista previa

El editor SHALL capturar los días en un campo de texto que acepte días y rangos separados por comas,
espacios o «y», con rangos escritos con «-» o «al», seguidos opcionalmente de « / MES / AAAA» del mes
del reporte. Debajo SHALL mostrar la vista previa exacta de la fila Fecha del documento y la ayuda con
el periodo. Sustituye el campo de fecha de «Fecha de ejecución con atajo»
(`ux-editor-inicio-captura`).

#### Scenario: Vista previa

- **WHEN** el usuario escribe «15 y 16, 20 al 25» en un reporte de mayo de 2026
- **THEN** el editor muestra «En el documento: 15, 16, 20-25 / MAYO / 2026»

#### Scenario: Texto copiado de un reporte anterior

- **WHEN** el usuario pega «05-08/ MAYO /2026» en un reporte de mayo de 2026
- **THEN** el editor reconoce el rango del 5 al 8 y muestra «En el documento: 05-08 / MAYO / 2026»

#### Scenario: Forma normalizada al salir del campo

- **WHEN** el usuario escribe «1 al 3» y sale del campo
- **THEN** el campo muestra «01-03» y conserva el rango

### Requirement: Errores del texto de días

Cuando el texto de días no sea válido, el editor SHALL mostrar el error en texto junto al campo,
asociado a él para los lectores de pantalla, con la corrección esperada: día repetido o traslapado, día
que no existe en el mes, rango invertido, texto no reconocido o mes distinto del periodo.

#### Scenario: Día repetido

- **WHEN** el usuario escribe «05-08, 07»
- **THEN** el campo muestra «El día 07 se repite.» y queda marcado como inválido

#### Scenario: Día inexistente

- **WHEN** el usuario escribe «31» en un reporte de junio de 2026
- **THEN** el campo muestra «Junio de 2026 no tiene día 31.»

#### Scenario: Rango invertido

- **WHEN** el usuario escribe «10-04»
- **THEN** el campo muestra «El rango 10-04 está invertido; escriba 04-10.»

#### Scenario: Texto no reconocido

- **WHEN** el usuario escribe «15, mañana»
- **THEN** el campo muestra «No se reconoce «mañana»; escriba días o rangos, por ejemplo 15, 16, 20-25.»

#### Scenario: Mes distinto del periodo

- **WHEN** el usuario escribe «05-08 / JUNIO / 2026» en un reporte de mayo de 2026
- **THEN** el campo muestra «Los días deben ser de mayo de 2026.»

### Requirement: Texto de días inválido sin autoguardado

Mientras el texto de días no sea válido, el editor no SHALL enviarlo al autoguardado ni descartarlo: el
reporte guardado conserva sus días anteriores, el campo conserva lo escrito, el pendiente SHALL contarse
en «Faltan N» y en el resumen de envío, y «Descargar DOCX» SHALL mostrarse deshabilitado con el motivo
«Corrija los días de ejecución».

#### Scenario: Texto inválido

- **WHEN** el reporte tiene «18» guardado y el usuario escribe «18, 2O» (con la letra O)
- **THEN** los días guardados siguen siendo «18», el campo conserva «18, 2O» y la barra cuenta el pendiente

#### Scenario: Texto corregido

- **WHEN** el usuario corrige el texto a «18, 20»
- **THEN** el autoguardado registra los dos días y el pendiente desaparece

### Requirement: Atajos de días de ejecución

El campo SHALL ofrecer «Agregar hoy» cuando hoy esté dentro del periodo y no esté incluido, que agrega
ese día como un segmento más en su orden, y «Todo el periodo», que reemplaza los días por un rango del
primer al último día del periodo. Si «Todo el periodo» reemplaza días capturados, SHALL ofrecer
«Deshacer». Sustituye «Fecha de ejecución con atajo» (`ux-editor-inicio-captura`).

#### Scenario: Agregar hoy

- **WHEN** un reporte de octubre de 2026 tiene «15, 16» y hoy es 21 de octubre de 2026
- **THEN** «Agregar hoy» deja «15, 16, 21»

#### Scenario: Hoy fuera del periodo

- **WHEN** el reporte es de mayo de 2026 y hoy es 21 de octubre de 2026
- **THEN** no se ofrece «Agregar hoy» y se muestra «Periodo: del 1 al 31 de mayo de 2026»

#### Scenario: Todo el periodo de una semana

- **WHEN** el usuario elige «Todo el periodo» en un reporte de la semana 1 de mayo de 2026
- **THEN** el campo queda con «01-03»

#### Scenario: Deshacer el reemplazo

- **WHEN** el reporte tenía «15, 16, 20-25», el usuario elige «Todo el periodo» y después «Deshacer»
- **THEN** el campo y los días guardados vuelven a «15, 16, 20-25»

### Requirement: Descarga sin días de ejecución

«Descargar DOCX» SHALL mostrarse deshabilitado con el motivo «Indique los días de ejecución» cuando el
reporte no tenga días guardados. Amplía «Descarga con motivo» (`ux-editor-inicio-captura`), cuyo
motivo «Indique la fecha de ejecución» se sustituye.

#### Scenario: Borrador sin días

- **WHEN** el borrador no tiene días de ejecución
- **THEN** «Descargar DOCX» aparece deshabilitado con el texto «Indique los días de ejecución»

### Requirement: Periodo de las partidas diarias

Al crear el reporte de una partida diaria, la captura SHALL pedir «Mes completo» o «Por semana» y, en el
segundo caso, la semana; no SHALL pedir un día. El periodo del reporte SHALL ser el mes o la semana
elegidos y el título SHALL componerse como en las partidas mensuales o semanales. Amplía «Selección
guiada del reporte» (`reportes-mantenimiento-for-icsi-rmt-01`).

#### Scenario: Mes completo

- **WHEN** el usuario crea el reporte de la partida 33 diaria de Cerritos de mayo de 2026 con «Mes completo»
- **THEN** el título termina en «MAYO 2026», el periodo va del 1 al 31 de mayo de 2026 y «Todo el periodo» llena «01-31»

#### Scenario: Por semana

- **WHEN** el usuario crea el reporte de la partida 2 diaria de Cerritos de mayo de 2026 «Por semana», semana 1
- **THEN** el título termina en «SEMANA 1 MAYO 2026» y el periodo va del 1 al 3 de mayo de 2026

#### Scenario: Partida semanal

- **WHEN** el usuario elige la partida 15 semanal de Cerritos
- **THEN** la captura pide la semana y no ofrece «Mes completo»

### Requirement: Aviso de reportes de una partida diaria

Para una partida diaria, el aviso de reporte existente SHALL considerar todos los reportes de la partida
en el mes, del mes completo y de cualquier semana, porque sus días pueden coincidir. El aviso no SHALL
impedir crear el reporte. Amplía «Aviso de reporte existente» (`ux-editor-inicio-captura`).

#### Scenario: Reporte del mes completo existente

- **WHEN** existe un reporte emitido del mes completo de la partida 33 en mayo de 2026 y el usuario elige «Por semana», semana 2
- **THEN** el aviso muestra ese reporte con su enlace y permite crear el reporte de la semana 2

### Requirement: Revisión con los mismos días

Una nueva revisión de un reporte emitido SHALL copiar todos sus días de ejecución con la misma forma.
Amplía «Estados del reporte» (`reportes-mantenimiento-for-icsi-rmt-01`).

#### Scenario: Revisión de un reporte de varios días

- **WHEN** se crea la revisión de un reporte emitido con los días «15, 16, 20-25»
- **THEN** el borrador de la revisión tiene los días «15, 16, 20-25»

### Requirement: Reportes existentes con un solo día

Al aplicar el cambio, cada reporte con fecha de ejecución SHALL quedar con un segmento de ese día, sin
cambiar su versión, su estado ni su fecha de actualización, y su documento ya generado SHALL seguir
siendo válido para descargarse. Los reportes sin fecha SHALL quedar sin días.

#### Scenario: Reporte emitido con documento

- **WHEN** se aplica el cambio a un reporte emitido con fecha 18 de mayo de 2026 y documento generado
- **THEN** el reporte tiene el día «18», el historial lo muestra en el mismo orden y la descarga entrega el documento ya registrado

#### Scenario: Borrador sin fecha

- **WHEN** se aplica el cambio a un borrador sin fecha de ejecución
- **THEN** el borrador queda sin días y «Descargar DOCX» muestra «Indique los días de ejecución»
