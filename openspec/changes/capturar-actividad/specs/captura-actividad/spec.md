## ADDED Requirements

### Requirement: Menú «Capturar» en la barra superior

La barra superior SHALL ofrecer, a quien tiene la capacidad `capturar`, el botón «Capturar» que
despliega «Actividad» y «Reporte». «Reporte» SHALL llevar a la captura de reportes. «Actividad» SHALL
abrir la ventana «Capturar actividad». El menú SHALL cerrarse al elegir una opción, con Esc o con un
clic fuera.

#### Scenario: Reporteador abre el menú

- **WHEN** una persona con rol reporteador pulsa «Capturar»
- **THEN** ve «Actividad» y «Reporte», y «Reporte» lleva a `/captura`

#### Scenario: Sin capacidad de capturar

- **WHEN** una persona de contabilidad ve la barra superior
- **THEN** no aparece el botón «Capturar»

### Requirement: Campos de la ventana «Capturar actividad»

La ventana SHALL mostrar los centros de costo visibles para quien captura y, para el elegido con
programa anual, sus partidas del programa vigente en una lista con búsqueda. SHALL pedir si la
actividad se realizó (Sí o No) y aceptar una fecha opcional y, con «Sí», las personas activas que la
realizaron (opcional).

#### Scenario: Elegir la actividad

- **WHEN** se elige EM-30167 y se escribe «potenciales» en la actividad
- **THEN** la lista muestra solo las partidas del programa vigente de EM-30167 que coinciden

#### Scenario: Personas solo con «Sí»

- **WHEN** se elige «No»
- **THEN** la ventana no pide las personas

### Requirement: Registro de la actividad

«Sí» SHALL registrar una marca de ejecución de 1 con la fecha y las personas en el mes de la fecha.
«No» SHALL registrar 1 como «No ejecutado» en ese mes. Sin fecha SHALL usarse la de hoy. La fecha
SHALL estar dentro del periodo del programa y no ser posterior a hoy. Ambos SHALL rechazarse si en
ese mes no falta nada por ejecutar.

#### Scenario: Actividad realizada con personas

- **WHEN** se elige EM-30167, la partida 7, «Sí», la fecha 2026-11-10 y dos personas
- **THEN** noviembre de la partida 7 cuenta una ejecución sin reporte con esa fecha y quedan registradas las dos personas

#### Scenario: Sin fecha

- **WHEN** se registra la partida 7 como realizada sin indicar la fecha y hoy es 2026-11-21
- **THEN** la ejecución queda con fecha 2026-11-21 en noviembre

#### Scenario: Actividad no realizada

- **WHEN** se elige la partida 7, «No» y la fecha 2026-10-15
- **THEN** octubre de la partida 7 registra 1 «No ejecutado» con motivo «Otro» y la nota de su origen

#### Scenario: Nada por ejecutar en el mes

- **WHEN** se registra una actividad en un mes en el que la partida ya está completa o no tiene programa
- **THEN** el registro se rechaza con un mensaje que lo explica y la ventana sigue abierta

#### Scenario: Fecha futura

- **WHEN** se indica una fecha posterior a hoy
- **THEN** la ventana no permite registrar y el servidor la rechaza

### Requirement: Centros de costo sin programa anual

Si el centro de costo elegido no tiene programa anual, la ventana SHALL indicarlo y ofrecer el
enlace a su seguimiento del mes en lugar de la lista de actividades.

#### Scenario: Centro sin programa

- **WHEN** se elige un centro de costo sin programa anual
- **THEN** la ventana dice que no tiene programa anual y enlaza a `/seguimiento` de ese centro

### Requirement: Alcance y permisos de la captura de actividades

Registrar una actividad SHALL exigir la capacidad `capturar`. Los centros de costo, partidas y
programas SHALL limitarse al alcance de quien captura: un programa o centro ajeno SHALL responder 404.

#### Scenario: Programa de otro centro de costo

- **WHEN** un reporteador de EM-30167 envía el registro de una partida de otro centro de costo
- **THEN** el servidor responde 404 y no registra nada

#### Scenario: Rol sin capacidad de capturar

- **WHEN** una persona de mesa directiva envía un registro de actividad
- **THEN** el servidor lo rechaza con 403
