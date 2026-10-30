# Spec Delta

## ADDED Requirements

### Requirement: Alta y edición de personal

`/personal` SHALL listar al personal con nombre completo, rol, proyectos y estado, y
`/personal/[id]` SHALL permitir el alta y la edición con nombre, apellido paterno, apellido materno
(opcional), fecha de nacimiento, correo (opcional), rol y proyectos. Los roles SHALL ser
administrador, líder administrativo, líder operativo y reporteador (solo genera reportes).

#### Scenario: Alta de un reporteador

- **WHEN** se registra una persona con rol reporteador y el proyecto Proagro
- **THEN** aparece en la lista con el rol «Reporteador», el proyecto Proagro y estado activo

#### Scenario: Sin proyecto

- **WHEN** se intenta guardar a un líder operativo sin proyectos
- **THEN** se rechaza con el mensaje «Asigne al menos un proyecto»

#### Scenario: Administrador

- **WHEN** se guarda a un administrador sin proyectos
- **THEN** se acepta y la lista muestra «Todos los proyectos»

#### Scenario: Fecha de nacimiento inválida

- **WHEN** la fecha de nacimiento es posterior a hoy o anterior a 1900
- **THEN** se rechaza con el mensaje «Fecha de nacimiento fuera de rango»

### Requirement: Baja lógica

El personal SHALL darse de baja marcándolo inactivo y SHALL poder reactivarse; no SHALL eliminarse.

#### Scenario: Dar de baja

- **WHEN** se marca inactiva a una persona y se guarda
- **THEN** la lista la muestra como «Inactivo» y conserva sus datos
