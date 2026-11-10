# Spec Delta

## Purpose

Mantener el directorio de las personas de ICSI que usan el sistema o aparecen en él, con los datos
mínimos para identificarlas, asignarles un rol y darles una cuenta.

## ADDED Requirements

### Requirement: Sede y fecha de nacimiento opcional

Cada persona SHALL poder llevar su sede (texto libre, opcional). La fecha de nacimiento SHALL ser
opcional; si se indica, SHALL estar entre 1900 y hoy.

#### Scenario: Alta sin fecha de nacimiento

- **WHEN** se da de alta a una persona con nombre, apellido paterno, rol y sede, sin fecha de
  nacimiento
- **THEN** se guarda, y la lista muestra su sede

#### Scenario: Fecha fuera de rango

- **WHEN** se indica una fecha de nacimiento posterior a hoy
- **THEN** se rechaza con «Fecha de nacimiento fuera de rango»

### Requirement: Personas sin proyectos

Una persona con un rol que usa proyectos SHALL poder guardarse sin ninguno asignado. La ficha SHALL
avisar de que, sin proyectos, no tendrá ninguno cuando el acceso por centro de costo se aplique.

#### Scenario: Reporteador sin proyectos

- **WHEN** se guarda a un reporteador sin elegir proyectos
- **THEN** se guarda y la lista muestra «Sin proyectos»

### Requirement: Carga del personal desde un archivo

`npm run importar:personal -- <archivo>` SHALL leer un archivo de texto con una persona por línea
(nombre completo, sede y correo, separados por tabulador, punto y coma o coma) y SHALL dar de alta a
quienes no estén registrados, con rol reporteador, activos, sin proyectos y sin cuenta. Por omisión
SHALL hacer un ensayo que muestra lo que haría sin guardar; con `--aplicar` SHALL guardar todas las
líneas válidas o ninguna.

#### Scenario: Ensayo

- **WHEN** se ejecuta sin `--aplicar` con un archivo de 3 personas, una ya registrada
- **THEN** informa 2 nuevas y 1 existente, muestra cómo dividió cada nombre y no guarda nada

#### Scenario: Aplicar

- **WHEN** se ejecuta con `--aplicar` el mismo archivo
- **THEN** las 2 personas nuevas aparecen en `/personal` como reporteadores activos, sin proyectos y
  sin cuenta

### Requirement: División del nombre completo

La carga SHALL dividir el nombre completo en nombre, apellido paterno y apellido materno tomando
como apellidos los dos últimos, cada uno con sus partículas («de», «del», «de la», «de los», «de
las»). Con solo dos palabras, la segunda SHALL ser el apellido paterno.

#### Scenario: Apellido con partículas

- **WHEN** el nombre completo es «ANA DEL CARMEN RUIZ LÓPEZ» o «JUAN PABLO DE LA TORRE SALAS»
- **THEN** se dividen en «ANA DEL CARMEN» + «RUIZ» + «LÓPEZ» y en «JUAN PABLO» + «DE LA TORRE» +
  «SALAS»

#### Scenario: Un solo apellido

- **WHEN** el nombre completo es «LUIS RAMOS»
- **THEN** se divide en «LUIS» + «RAMOS», sin apellido materno

### Requirement: Personas existentes y líneas no válidas

Una persona cuyo correo ya está registrado SHALL omitirse sin modificarla. Una línea sin nombre y
apellido, con un correo no válido o con un correo repetido en el archivo SHALL informarse y no SHALL
cargarse.

#### Scenario: Aplicar dos veces

- **WHEN** se aplica el mismo archivo por segunda vez
- **THEN** no se duplica a nadie: todas las personas se informan como existentes

#### Scenario: Correo no válido

- **WHEN** una línea trae un correo sin dominio
- **THEN** esa línea se informa como no válida y las demás se cargan
