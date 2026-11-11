## ADDED Requirements

### Requirement: Seguimiento mensual según el centro de costo

El sistema MUST mostrar un mes y un centro autorizado con las actividades y conceptos de su
plantilla, además de las atenciones nocturnas de ese periodo.

#### Scenario: Centro con programa anual

- **WHEN** se abre un mes con una partida programada varias veces
- **THEN** cada ejecución prevista tiene su propia fila y sus conceptos por actividad
- **AND** el estado operativo y documental se guarda manualmente sin modificar el programa

#### Scenario: Centro con captura mensual

- **WHEN** se registra una actividad en un centro con origen mensual
- **THEN** la fila aparece en ese mes y permite registrar su ejecución y documentos

#### Scenario: Centro sin actividades

- **WHEN** la plantilla no tiene origen de actividades y define un estado de reporte mensual
- **THEN** se puede guardar pendiente, en proceso o hecho para ese mes

#### Scenario: Atención nocturna

- **WHEN** se guarda una atención con una fecha del mes y descripción
- **THEN** queda registrada en el centro seleccionado aunque este carezca de programa o plantilla

### Requirement: Marcado individual y en bloque

El sistema MUST permitir guardar una casilla en un clic y marcar como hechos los controles de una
actividad o de un mes en una sola operación.

#### Scenario: Marcado mensual

- **WHEN** un editor marca el mes completo
- **THEN** se marcan las ejecuciones y los conceptos de casilla o estado del centro y mes
- **AND** los valores de otros tipos, las carpetas y otros meses se conservan

### Requirement: Entregas de carpetas

El sistema MUST permitir guardar el estado de cada carpeta de la plantilla, la persona del
directorio que entrega, el nombre de quien recibe, la fecha y un enlace o archivo.

#### Scenario: Entrega completada

- **WHEN** se marca una carpeta como entregada
- **THEN** se requieren ambas personas, la fecha y un enlace HTTPS de SharePoint o un archivo

#### Scenario: Descarga de archivo

- **WHEN** alguien solicita el archivo de una carpeta de un centro que puede consultar
- **THEN** el sistema sirve el adjunto de esa carpeta y periodo

### Requirement: Alcance y permisos

El servidor MUST filtrar por centro de costo y permitir la edición operativa a administrador, líderes
y reporteador dentro de su alcance.

#### Scenario: Rol de consulta o centro fuera de alcance

- **WHEN** mesa directiva o contabilidad intenta modificar un seguimiento
- **THEN** el servidor rechaza la petición
- **AND** consultar, editar o descargar por una URL de un centro ajeno devuelve 404
