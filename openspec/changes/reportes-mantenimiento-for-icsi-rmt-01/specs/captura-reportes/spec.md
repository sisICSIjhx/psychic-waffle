# Spec Delta

## Purpose

Capturar el reporte de actividades con evidencia fotográfica FOR-ICSI-RMT-01 a partir del catálogo,
de modo que el técnico solo registre lo que cambia en cada ejecución: fotos, estados, observaciones y
conclusiones.

## ADDED Requirements

### Requirement: Selección guiada del reporte

Para crear un reporte, el usuario SHALL elegir contrato, sitio, partida y periodo (mes, y semana u
ocurrencia cuando la periodicidad sea menor a mensual). Si la partida tiene equipos asociados, también
SHALL elegir el TAG. Solo SHALL ofrecerse contratos vigentes y partidas del sitio elegido.

#### Scenario: Partida semanal

- **WHEN** el usuario elige la partida 15 semanal de Cerritos en mayo de 2026
- **THEN** el sistema pide la semana y titula el reporte con «SEMANA n»

#### Scenario: Acceso por cliente

- **WHEN** el usuario entra desde la vista Proagro
- **THEN** la selección muestra solo los contratos de ese cliente

### Requirement: Prellenado desde el catálogo

Al crear un reporte, el sistema SHALL copiar del catálogo y del contrato el usuario (cliente), el número de
contrato/OC, el sitio, el TAG, la periodicidad, el tipo de mantenimiento, los firmantes vigentes, el
objetivo, los alcances ejecutables, las herramientas y el texto base de las conclusiones. El título
SHALL componerse con el número de partida, la actividad, el mes y el año.

#### Scenario: Encabezado sin captura manual

- **WHEN** se crea el reporte de la partida 7 de Cerritos de mayo de 2026
- **THEN** el encabezado muestra cliente, contrato, «EM-30167 CERRITOS», periodicidad «Mensual» y el título «07.- TOMA DE POTENCIALES TUBO-SUELO. MAYO 2026», sin escribirlos

#### Scenario: Cambio posterior del catálogo

- **WHEN** se modifica el catálogo después de crear un borrador
- **THEN** el borrador conserva su contenido y el sistema ofrece aplicar los cambios del catálogo de forma explícita

### Requirement: Datos del encabezado validados

La fecha de ejecución SHALL ser una fecha completa dentro del periodo elegido. Ningún campo del encabezado
SHALL quedar con textos de relleno («Cambiar», «N/A» indebido o fecha parcial) al pasar a revisión.

#### Scenario: Fecha incompleta

- **WHEN** el usuario intenta enviar a revisión un reporte sin día de ejecución
- **THEN** el sistema impide el envío y señala el campo de fecha

### Requirement: Alcances con descripción y evidencia

Cada alcance del reporte SHALL tener título, descripción editable y una lista ordenada de fotografías con
pie de foto. La numeración «Ilustración 2.n.m» SHALL calcularse con la posición del alcance y de la foto,
y renumerarse al reordenar. El usuario SHALL poder agregar, quitar u ordenar alcances del reporte sin
alterar el catálogo.

#### Scenario: Reordenar fotografías

- **WHEN** el usuario mueve la tercera foto del alcance 2 al primer lugar
- **THEN** su pie pasa a «Ilustración 2.2.1» y las demás se renumeran en orden

#### Scenario: Disposición antes/durante/después

- **WHEN** la partida usa la disposición antes/durante/después
- **THEN** cada alcance ofrece tres espacios etiquetados ANTES, DURANTE y DESPUÉS

### Requirement: Carga de fotografías

El sistema SHALL aceptar imágenes JPEG, PNG y HEIC de hasta 15 MB cada una, en carga múltiple. SHALL
conservar el original, corregir la orientación y preparar una versión optimizada para el documento.
Rechazará otros formatos con un mensaje claro.

#### Scenario: Archivo no válido

- **WHEN** el usuario carga un PDF como fotografía
- **THEN** el sistema lo rechaza indicando los formatos aceptados y conserva las demás fotos cargadas

### Requirement: Tabla de verificación de alcances

Cualquier reporte, sin importar el cliente, SHALL poder incluir u omitir la tabla de verificación por
decisión del usuario. El valor inicial lo propone la partida. La tabla lista cada alcance ejecutable con
su estado (OK, No aplica o Con observación) y sus observaciones. El estado «Con observación» SHALL exigir
texto.

#### Scenario: Activar la tabla en otro cliente

- **WHEN** el usuario activa la tabla de verificación en un reporte de Cerritos cuya partida no la propone
- **THEN** el reporte la incluye con todos sus alcances ejecutables en estado pendiente

#### Scenario: Desactivar la tabla

- **WHEN** el usuario desactiva la tabla en un reporte que ya tenía estados capturados
- **THEN** el sistema pide confirmación, y el documento la omite; los estados se conservan si se vuelve a activar

#### Scenario: Observación obligatoria

- **WHEN** el usuario marca un alcance «Con observación» sin texto
- **THEN** el sistema impide enviarlo a revisión hasta capturar la observación

### Requirement: Herramientas y conclusiones

El reporte SHALL incluir la tabla de herramientas y equipo (cantidad y descripción), que se puede editar,
y una sección de conclusiones y recomendaciones que no puede quedar vacía al enviarse a revisión.

#### Scenario: Herramienta sin cantidad

- **WHEN** una herramienta del reporte no tiene cantidad
- **THEN** el sistema la acepta y la muestra sin cantidad en el documento

### Requirement: Autoguardado y conflictos

Mientras se edita un borrador, el sistema SHALL guardarlo automáticamente tras una breve pausa. Si otra
persona modificó el mismo reporte, SHALL detectar el conflicto y no sobrescribir sus cambios sin avisar.

#### Scenario: Edición simultánea

- **WHEN** dos usuarios editan el mismo borrador y el segundo guarda una versión anterior
- **THEN** el sistema rechaza ese guardado e indica que hay una versión más reciente

### Requirement: Estados del reporte

El reporte SHALL pasar por los estados Borrador, En revisión y Emitido. Solo se SHALL emitir un reporte que
cumpla todas las validaciones. Un reporte emitido no SHALL modificarse; para corregirlo se crea una nueva
revisión.

#### Scenario: Emisión

- **WHEN** un reporte en revisión cumple todas las validaciones y se emite
- **THEN** su estado pasa a Emitido, queda de solo lectura y cuenta como realizado en el programa anual

### Requirement: Historial de reportes

La vista Historial Global SHALL listar los reportes con paginación y filtros por cliente, contrato, sitio,
partida, TAG, periodo y estado, y permitir abrirlos o descargar su documento generado.

#### Scenario: Búsqueda por TAG

- **WHEN** el usuario filtra por «PSV-2001»
- **THEN** el historial muestra solo los reportes de ese equipo, del más reciente al más antiguo
