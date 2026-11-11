# Spec Delta

## Purpose

Registrar los centros de costo de ICSI, con o sin contrato, y la plantilla de seguimiento que aplica
cada uno, como base del seguimiento operativo, del contrato y de la cobranza.

## ADDED Requirements

### Requirement: Lista de centros de costo

`/catalogo/centros-costo` SHALL listar cada centro de costo visible para quien consulta con su
clave, su nombre, los contratos asociados (o «Sin contrato»), su plantilla (o «Sin plantilla») y
cuántas personas tiene asignadas. Cuando la plantilla exige contrato y el centro de costo no tiene
ninguno, la fila SHALL mostrar «Contrato pendiente».

#### Scenario: Centro de costo sin contrato

- **WHEN** existe un centro de costo sin contratos cuya plantilla tiene el modo «sin contrato»
- **THEN** la lista lo muestra con «Sin contrato» y sin aviso

#### Scenario: Contrato pendiente

- **WHEN** un centro de costo sin contratos usa una plantilla con el modo «obligatorio»
- **THEN** la fila muestra «Contrato pendiente»

### Requirement: Alta y edición de centros de costo

Quien puede editar el catálogo SHALL poder dar de alta un centro de costo con clave, nombre y
plantilla opcional, sin contrato, y SHALL poder cambiar su nombre y su plantilla. La clave SHALL ser
única sin distinguir mayúsculas, acentos ni espacios repetidos. Quien no puede editar el catálogo
MUST NOT poder hacerlo, aunque envíe el formulario.

#### Scenario: Alta

- **WHEN** el administrador da de alta «EM-90001» con nombre «Centro de prueba» y una plantilla
- **THEN** aparece en la lista sin contrato y con esa plantilla

#### Scenario: Clave repetida

- **WHEN** se da de alta «em-90001 » y ya existe «EM-90001»
- **THEN** se rechaza con «Ya existe un centro de costo con esa clave»

#### Scenario: Sin permiso

- **WHEN** un reporteador envía el formulario de alta
- **THEN** recibe 403 y no se guarda nada

### Requirement: Carga de centros de costo desde un archivo

`npm run importar:centros -- <archivo>` SHALL leer un JSON de plantillas y centros de costo, dar
de alta las plantillas nuevas por nombre y los centros nuevos por clave, y asignar la plantilla a
los centros existentes sin una. MUST NOT modificar plantillas existentes ni una plantilla ya
asignada. Por omisión SHALL ser un ensayo; con `--aplicar` SHALL guardar todo o nada.

#### Scenario: Ensayo

- **WHEN** se ejecuta sin `--aplicar` con 2 plantillas nuevas, 3 centros nuevos y 1 centro existente
  sin plantilla
- **THEN** informa 2 plantillas nuevas, 3 centros nuevos y 1 centro con plantilla asignada, y no
  guarda nada

#### Scenario: Plantilla desconocida

- **WHEN** un centro de costo del archivo nombra una plantilla que no está ni en el archivo ni en la
  base
- **THEN** esa fila se informa como no válida y, con `--aplicar`, no se guarda nada
