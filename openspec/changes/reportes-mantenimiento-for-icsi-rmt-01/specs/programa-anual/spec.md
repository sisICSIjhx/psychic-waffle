# Spec Delta

## Purpose

Planear y dar seguimiento al programa anual de operación y mantenimiento de cada contrato y sitio,
comparando lo programado con lo realizado mes a mes a partir de los reportes emitidos.

## ADDED Requirements

### Requirement: Periodo y meses del programa

Cada programa SHALL corresponder a un contrato y sitio, y tener un periodo con fecha inicial y final
(por ejemplo, del 1 de mayo de 2026 al 30 de abril de 2027). Los meses SHALL derivarse del periodo, en
orden.

#### Scenario: Periodo que cruza el año

- **WHEN** el periodo va de mayo de 2026 a abril de 2027
- **THEN** el programa presenta doce columnas, de «Mayo 2026» a «Abril 2027»

### Requirement: Cantidades programadas por mes

Para cada partida, el programa SHALL registrar la cantidad programada de cada mes. La suma de los meses
SHALL compararse con la cantidad anual de la partida. Las partidas «Cuando aplique» SHALL quedar sin
cantidad fija.

#### Scenario: Distribución que no cuadra

- **WHEN** una partida mensual con cantidad anual de 12 suma 11 en sus meses
- **THEN** el sistema marca la diferencia en la partida

#### Scenario: Partida diaria

- **WHEN** una partida tiene periodicidad diaria y cantidad anual de 365
- **THEN** el programa registra la cantidad programada de cada mes según sus días

### Requirement: Realizado derivado de los reportes

La cantidad realizada de cada partida y mes SHALL calcularse con los reportes en estado «Emitido» de esa
partida, contrato, sitio y mes. Los borradores no SHALL contar.

#### Scenario: Reporte emitido

- **WHEN** se emite el reporte de la partida 7 de mayo de 2026
- **THEN** el realizado de la partida 7 en mayo aumenta en uno

#### Scenario: Reporte por instrumento

- **WHEN** la partida trimestral de manómetros emite seis reportes, uno por TAG, en el mismo mes
- **THEN** el realizado cuenta una ejecución de la partida en ese mes y lista los seis reportes asociados

### Requirement: Consulta del avance

La vista de Planeación Anual SHALL mostrar por partida lo programado (P) y realizado (R) de cada mes, el
total realizado y los pendientes vencidos. Se SHALL poder filtrar por contrato, sitio, distribución y
periodicidad.

#### Scenario: Pendiente vencido

- **WHEN** termina junio y una partida programada en junio no tiene reporte emitido
- **THEN** la vista la señala como pendiente vencido de junio

#### Scenario: Ir a capturar desde el programa

- **WHEN** el usuario elige una celda programada sin realizar
- **THEN** el sistema abre una captura nueva con el contrato, el sitio, la partida y el mes ya seleccionados
