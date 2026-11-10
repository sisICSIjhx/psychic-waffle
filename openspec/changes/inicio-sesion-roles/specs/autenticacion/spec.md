# Spec Delta

## Purpose

Identificar a cada persona que usa ICSI Reportes con una cuenta propia de correo y contraseña, para
que el servidor sepa quién hace cada cosa y pueda limitar lo que ve y modifica.

## ADDED Requirements

### Requirement: Activación del inicio de sesión

Mientras no exista ninguna cuenta, la aplicación SHALL funcionar sin sesión, como antes de este
cambio, y SHALL ofrecer activar el inicio de sesión. La activación SHALL crear la cuenta de una
persona activa con rol administrador y correo, con la contraseña que esa persona escriba, y SHALL
dejarla con la sesión iniciada. La primera cuenta MUST ser de un administrador. Desde que existe una
cuenta, la activación SHALL dejar de estar disponible.

#### Scenario: Aplicación sin cuentas

- **WHEN** no hay ninguna cuenta y alguien abre cualquier página
- **THEN** la página se muestra sin pedir sesión y el menú ofrece «Activar inicio de sesión»

#### Scenario: Activar con un administrador

- **WHEN** se elige a un administrador activo con correo y se escribe una contraseña válida dos
  veces
- **THEN** se crea su cuenta, queda con la sesión iniciada y las demás personas ya necesitan sesión

#### Scenario: La primera cuenta no es de un administrador

- **WHEN** no hay cuentas y se intenta crear la de una persona con otro rol
- **THEN** se rechaza con «La primera cuenta debe ser de un administrador»

#### Scenario: Activación ya hecha

- **WHEN** ya existe una cuenta y alguien abre la página de activación
- **THEN** se le envía al inicio de sesión

### Requirement: Inicio de sesión con correo y contraseña

`/acceso` SHALL pedir correo y contraseña. El correo SHALL compararse sin distinguir mayúsculas ni
espacios en los extremos. Con credenciales correctas de una persona activa SHALL iniciarse la sesión
y SHALL abrirse la página que se pidió, o «Mi trabajo». Con un correo desconocido, una contraseña
incorrecta, una persona dada de baja o una persona sin cuenta, la respuesta SHALL ser el mismo
mensaje, «Correo o contraseña incorrectos», sin indicar cuál falló.

#### Scenario: Entrada correcta

- **WHEN** una persona activa escribe su correo y su contraseña
- **THEN** entra y ve «Mi trabajo», o la página a la que quería ir antes de que se le pidiera la
  sesión

#### Scenario: Credenciales incorrectas

- **WHEN** el correo no existe, o la contraseña no coincide, o la persona está dada de baja
- **THEN** se muestra «Correo o contraseña incorrectos» y no se inicia sesión

#### Scenario: Destino externo

- **WHEN** el destino pedido tras entrar no es una ruta de la aplicación
- **THEN** se ignora y se abre «Mi trabajo»

### Requirement: Protección contra intentos repetidos

Tras 5 contraseñas incorrectas seguidas, la cuenta SHALL quedar bloqueada 15 minutos; durante el
bloqueo ni la contraseña correcta inicia sesión, y el mensaje SHALL decir que hay que esperar. Una
entrada correcta SHALL reiniciar el contador. Los intentos desde una misma dirección de red SHALL
limitarse a 20 en 10 minutos, sea cual sea el correo.

#### Scenario: Bloqueo temporal

- **WHEN** se escribe 5 veces seguidas una contraseña incorrecta para la misma cuenta
- **THEN** la cuenta queda bloqueada 15 minutos y un sexto intento con la contraseña correcta se
  rechaza con el aviso de espera

#### Scenario: El contador se reinicia

- **WHEN** tras 3 intentos incorrectos la persona entra con la contraseña correcta
- **THEN** los intentos fallidos vuelven a cero

#### Scenario: Demasiados intentos desde una dirección

- **WHEN** desde la misma dirección de red se hacen más de 20 intentos en 10 minutos
- **THEN** los siguientes se rechazan con «Demasiados intentos. Espere unos minutos»

### Requirement: Sesión

La sesión SHALL identificarse con una cookie que el navegador no expone a los scripts de la página,
que solo viaja a este sitio y que exige HTTPS cuando el sitio se sirve por HTTPS. La sesión SHALL
caducar a los 7 días de iniciada o tras 12 horas sin uso. «Cerrar sesión» SHALL invalidarla de
inmediato en el servidor.

#### Scenario: Sesión caducada por inactividad

- **WHEN** pasan más de 12 horas sin que la persona use la aplicación
- **THEN** su siguiente petición se trata como sin sesión

#### Scenario: Cerrar sesión

- **WHEN** la persona pulsa «Cerrar sesión»
- **THEN** la sesión deja de valer aunque alguien conserve la cookie, y se muestra `/acceso`

### Requirement: Todo exige sesión

Con el inicio de sesión activado, toda página, acción, foto y documento SHALL exigir una sesión
válida, salvo `/acceso`. Sin sesión, la petición de una página SHALL llevar a `/acceso` recordando
el destino; cualquier otra petición SHALL responder 401 sin ejecutar nada.

#### Scenario: Página sin sesión

- **WHEN** alguien sin sesión abre `/historial?estado=emitido`
- **THEN** se le lleva a `/acceso` y, al entrar, vuelve a `/historial?estado=emitido`

#### Scenario: Acción sin sesión

- **WHEN** llega sin sesión el guardado de un reporte o la petición de una foto
- **THEN** la respuesta es 401 y no se guarda ni se entrega nada

### Requirement: Contraseña temporal desde Personal

Un administrador SHALL poder generar, desde la ficha de una persona activa con correo, una
contraseña temporal. La contraseña SHALL mostrarse una sola vez, al generarla, y SHALL sustituir a
la anterior y cerrar las sesiones abiertas de esa persona.

#### Scenario: Contraseña temporal

- **WHEN** el administrador pulsa «Generar contraseña temporal» en la ficha de una persona con
  correo
- **THEN** se muestra la contraseña una vez, la persona puede entrar con ella y sus sesiones
  anteriores dejan de valer

#### Scenario: Persona sin correo

- **WHEN** la persona no tiene correo
- **THEN** no se puede generar su contraseña y se indica que primero hay que registrar el correo

### Requirement: Estado y retiro del acceso

La ficha y la lista del personal SHALL indicar si la persona tiene cuenta, si debe cambiar su
contraseña y si está bloqueada. El administrador SHALL poder quitar el acceso de una persona, lo que
elimina su cuenta y cierra sus sesiones. Dar de baja a una persona SHALL cerrar sus sesiones. Una
persona con cuenta MUST conservar su correo.

#### Scenario: Quitar el acceso

- **WHEN** el administrador pulsa «Quitar acceso» en la ficha de una persona con cuenta
- **THEN** la persona ya no puede entrar, sus sesiones dejan de valer y la ficha indica «Sin cuenta»

#### Scenario: Baja con sesión abierta

- **WHEN** el administrador da de baja a una persona que tiene la sesión iniciada
- **THEN** la siguiente petición de esa persona se trata como sin sesión

#### Scenario: Quitar el correo a una persona con cuenta

- **WHEN** se guarda sin correo la ficha de una persona que tiene cuenta
- **THEN** se rechaza indicando que primero hay que quitarle el acceso

### Requirement: Cambio de contraseña

La persona SHALL poder cambiar su contraseña en «Mi perfil» escribiendo la actual y la nueva dos
veces. La contraseña SHALL tener entre 10 y 128 caracteres y MUST ser distinta del correo y de la
contraseña actual. Con una contraseña temporal, la persona SHALL ser llevada a cambiarla y no podrá
usar el resto de la aplicación hasta hacerlo. El cambio SHALL cerrar las demás sesiones de esa
persona y conservar la actual.

#### Scenario: Contraseña temporal

- **WHEN** una persona entra con una contraseña temporal y abre cualquier página
- **THEN** se le lleva a «Mi perfil» con el aviso de que debe cambiarla

#### Scenario: Cambio correcto

- **WHEN** escribe la contraseña actual y una nueva válida dos veces
- **THEN** la contraseña cambia, su sesión sigue abierta y sus otras sesiones se cierran

#### Scenario: Contraseña nueva no válida

- **WHEN** la nueva tiene menos de 10 caracteres, no coincide con su confirmación, es igual al
  correo o es igual a la actual
- **THEN** se rechaza con el motivo y la contraseña no cambia

### Requirement: Siempre queda un administrador con acceso

Con el inicio de sesión activado, el sistema MUST rechazar cualquier cambio que deje sin cuenta al
último administrador activo: quitarle el acceso, darlo de baja o cambiarle el rol. Si aun así no
quedara ninguno, la aplicación SHALL seguir exigiendo sesión.

#### Scenario: Último administrador

- **WHEN** solo un administrador activo tiene cuenta y se intenta quitarle el acceso, darlo de baja
  o cambiar su rol
- **THEN** se rechaza con «Debe quedar al menos un administrador con acceso»

### Requirement: Recuperación desde el servidor

Quien administra el servidor SHALL poder generar desde la consola una contraseña temporal para el
correo de una persona activa, sin sesión en la aplicación.

#### Scenario: Administrador sin contraseña

- **WHEN** el único administrador olvida su contraseña y se ejecuta `npm run cuenta -- --correo
<su correo>` en el servidor
- **THEN** se imprime una contraseña temporal con la que puede entrar

### Requirement: Custodia de las contraseñas

Las contraseñas MUST guardarse solo como un resumen irreversible con sal propia de cada cuenta, y
MUST NOT aparecer en registros, bitácora, respuestas ni mensajes de error. Los identificadores de
sesión MUST guardarse de forma que la base no permita reconstruir la cookie.

#### Scenario: Lectura de la base

- **WHEN** alguien lee las tablas de cuentas y sesiones
- **THEN** no encuentra contraseñas ni valores que sirvan como cookie de sesión
