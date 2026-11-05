# Spec Delta

## ADDED Requirements

### Requirement: Módulo de equipos por proyecto

El menú principal SHALL incluir «Equipos» (`/equipos`). La página SHALL permitir elegir el proyecto
y SHALL listar los equipos de los sitios de sus contratos con las columnas del catálogo en Excel:
Equipo ID, nombre, marca/modelo, número de serie, rango, resolución, clase/tolerancia, ubicación,
propietario, responsable, crítico, estado, intervalo, última y próxima calibración, proveedor y
notas, además del sitio.

#### Scenario: Cambio de proyecto

- **WHEN** se elige el proyecto Proagro
- **THEN** la tabla muestra solo los equipos de los sitios de los contratos de Proagro

#### Scenario: Búsqueda y filtros

- **WHEN** se escribe «PIT» y se filtra por calibración vencida
- **THEN** solo quedan los equipos cuyo TAG, nombre, marca, serie o ubicación contienen «PIT» y
  cuya próxima calibración ya pasó

### Requirement: Calibración

Cada equipo SHALL guardar el intervalo en meses y las fechas de última y próxima calibración. Si la
próxima falta, SHALL calcularse como última + intervalo y mostrarse como calculada. El estado de
calibración SHALL ser vencida, por vencer (30 días o menos), vigente o sin fecha.

#### Scenario: Próxima calculada

- **WHEN** un equipo trimestral tiene última calibración el 2026-08-28 y no tiene próxima
- **THEN** su próxima calibración es el 2026-11-28, marcada como calculada

#### Scenario: Indicadores

- **WHEN** el proyecto tiene equipos vencidos y uno dado de baja vencido
- **THEN** el indicador «Calibración vencida» no cuenta el dado de baja y, al pulsarlo, la lista
  tampoco lo muestra

### Requirement: Alta, edición y eliminación

`/equipos/[id]` SHALL permitir el alta y la edición con un sitio del proyecto y todos los campos. El
TAG SHALL ser único por sitio y nombre. Eliminar SHALL rechazarse si el equipo está en una partida o
en un reporte.

#### Scenario: Mismo TAG con otro nombre

- **WHEN** se registra «E-LIT-1704 · Indicador magnético de nivel» en un sitio que ya tiene
  «E-LIT-1704 · Transmisor indicador de nivel»
- **THEN** se acepta

#### Scenario: Duplicado

- **WHEN** se registra otra vez el mismo TAG y nombre en el sitio, aunque cambien acentos o
  mayúsculas
- **THEN** se rechaza con el mensaje «Ya existe un equipo con ese TAG y nombre en el sitio»

#### Scenario: Equipo en uso

- **WHEN** se intenta eliminar un equipo asignado a una partida
- **THEN** se rechaza y se sugiere marcarlo «Dado de baja»

#### Scenario: La ficha del contrato no borra la calibración

- **WHEN** se edita el TAG desde la ficha del contrato
- **THEN** el equipo conserva su estado, intervalo y fechas de calibración

### Requirement: Importación y exportación

La página SHALL importar un Excel con los encabezados del catálogo en un sitio del proyecto, con una
revisión previa que no escribe, y SHALL exportar a CSV los equipos visibles con las mismas
columnas.

#### Scenario: Revisión

- **WHEN** se elige «Revisar» con el Excel
- **THEN** se muestran cuántos equipos son nuevos, cuántos se actualizan y qué filas se omiten, sin
  cambiar la base

#### Scenario: Importación repetida

- **WHEN** se importa dos veces el mismo Excel en el mismo sitio
- **THEN** la segunda vez todos los equipos se actualizan y no se crea ninguno

#### Scenario: Celdas combinadas

- **WHEN** una nota está combinada en tres filas
- **THEN** los tres equipos reciben la nota
