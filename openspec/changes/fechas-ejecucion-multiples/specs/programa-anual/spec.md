# Spec Delta

## Purpose

Planear y dar seguimiento al programa anual de operación y mantenimiento de cada contrato y sitio,
comparando lo programado con lo realizado mes a mes a partir de los reportes emitidos.

## ADDED Requirements

### Requirement: Realizado por día de las partidas diarias

En una partida diaria, el realizado de reportes de cada mes SHALL ser el número de días distintos que
cubren sus reportes emitidos de ese mes; un día cubierto por varios reportes (por TAG, por semana o del
mes completo) SHALL contar una vez. Los realizados manuales se suman igual que antes. Las demás
periodicidades siguen contando una ejecución por ocurrencia. Amplía «Realizado derivado de los
reportes» (`reportes-mantenimiento-for-icsi-rmt-01`).

#### Scenario: Reporte del mes completo

- **WHEN** se emite el reporte de mayo de 2026 de la partida 33 diaria de Cerritos con los días «01-31» y lo programado en mayo es 31
- **THEN** el realizado de mayo es 31 y la celda queda cumplida

#### Scenario: Reportes semanales

- **WHEN** la partida 2 diaria tiene emitidos los reportes de las semanas 1 («01-03») y 2 («04-10») de mayo de 2026
- **THEN** el realizado de mayo es 10 y, al terminar mayo sin más reportes, la celda queda vencida con 21 faltantes

#### Scenario: Días repetidos entre reportes

- **WHEN** dos reportes emitidos de la misma partida diaria, uno por TAG, cubren los días «01-03» y «02-05» de mayo de 2026
- **THEN** el realizado de mayo es 5 y la celda lista los dos reportes

#### Scenario: Borrador de una partida diaria

- **WHEN** la partida diaria tiene en mayo de 2026 solo un borrador con los días «01-31»
- **THEN** el realizado de mayo sigue en 0

#### Scenario: Partida no diaria

- **WHEN** se emite el reporte mensual de la partida 7 con los días «04, 05»
- **THEN** el realizado de la partida 7 en ese mes aumenta en uno
