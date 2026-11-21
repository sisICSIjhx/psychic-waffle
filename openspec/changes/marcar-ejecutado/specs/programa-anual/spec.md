## ADDED Requirements

### Requirement: Marcar una partida como ejecutada sin reporte

Quien puede ajustar el programa SHALL poder marcar como ejecutada una partida en un mes en curso o
terminado que tenga algo por ejecutar, con una cantidad de 1 hasta lo que falta, una fecha de
ejecución obligatoria dentro de ese mes y no posterior a hoy, y una nota opcional. SHALL poder quitar la
marca más reciente del mes. Una marca SHALL contar como ejecución solo en lo que no cubran los
reportes emitidos de la misma partida y mes; los realizados importados y los registrados como
externos SHALL seguir sumando como hasta ahora.

#### Scenario: Ejecutado antes del reporte

- **WHEN** la partida 7, mensual, tiene 1 programada en noviembre y se marca como ejecutada
- **THEN** la celda de noviembre muestra «Ejecutado» y «Sin reporte» con el tono «Ejecutado sin reporte»

#### Scenario: El reporte absorbe la marca

- **WHEN** la partida 7 de noviembre tiene una marca de ejecución y después se emite su reporte
- **THEN** la celda cuenta 1 ejecución, muestra «Ejecutado» y «Con reporte» con el tono de ejecutado

#### Scenario: Partida diaria con un reporte al final del mes

- **WHEN** una partida diaria con 30 programadas en noviembre se marca con 30 y luego se emite un reporte con los días del 1 al 30
- **THEN** noviembre cuenta 30 ejecuciones, no 60, y muestra «Con reporte»

#### Scenario: Cantidad mayor que lo que falta

- **WHEN** se intenta marcar 2 en una partida a la que le falta 1 en el mes
- **THEN** el registro se rechaza con un mensaje que dice cuánto falta

#### Scenario: Sin fecha de ejecución

- **WHEN** se intenta marcar como ejecutada la partida 7 de noviembre sin indicar la fecha
- **THEN** el diálogo no permite confirmar y el registro se rechaza con «Indique la fecha de ejecución»

#### Scenario: Mes futuro

- **WHEN** se intenta marcar como ejecutado un mes posterior al en curso
- **THEN** el registro se rechaza y el panel no ofrece la acción

#### Scenario: Desmarcar

- **WHEN** se desmarca la partida 7 de noviembre con una marca
- **THEN** la marca desaparece y la celda vuelve a «Pendiente» o «Vencido» según el mes
