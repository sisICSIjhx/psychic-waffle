# Spec Delta

## Purpose

Mantener en un solo lugar los clientes, contratos, sitios, partidas con sus alcances, equipos y
firmantes que alimentan la planeación y el prellenado de cada reporte de mantenimiento.

## ADDED Requirements

### Requirement: Rango completo del último mes en la importación del catálogo

Al importar un libro «CATALOGO DE ALCANCES», cada mes de la fila de meses SHALL abarcar su rango de
celdas combinadas. Un mes sin combinar SHALL llegar hasta la columna anterior al mes siguiente y, si es
el último, SHALL tener el mismo ancho que el mes anterior. Corrige «Importación del catálogo desde
Excel» del cambio `reportes-mantenimiento-for-icsi-rmt-01`, que solo revisaba dos columnas del último
mes.

#### Scenario: Marca en la tercera columna del último mes

- **WHEN** el último mes del programa está combinado en cuatro columnas y una partida mensual tiene su marca en la tercera
- **THEN** el último mes cuenta como programado y la partida suma 12

#### Scenario: Reimportación del catálogo de Cerritos

- **WHEN** se revisa otra vez el catálogo de Cerritos ya importado, con periodo de mayo de 2026 a abril de 2027
- **THEN** el ensayo solo puede proponer cambios en los meses programados de abril de 2027; los demás meses y los campos del catálogo de sus 55 partidas quedan sin cambios

### Requirement: Ajuste de la vigencia del contrato al importar un programa

La importación de programa por línea de comandos SHALL poder ajustar la vigencia de un contrato
existente cuando se pide de forma explícita. El ensayo SHALL mostrar la vigencia antes → después. Al
aplicar, SHALL rechazarse sin cambios si la nueva vigencia no contiene el periodo del programa o si
deja fuera algún reporte o programa del contrato. Este ajuste no registra bitácora todavía.

#### Scenario: Vigencia alineada con el programa

- **WHEN** se importa el programa de Proagro pidiendo la vigencia del 2026-03-01 al 2027-02-28 para el contrato `PRO-AGRO-PRV-016-2026`, hoy del 2026-05-01 al 2027-04-30
- **THEN** el ensayo muestra «2026-05-01 a 2027-04-30 → 2026-03-01 a 2027-02-28» y, al aplicar, la captura ofrece de marzo de 2026 a febrero de 2027

#### Scenario: Vigencia que deja fuera un reporte

- **WHEN** se pide una vigencia que deja fuera del contrato un reporte de abril de 2027
- **THEN** el comando se rechaza, indica el periodo del reporte y no cambia la vigencia, el programa ni las partidas

#### Scenario: Vigencia que no contiene el programa

- **WHEN** se pide una vigencia que termina antes del fin del periodo del programa
- **THEN** el comando se rechaza antes de tocar la base e indica ambos rangos

#### Scenario: Sin pedir el ajuste

- **WHEN** se importa el programa sin pedir el ajuste de vigencia
- **THEN** la vigencia del contrato no cambia y el ensayo muestra la advertencia de meses fuera de la vigencia
