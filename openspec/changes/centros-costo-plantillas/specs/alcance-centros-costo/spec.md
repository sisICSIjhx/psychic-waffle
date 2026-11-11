# Spec Delta

## Purpose

Limitar lo que cada persona ve y modifica a los centros de costo que tiene asignados, comprobado en
el servidor.

## ADDED Requirements

### Requirement: Centros de costo del personal

Cada persona con rol administrador, mesa directiva o contabilidad SHALL abarcar todos los centros de
costo sin asignación. Las demás SHALL llevar la lista de sus centros de costo, que puede estar
vacía; la ficha de personal SHALL permitir elegirlos y la lista del personal SHALL mostrarlos.

#### Scenario: Asignar centros de costo

- **WHEN** el administrador asigna EM-30184 y EM-30185 a un reporteador
- **THEN** la lista del personal muestra esos dos centros de costo en su fila

#### Scenario: Rol que abarca todo

- **WHEN** se guarda a alguien de contabilidad con centros de costo elegidos
- **THEN** se guarda sin asignaciones y la lista muestra «Todos los centros de costo»

### Requirement: Alcance de la consulta

Con el inicio de sesión activado, una persona con alcance limitado SHALL ver en «Mi trabajo», el
programa, el cumplimiento, la captura, el historial, el catálogo, los centros de costo y los equipos
solo los contratos, centros de costo, programas, partidas, reportes y equipos de sus centros de
costo; los filtros MUST NOT ofrecer contratos ni proyectos sin ninguno de sus centros de costo. Sin
inicio de sesión activado, todos SHALL ver todo, como antes.

#### Scenario: Historial limitado

- **WHEN** un reporteador con solo EM-30184 abre el historial
- **THEN** ve solo reportes de EM-30184 y el total de la paginación cuenta solo esos

#### Scenario: Sin centros de costo

- **WHEN** un reporteador sin centros de costo abre «Mi trabajo»
- **THEN** no ve trabajo y se le indica que pida al administrador sus centros de costo

### Requirement: Recursos fuera del alcance

Un reporte (con su documento y sus fotos), una partida, un contrato o un equipo de un centro de
costo ajeno SHALL responder 404 «No encontrado» a la carga y a sus acciones, sin revelar que existe.
Crear un reporte o ajustar el programa de una partida ajena MUST fallar aunque el formulario traiga
su identificador.

#### Scenario: Abrir un reporte ajeno

- **WHEN** un reporteador con solo EM-30184 abre la dirección de un reporte de EM-30167
- **THEN** recibe 404, igual que con un reporte inexistente

#### Scenario: Foto de un reporte ajeno

- **WHEN** pide la miniatura de una foto de ese reporte
- **THEN** recibe 404
