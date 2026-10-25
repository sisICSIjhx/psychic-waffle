# Spec Delta

## Purpose

Planear y dar seguimiento al programa anual de operación y mantenimiento de cada contrato y sitio,
comparando lo programado con lo realizado mes a mes a partir de los reportes emitidos, con los ajustes
(reprogramación y no ejecutado) que explican cada diferencia.

## ADDED Requirements

### Requirement: Reprogramación de lo programado

Amplía «Cantidades programadas por mes»: lo que falta de una partida y mes SHALL poder reprogramarse a
un mes posterior del mismo programa, con cantidad, motivo de la lista (cliente u operación, clima,
materiales o refacciones, acceso o permisos, personal u otro) y nota, obligatoria con «Otro». La
cantidad no SHALL superar lo que falta en el mes de origen y la cantidad programada original no SHALL
cambiar.

#### Scenario: Reprogramar a un mes posterior

- **WHEN** la partida 7 (mensual) de junio de 2026 no se ejecutó y se reprograma a octubre de 2026 con el motivo «Clima»
- **THEN** junio conserva 1 programado y muestra «Reprogramado → oct», y octubre muestra «+1 desde jun» con 2 por ejecutar

#### Scenario: Destino fuera del periodo

- **WHEN** el programa va de mayo de 2026 a abril de 2027 y se intenta reprogramar lo que falta de abril de 2027
- **THEN** el sistema no ofrece meses destino, rechaza la reprogramación e indica registrar «No ejecutado»

#### Scenario: Destino anterior al origen

- **WHEN** se intenta reprogramar lo que falta de agosto de 2026 a julio de 2026
- **THEN** el sistema rechaza la reprogramación porque el destino debe ser un mes posterior

#### Scenario: Cantidad mayor que lo que falta

- **WHEN** una partida semanal tiene 4 programadas en junio y 3 ejecutadas, y se intenta reprogramar 2
- **THEN** el sistema rechaza la reprogramación e indica que en junio solo falta 1

#### Scenario: Motivo «Otro» sin nota

- **WHEN** se reprograma con el motivo «Otro» y la nota vacía
- **THEN** el sistema rechaza la reprogramación y pide la nota

### Requirement: Registro de no ejecutado

Lo que falta de una partida y mes SHALL poder marcarse como «No ejecutado», con cantidad, motivo de la
misma lista que la reprogramación y nota, obligatoria con «Otro». La cantidad no SHALL superar lo que
falta. Lo no ejecutado deja de ser pendiente y cuenta como no ejecutado en los indicadores.

#### Scenario: Marcar no ejecutado

- **WHEN** la partida 12 de abril de 2027, último mes del periodo, se marca como no ejecutada con el motivo «Acceso o permisos»
- **THEN** la celda muestra «No ejecutado» con su motivo y la partida deja de aparecer como pendiente de abril

#### Scenario: No ejecutado mayor que lo que falta

- **WHEN** una partida tiene 1 programado en el mes, ya ejecutado, y se intenta marcar 1 como no ejecutado
- **THEN** el sistema rechaza el registro porque no falta nada en ese mes

### Requirement: Anulación de ajustes

Una reprogramación o un no ejecutado SHALL poder anularse; el registro se conserva con su fecha de
anulación y deja de contar. Justo después de registrar un ajuste, el sistema SHALL ofrecer «Deshacer».
Una reprogramación con reportes ligados en revisión o emitidos no SHALL anularse; al anularla, sus
borradores ligados quedan como trabajo propio del mes destino.

#### Scenario: Deshacer una reprogramación

- **WHEN** el usuario reprograma la partida 7 de junio a octubre y elige «Deshacer» en la notificación
- **THEN** la reprogramación queda anulada, junio vuelve a «Vencido» y octubre ya no muestra «+1 desde jun»

#### Scenario: Reprogramación con reporte emitido

- **WHEN** existe un reporte emitido ligado a la reprogramación de junio a octubre y se intenta anularla
- **THEN** el sistema rechaza la anulación e indica que ese reporte ya cubre la reprogramación

#### Scenario: Reprogramación con borrador

- **WHEN** existe un borrador ligado a la reprogramación de junio a octubre y el usuario confirma la anulación
- **THEN** la reprogramación queda anulada y el borrador sigue en octubre como trabajo propio de ese mes, como advertía el diálogo

### Requirement: Reporte de un trabajo reprogramado

Amplía «Realizado derivado de los reportes»: el reporte de un trabajo reprogramado SHALL crearse en el
mes destino y ligarse a su reprogramación, y sus ejecuciones SHALL contarse aparte de las del trabajo
propio de ese mes. El vínculo SHALL exigir la misma partida, el mes destino y una reprogramación
vigente, y SHALL conservarse en las revisiones.

#### Scenario: Mes destino con su propia ocurrencia

- **WHEN** la partida 7 (mensual) tiene 1 programado en octubre y 1 reprogramado desde junio, y se emiten el reporte de octubre y el ligado a la reprogramación
- **THEN** octubre cuenta 2 ejecuciones y queda «Con reporte», y junio muestra «Reprogramado → oct»

#### Scenario: Elegir la reprogramación al capturar

- **WHEN** el usuario captura la partida 7 de octubre y existe una reprogramación desde junio sin cubrir
- **THEN** la captura ofrece «Trabajo de octubre» o «Reprogramado desde junio 2026», y el editor del reporte creado muestra el vínculo

#### Scenario: Reporte de otro mes

- **WHEN** se intenta ligar un reporte de noviembre a la reprogramación con destino octubre
- **THEN** el sistema rechaza el vínculo

#### Scenario: Revisión de un reporte ligado

- **WHEN** se crea y se emite una revisión del reporte emitido ligado a la reprogramación
- **THEN** la revisión conserva el vínculo y octubre sigue contando 2 ejecuciones

### Requirement: Estado de ejecución por partida y mes

Amplía «Consulta del avance» y sustituye sus estados: cada partida y mes SHALL tener un estado de
ejecución: Programado (mes futuro), Pendiente (mes en curso), Vencido (mes terminado), Reprogramado
(con el mes destino), No ejecutado, Ejecutado o Realizado sin programar. Lo que falta SHALL ser lo
programado más lo que llega reprogramado, menos lo que sale reprogramado, lo ejecutado y lo no
ejecutado; ejecutado incluye los reportes emitidos y los realizados sin reporte.

#### Scenario: Vencido

- **WHEN** termina junio y la partida 3, programada en junio, no tiene ejecuciones ni ajustes
- **THEN** la celda de junio muestra «Vencido»

#### Scenario: Programado y pendiente

- **WHEN** hoy es el 21 de octubre de 2026 y la partida 7 tiene 1 programado sin ejecutar en octubre y en noviembre
- **THEN** octubre muestra «Pendiente» y noviembre «Programado»

#### Scenario: Reprogramado por completo

- **WHEN** lo programado de junio se reprogramó entero a octubre
- **THEN** junio muestra «Reprogramado → oct» y no cuenta como vencido

#### Scenario: Ejecución parcial con no ejecutado

- **WHEN** una partida semanal tiene 4 programadas en junio, 3 ejecutadas y 1 marcada como no ejecutada
- **THEN** la celda muestra «No ejecutado» con el detalle «3 de 4 ejecutadas»

#### Scenario: Ejecutado con un realizado sin reporte

- **WHEN** una partida programada en mayo tiene un realizado registrado manualmente
- **THEN** la celda de mayo muestra «Ejecutado»

#### Scenario: Realizado sin programar

- **WHEN** se emite un reporte de una partida en un mes sin nada programado ni reprogramado
- **THEN** la celda muestra «Realizado sin programar»

### Requirement: Estado documental por partida y mes

Cada partida y mes con algo por ejecutar o ejecutado SHALL tener un estado documental: «Con reporte»
cuando los reportes emitidos cubren lo esperado (lo programado ajustado menos lo no ejecutado),
«Reporte en borrador» cuando no lo cubren y hay reportes en borrador o en revisión (la etiqueta SHALL
decir «en revisión» si hay alguno) y «Sin reporte» en otro caso. «Con reporte» SHALL ser el estado
final.

#### Scenario: Con reporte

- **WHEN** la partida 7 tiene 1 por ejecutar en octubre y se emite su reporte
- **THEN** la celda de octubre muestra «Con reporte» como estado final

#### Scenario: Reporte en revisión

- **WHEN** la partida 7 de octubre tiene un reporte en revisión y ninguno emitido
- **THEN** la celda muestra «Reporte en borrador (en revisión)»

#### Scenario: Ejecutado sin reporte

- **WHEN** la partida 7 de mayo está cubierta solo por un realizado manual
- **THEN** la celda muestra «Ejecutado» y «Sin reporte»

#### Scenario: Mes sin nada que reportar

- **WHEN** lo programado de junio se reprogramó entero a octubre
- **THEN** junio no muestra estado documental y el reporte se espera en octubre

### Requirement: Matriz anual con estados y ajustes

Amplía «Consulta del avance»: la matriz anual P/R SHALL seguir siendo la vista por omisión de
Planeación, con una leyenda de los estados de ejecución y documentales. Cada celda SHALL mostrar ambos
estados con símbolo y texto (no solo color) y lo que entra o sale reprogramado, y SHALL ofrecer
«Reprogramar» y «No ejecutado» cuando falte algo en ella.

#### Scenario: Vista por omisión

- **WHEN** el usuario abre Planeación sin elegir vista
- **THEN** el sistema muestra la matriz anual con la leyenda de ambos ejes

#### Scenario: Reprogramar desde la celda

- **WHEN** el usuario elige «Reprogramar» en la partida 7 de junio
- **THEN** un diálogo muestra lo que falta, los meses destino posteriores del periodo, el motivo y la nota, con el foco inicial en «Cancelar», y al confirmar la celda se actualiza y aparece «Deshacer»

#### Scenario: Nombre accesible de la celda

- **WHEN** un lector de pantalla llega a la celda de la partida 7 de octubre de 2026
- **THEN** escucha la partida, el mes, lo programado, lo ejecutado, el estado de ejecución y el documental

#### Scenario: Celda sin faltante

- **WHEN** una celda ya tiene ejecutado todo lo esperado
- **THEN** la celda no ofrece «Reprogramar» ni «No ejecutado»

### Requirement: Vista mensual de la planeación

Planeación SHALL ofrecer una vista mensual, elegible junto a la anual, que liste para un contrato,
sitio y mes las partidas con algo programado, reprogramado, ejecutado o en borrador, con ambos estados
y las acciones «Capturar» o «Continuar borrador», «Reprogramar» y «No ejecutado». SHALL permitir pasar
al mes anterior o siguiente dentro del periodo y conservar los filtros.

#### Scenario: Abrir la vista mensual

- **WHEN** el usuario elige «Mensual» en Planeación el 21 de octubre de 2026
- **THEN** la vista muestra octubre de 2026 con sus partidas, cada una con lo que falta y sus dos estados

#### Scenario: Continuar un borrador

- **WHEN** la partida 7 de octubre tiene un borrador
- **THEN** su acción principal es «Continuar borrador» y abre ese borrador

#### Scenario: Límite del periodo

- **WHEN** la vista mensual muestra el último mes del periodo
- **THEN** la acción de pasar al mes siguiente no está disponible

#### Scenario: Filtros conservados

- **WHEN** el usuario filtra por periodicidad semanal y cambia de la vista anual a la mensual
- **THEN** la vista mensual muestra solo las partidas semanales

### Requirement: Vista semanal de la planeación

En una segunda fase, Planeación SHALL ofrecer una vista semanal con semanas de lunes a domingo dentro
del mes, como las ocurrencias de la captura. Las partidas semanales y quincenales SHALL mostrar el
reporte de la ocurrencia de la semana; las diarias, los días cubiertos; y las demás, los reportes con
días de ejecución en la semana, junto con lo que falta en el mes. No SHALL inferirse una semana
planeada.

#### Scenario: Semana parcial al inicio del mes

- **WHEN** el usuario abre la semana 1 de mayo de 2026
- **THEN** la vista abarca del 1 al 3 de mayo

#### Scenario: Partida semanal

- **WHEN** una partida semanal tiene un reporte emitido de la semana 2 de mayo
- **THEN** la semana 2 muestra esa partida «Con reporte» y el resumen del mes indica lo que falta

#### Scenario: Partida diaria

- **WHEN** los reportes emitidos de una partida diaria cubren 5 de los 7 días de la semana
- **THEN** la vista muestra «5 de 7 días» para esa partida

#### Scenario: Partida mensual sin ejecutar

- **WHEN** una partida mensual no tiene días de ejecución en la semana y sigue pendiente en el mes
- **THEN** la vista la muestra como «Pendiente en el mes» sin marcar vencida la semana

### Requirement: Pendientes que consideran los ajustes

Amplía «Avance del mes» y «Lista del siguiente trabajo» (`mi-trabajo`) y «Partidas agrupadas por el
trabajo pendiente» (`captura-reportes`), los tres del cambio `ux-editor-inicio-captura`: pendientes y
vencidos SHALL calcularse con lo que falta según los ajustes. Lo
reprogramado SHALL aparecer como pendiente en el mes destino y no en el de origen, y lo no ejecutado
no SHALL aparecer como pendiente. El avance del mes SHALL contar como programadas las partidas con algo
por ejecutar en el mes.

#### Scenario: Reprogramado en Mi trabajo

- **WHEN** la partida 3 de junio se reprogramó a octubre y hoy es el 21 de octubre de 2026
- **THEN** «Mi trabajo» no la muestra como vencida de junio y la muestra pendiente en octubre

#### Scenario: No ejecutado en la captura

- **WHEN** la única celda vencida de la partida 12 se marcó como no ejecutada
- **THEN** la captura coloca la partida en «Otras partidas» y no sugiere ese mes

#### Scenario: Avance del mes con un no ejecutado

- **WHEN** en octubre hay 33 partidas con algo por ejecutar, 5 ejecutadas y 1 marcada como no ejecutada
- **THEN** el inicio muestra «Octubre 2026: 5 de 33 partidas realizadas» y 27 pendientes del mes
