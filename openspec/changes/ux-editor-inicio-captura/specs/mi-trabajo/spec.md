# Spec Delta

## Purpose

Página de inicio orientada a tareas: muestra qué trabajo toca hacer en el mes y permite empezarlo con
un clic, para acortar el camino de un pendiente al editor del reporte.

## ADDED Requirements

### Requirement: Avance del mes

La página de inicio SHALL mostrar el mes en curso con las partidas realizadas frente a las programadas
de los programas vigentes, en texto y con una barra de progreso. El mes SHALL escribirse en formato de
oración y el avance no SHALL depender solo del color.

#### Scenario: Mes con avance parcial

- **WHEN** en octubre de 2026 los programas vigentes tienen 33 partidas programadas y 5 cumplidas
- **THEN** el inicio muestra «Octubre 2026: 5 de 33 partidas realizadas» y una barra de progreso al 15 %

#### Scenario: Sin programas vigentes

- **WHEN** no hay ningún programa anual vigente
- **THEN** el inicio explica que no hay programas vigentes y ofrece un botón para importarlos desde el catálogo

### Requirement: Tarjetas accionables

El inicio SHALL mostrar tarjetas de vencidos, pendientes del mes, borradores abiertos y reportes en
revisión, cada una con su cantidad, icono y texto, que lleven a la lista correspondiente. Solo la
tarjeta de vencidos SHALL usar el color de peligro, y solo cuando su cantidad sea mayor que cero.

#### Scenario: Ir a los borradores

- **WHEN** el usuario elige la tarjeta «Borradores abiertos»
- **THEN** el sistema abre el historial filtrado por el estado Borrador

#### Scenario: Ir a los vencidos

- **WHEN** el usuario elige la tarjeta de vencidos
- **THEN** la lista del siguiente trabajo muestra solo los pendientes vencidos

#### Scenario: Sin vencidos

- **WHEN** no hay pendientes vencidos
- **THEN** la tarjeta de vencidos muestra 0 sin el color de peligro

### Requirement: Lista del siguiente trabajo

El inicio SHALL listar los pendientes de los programas vigentes ordenados por urgencia: primero los
vencidos, del mes más antiguo al más reciente, y después los pendientes del mes en curso. Cada elemento
SHALL mostrar el sitio, el número y la actividad de la partida, el mes y su estado con icono y texto.

#### Scenario: Orden por urgencia

- **WHEN** la partida 3 venció en junio, la partida 1 venció en agosto y la partida 7 está pendiente en octubre
- **THEN** la lista muestra primero la partida 3 de junio, luego la 1 de agosto y al final la 7 de octubre

#### Scenario: Más pendientes de los que caben

- **WHEN** hay más pendientes que los que la lista muestra
- **THEN** el sistema indica cuántos faltan por mostrar y ofrece verlos todos

### Requirement: Acción directa desde un pendiente

Cada pendiente SHALL ofrecer «Capturar», que abre la captura con contrato, sitio, partida y mes ya
elegidos. Si existe un borrador de esa partida y mes, la acción principal SHALL ser «Continuar
borrador», que abre ese borrador, y «Capturar» SHALL quedar como acción secundaria.

#### Scenario: Pendiente sin borrador

- **WHEN** el usuario elige «Capturar» en la partida 7 de octubre de 2026
- **THEN** el sistema abre la captura con el contrato, el sitio, la partida 7 y octubre de 2026 seleccionados

#### Scenario: Pendiente con borrador

- **WHEN** la partida 7 de octubre de 2026 ya tiene un borrador
- **THEN** su acción principal es «Continuar borrador» y abre el editor de ese borrador en un clic

#### Scenario: Partida semanal con un borrador

- **WHEN** una partida semanal tiene 4 ejecuciones programadas en el mes y un borrador de la semana 2
- **THEN** el pendiente ofrece «Continuar borrador» para la semana 2 y «Capturar» para las demás semanas

### Requirement: Inicio sin trabajo pendiente

Cuando no haya pendientes en los programas vigentes, el inicio SHALL decirlo de forma explícita y
SHALL ofrecer la acción que sigue (capturar un reporte no programado o revisar los borradores).

#### Scenario: Mes al día

- **WHEN** todas las partidas programadas del mes están cumplidas y no hay vencidos
- **THEN** el inicio indica que el trabajo programado está al día y ofrece ir a Capturar
