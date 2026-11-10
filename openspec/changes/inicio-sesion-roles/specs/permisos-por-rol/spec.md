# Spec Delta

## Purpose

Definir qué puede consultar y modificar cada rol del personal, y hacer que el servidor lo compruebe
en cada petición en lugar de confiar en lo que la pantalla muestra u oculta.

## ADDED Requirements

### Requirement: Roles

El personal SHALL tener uno de seis roles: administrador, líder administrativo, líder operativo,
reporteador, mesa directiva y contabilidad. Administrador, mesa directiva y contabilidad SHALL
abarcar todos los proyectos sin asignación; los demás SHALL llevar la lista de sus proyectos.

#### Scenario: Rol sin proyectos asignables

- **WHEN** se elige el rol mesa directiva o contabilidad en la ficha de una persona
- **THEN** la lista de proyectos se deshabilita y se indica que el rol abarca todos

### Requirement: Consulta

Con el inicio de sesión activado, toda persona con sesión, sea cual sea su rol, SHALL poder
consultar «Mi trabajo», el programa, el cumplimiento, el historial, los reportes con sus fotos y
documentos, el catálogo y los equipos, y SHALL poder ver «Mi perfil» y cambiar su contraseña.

#### Scenario: Mesa directiva consulta

- **WHEN** alguien de mesa directiva abre el historial, un reporte emitido y su documento
- **THEN** los ve, y no se le ofrece capturar ni editar

### Requirement: Captura de reportes

Capturar, editar, enviar a revisión, emitir y revisar reportes, con sus fotos, SHALL estar
permitido al administrador, a los líderes administrativo y operativo y al reporteador. Mesa
directiva y contabilidad MUST NOT poder hacerlo.

#### Scenario: Reporteador captura

- **WHEN** un reporteador crea un reporte y lo guarda
- **THEN** se guarda

#### Scenario: Contabilidad intenta capturar

- **WHEN** alguien de contabilidad envía la creación de un reporte
- **THEN** el servidor responde 403 y no se crea

### Requirement: Ajuste del programa

Registrar ejecuciones, reprogramar y marcar como no ejecutado en el programa SHALL estar permitido
al administrador y a los líderes administrativo y operativo. Los demás roles MUST NOT poder
hacerlo.

#### Scenario: Reporteador ajusta el programa

- **WHEN** un reporteador envía un ajuste del programa
- **THEN** el servidor responde 403 y el programa no cambia

### Requirement: Edición del catálogo

Editar contratos, centros de costo, partidas, firmantes, alcances predeterminados y equipos SHALL
estar permitido solo al administrador.

#### Scenario: Líder edita el catálogo

- **WHEN** un líder operativo envía la corrección de un contrato
- **THEN** el servidor responde 403 y el contrato no cambia

### Requirement: Personal

Consultar el personal SHALL estar permitido al administrador y a mesa directiva. Dar de alta,
editar, dar de baja y administrar las cuentas SHALL estar permitido solo al administrador.

#### Scenario: Contabilidad abre el personal

- **WHEN** alguien de contabilidad abre `/personal`
- **THEN** el servidor responde 403

#### Scenario: Mesa directiva abre una ficha

- **WHEN** alguien de mesa directiva ve la lista del personal e intenta abrir la ficha de edición
- **THEN** ve la lista sin el enlace «Editar», y la ficha responde 403

### Requirement: Comprobación en el servidor

Toda petición que modifica datos SHALL comprobar en el servidor la capacidad que le corresponde
antes de ejecutar nada. Una petición que modifica datos en una ruta sin capacidad declarada SHALL
permitirse solo al administrador. La respuesta a quien no tiene la capacidad SHALL ser 403.

#### Scenario: Petición directa

- **WHEN** alguien de mesa directiva envía directamente al servidor el guardado de un reporte, sin
  pasar por la pantalla
- **THEN** la respuesta es 403 y el reporte no cambia

#### Scenario: Ruta nueva sin declarar

- **WHEN** llega una modificación a una ruta que no declara su capacidad y la persona no es
  administrador
- **THEN** la respuesta es 403

### Requirement: Menú según el rol

El menú SHALL mostrar solo los destinos que el rol puede usar: «Capturar», «Capturar en» y «Nuevo
reporte» solo con la capacidad de capturar, y «Personal» solo con la de consultarlo. El menú SHALL
mostrar el nombre y el rol de la persona, «Mi perfil» y «Cerrar sesión».

#### Scenario: Menú de mesa directiva

- **WHEN** entra alguien de mesa directiva
- **THEN** el menú no muestra «Capturar», «Capturar en» ni «Nuevo reporte», y sí «Personal»

### Requirement: Compatibilidad sin inicio de sesión

Mientras el inicio de sesión no esté activado, todas las capacidades SHALL estar permitidas a
cualquiera, como antes de este cambio.

#### Scenario: Sin activar

- **WHEN** no hay cuentas y alguien edita el catálogo
- **THEN** el cambio se guarda y la bitácora lo registra sin usuario

### Requirement: Autoría tomada de la sesión

El usuario que la bitácora del catálogo registra SHALL salir de la sesión validada por el servidor,
nunca de un dato de la petición.

#### Scenario: Corrección del catálogo con sesión

- **WHEN** un administrador con sesión corrige un contrato
- **THEN** la bitácora guarda su nombre y su identificador, aunque el formulario traiga otros
