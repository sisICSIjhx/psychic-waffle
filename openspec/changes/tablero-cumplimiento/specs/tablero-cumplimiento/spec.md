# Spec Delta

## Purpose

Medir el cumplimiento del programa anual de cada contrato y sitio a un mes de corte, con los
indicadores del libro de Virtual, y señalar los reportes que faltan para que cada partida llegue al
estado final «Con reporte».

## ADDED Requirements

### Requirement: Indicadores a un mes de corte

El tablero SHALL calcular, con los meses del programa hasta el mes de corte (por omisión, el mes en
curso): PR, lo programado original; E, lo ejecutado sin pasar de lo esperado en cada celda; R, lo
reprogramado desde esos meses; N, lo no ejecutado más lo que falta en meses terminados; y P, lo que
falta en el mes en curso más lo reprogramado a meses posteriores al corte. Los extras SHALL mostrarse
aparte y SHALL cumplirse PR = E + N + P.

#### Scenario: Cálculo con ajustes

- **WHEN** un sitio tiene PR = 10 hasta el corte, con 6 ejecuciones en su mes, 2 reprogramadas (una ejecutada en un mes evaluado y otra hacia un mes posterior al corte), 1 no ejecutada y 1 vencida sin ajuste
- **THEN** el tablero muestra PR 10, E 7, R 2, N 2 y P 1

#### Scenario: Ejecuciones de más

- **WHEN** una partida tiene 1 programado en mayo y 2 realizados registrados en mayo
- **THEN** mayo aporta 1 a E y 1 a los extras, y los porcentajes no cuentan el extra

#### Scenario: Vencido sin ajuste

- **WHEN** termina septiembre y una partida programada en septiembre no tiene ejecución ni ajuste
- **THEN** esa ejecución cuenta en N desde octubre

#### Scenario: Mes de corte anterior

- **WHEN** el usuario elige agosto de 2026 como mes de corte
- **THEN** los indicadores solo consideran los meses del programa hasta agosto de 2026

### Requirement: Porcentajes del tablero

El tablero SHALL mostrar %cumplimiento = E / (E + N), %efectividad = E / (E + R) y %con reporte =
ejecuciones cubiertas por reportes emitidos / E. Los porcentajes SHALL mostrarse truncados al entero
y, cuando el denominador sea cero, como «—» con el texto «Sin datos».

#### Scenario: Porcentajes con ajustes

- **WHEN** E = 7, N = 2 y R = 2, y 5 de las 7 ejecuciones tienen reporte emitido
- **THEN** el tablero muestra cumplimiento 77 %, efectividad 77 % y con reporte 71 %

#### Scenario: Sin datos

- **WHEN** el mes de corte es el primero del programa y no hay ejecuciones, no ejecutados ni reprogramaciones
- **THEN** los tres porcentajes se muestran como «—» con el texto «Sin datos»

### Requirement: Semáforos de cumplimiento y efectividad

El %cumplimiento SHALL clasificarse en rojo (menor que 75 %), amarillo (de 75 % a menos de 90 %) y
verde (90 % o más), y el %efectividad en rojo (menor que 60 %), amarillo (de 60 % a menos de 80 %) y
verde (80 % o más), con el valor sin redondear. Cada semáforo SHALL mostrar un icono y un texto
(«Bajo la meta», «Cerca de la meta» o «En meta») además del color.

#### Scenario: Cumplimiento justo debajo de la meta

- **WHEN** el cumplimiento es 89.9 %
- **THEN** el tablero muestra 89 % en amarillo con «Cerca de la meta»

#### Scenario: Cumplimiento en la meta

- **WHEN** el cumplimiento es 90 %
- **THEN** el tablero muestra 90 % en verde con «En meta»

#### Scenario: Efectividad baja

- **WHEN** la efectividad es 59.5 %
- **THEN** el tablero muestra 59 % en rojo con «Bajo la meta»

#### Scenario: Sin semáforo

- **WHEN** un porcentaje no tiene datos
- **THEN** no se muestra semáforo para ese porcentaje

### Requirement: Acceso al tablero

El menú principal SHALL incluir «Cumplimiento» en el grupo «Planeación», después de «Anual»; abre el
tablero en `/cumplimiento`, cuyo título es «Cumplimiento del programa».

#### Scenario: Abrir el tablero

- **WHEN** el usuario elige «Cumplimiento» en el menú
- **THEN** el sistema abre `/cumplimiento`, marca la entrada como activa y titula la página «Cumplimiento del programa»

### Requirement: Filtros del tablero

El tablero SHALL filtrar por cliente, contrato, sitio, periodicidad y mes de corte, y conservar los
filtros en la dirección. SHALL considerar los programas cuyo periodo contiene el mes de corte, que no
SHALL ser posterior al mes en curso. Si ningún programa cumple los filtros, SHALL explicarlo y ofrecer
ir a la planeación o al catálogo.

#### Scenario: Filtrar por cliente

- **WHEN** el usuario elige el cliente Proagro
- **THEN** el tablero muestra solo los sitios EM-30184 y EM-30185 y la dirección conserva el filtro

#### Scenario: Filtrar por periodicidad

- **WHEN** el usuario elige la periodicidad semanal
- **THEN** los indicadores, la tabla, la tendencia y los reportes que faltan solo consideran partidas semanales

#### Scenario: Mes de corte futuro

- **WHEN** la dirección pide un mes de corte posterior al mes en curso
- **THEN** el tablero usa el mes en curso y lo indica

#### Scenario: Sin programas en el corte

- **WHEN** ningún programa contiene el mes de corte elegido
- **THEN** el tablero explica que no hay programas en ese mes y ofrece ir a Planeación o al catálogo

### Requirement: Tabla por contrato y sitio

El tablero SHALL mostrar una tabla con una fila por sitio agrupada por contrato, con PR, E, R, N, P,
extras y los tres porcentajes con su semáforo, más subtotales por contrato y un total. Con un sitio
elegido, SHALL desglosar por partida. Cada fila SHALL llevar a la planeación de ese contrato y sitio.

#### Scenario: Contrato con dos sitios

- **WHEN** el tablero incluye el contrato de Proagro con EM-30184 y EM-30185
- **THEN** la tabla muestra una fila por sitio y un subtotal del contrato con la suma de sus indicadores

#### Scenario: Desglose por partida

- **WHEN** el usuario filtra el sitio EM-30184
- **THEN** la tabla muestra una fila por partida con sus indicadores y semáforos

#### Scenario: Ir a la planeación

- **WHEN** el usuario elige la fila de EM-30185
- **THEN** el sistema abre Planeación con ese contrato y sitio

### Requirement: Tendencia mensual

El tablero SHALL mostrar la tendencia del %cumplimiento y del %efectividad de cada mes evaluado,
calculados con las celdas de ese mes, con las metas (90 % y 80 %) como referencia y una tabla
equivalente con los mismos valores.

#### Scenario: Meses evaluados

- **WHEN** el programa empieza en mayo de 2026 y el mes de corte es octubre de 2026
- **THEN** la tendencia muestra de mayo a octubre de 2026

#### Scenario: Mes sin datos

- **WHEN** un mes evaluado no tiene ejecuciones, no ejecutados ni reprogramaciones
- **THEN** la gráfica deja ese mes sin punto y la tabla muestra «—»

### Requirement: Reportes que faltan

El tablero SHALL listar los reportes que faltan en los meses evaluados en tres grupos: vencidos sin
reporte, ejecutados sin reporte y borradores abiertos (en borrador o en revisión), del mes más antiguo
al más reciente. Cada elemento SHALL mostrar sitio, partida, actividad, mes y cantidad, y ofrecer
«Capturar» o «Continuar borrador».

#### Scenario: Vencido sin reporte

- **WHEN** la partida 3 de EM-30167 venció en junio sin ejecución
- **THEN** aparece en «Vencidos sin reporte» con «Capturar», que abre la captura con contrato, sitio, partida y junio elegidos

#### Scenario: Borrador abierto

- **WHEN** la partida 7 de octubre tiene un borrador
- **THEN** aparece en «Borradores abiertos» con «Continuar borrador», que abre ese borrador

#### Scenario: Reprogramado

- **WHEN** lo que faltaba de la partida 3 en junio se reprogramó a octubre
- **THEN** junio no aparece en la lista y, si octubre ya terminó sin ejecutarla, aparece como vencida de octubre
