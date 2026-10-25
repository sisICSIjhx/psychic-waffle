# Spec Delta

## Purpose

Producir el reporte FOR-ICSI-RMT-01 como Word editable, fiel al formato que hoy entrega ICSI, a partir
de los datos capturados y sin rearmar el documento a mano.

## ADDED Requirements

### Requirement: Fila Fecha con varios días

La fila Fecha del encabezado SHALL mostrar los días de ejecución con dos dígitos, en orden ascendente y
con la forma capturada: un día como «DD», un rango como «DD-DD», los segmentos unidos con «, » y al final
« / MES / AAAA» con el mes en mayúsculas. Un reporte de un solo día SHALL imprimirse igual que antes de
este cambio. Amplía «Contenido y orden de secciones» (`reportes-mantenimiento-for-icsi-rmt-01`).

#### Scenario: Un solo día

- **WHEN** se genera un reporte con el día 18 de mayo de 2026
- **THEN** la fila Fecha muestra «18 / MAYO / 2026»

#### Scenario: Rango

- **WHEN** se genera un reporte con el rango del 5 al 8 de mayo de 2026
- **THEN** la fila Fecha muestra «05-08 / MAYO / 2026»

#### Scenario: Lista de días seguidos

- **WHEN** se genera un reporte con los días 2, 3 y 4 de mayo de 2026 capturados como lista
- **THEN** la fila Fecha muestra «02, 03, 04 / MAYO / 2026»

#### Scenario: Días y rangos mezclados

- **WHEN** se genera un reporte con los días 15 y 16 y el rango del 20 al 25 de mayo de 2026
- **THEN** la fila Fecha muestra «15, 16, 20-25 / MAYO / 2026»

#### Scenario: Nombre y título de la portada sin cambio

- **WHEN** se genera el reporte de la semana 1 de mayo de 2026 de una partida diaria con los días «01-03»
- **THEN** el nombre del archivo y el título de la portada usan el periodo «SEMANA 1 MAYO 2026», no los días, y la fila Fecha del encabezado muestra «01-03 / MAYO / 2026»

### Requirement: Documento solo con días de ejecución

El sistema SHALL generar el DOCX solo si el reporte tiene al menos un día de ejecución guardado; si no
lo tiene, SHALL rechazar la generación con un mensaje que lo indique, sin crear ni registrar archivo.
Sustituye la exigencia de fecha de ejecución para generar el documento.

#### Scenario: Reporte sin días

- **WHEN** se pide el documento de un borrador sin días de ejecución
- **THEN** el sistema responde «Capture los días de ejecución para generar el documento.» y no registra ningún documento
