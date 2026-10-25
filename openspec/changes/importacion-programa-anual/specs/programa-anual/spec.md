# Spec Delta

## Purpose

Planear y dar seguimiento al programa anual de operación y mantenimiento de cada contrato y sitio,
comparando lo programado con lo realizado mes a mes a partir de los reportes emitidos.

## ADDED Requirements

### Requirement: Importación de un programa anual sin catálogo

El sistema SHALL importar como programa anual del contrato y sitio elegidos un libro .xlsx sin hoja de
catálogo cuya hoja traiga partidas en filas P/R bajo una fila de meses. Amplía «Importación del
catálogo desde Excel» (`catalogo-contratos`, cambio `reportes-mantenimiento-for-icsi-rmt-01`): un libro
con hoja de catálogo SHALL importarse como hasta ahora. Antes de guardar SHALL mostrarse un ensayo, y
aplicar SHALL ser todo o nada.

#### Scenario: Libro de programa de Proagro

- **WHEN** se revisa «PROGRAMA ANUAL 2026 PROAGROS 1.xlsx», de una sola hoja «ANUAL 2026», para el sitio EM-30184
- **THEN** el sistema lo reconoce como programa anual y muestra el ensayo sin guardar nada

#### Scenario: Reimportación sin cambios

- **WHEN** se revisa otra vez, para el mismo sitio, un libro ya aplicado
- **THEN** el ensayo informa que no hay cambios y no duplica programas, meses ni realizados

#### Scenario: Libro sin estructura reconocible

- **WHEN** el libro no tiene hoja de catálogo ni una hoja con fila de meses y columna P/R
- **THEN** el sistema rechaza el archivo, describe las dos estructuras aceptadas y no guarda cambios

#### Scenario: Falla al aplicar

- **WHEN** una de las partidas no se puede guardar al aplicar
- **THEN** no queda guardado ningún cambio del programa, de sus meses ni de las partidas

### Requirement: Bloque del sitio elegido

Si un libro de programa trae varios sitios, el sistema SHALL importar solo el bloque del sitio
elegido. Un bloque empieza en una fila separadora que nombra una sola clave «ERM nnnnn» o «EM-nnnnn».
Las filas anteriores a la primera separadora SHALL pertenecer a la primera clave de las filas de
encabezado que no tenga separadora propia. La clave SHALL compararse con la del sitio sin importar el
prefijo ERM o EM.

#### Scenario: Segundo sitio del libro

- **WHEN** se revisa el libro de Proagro para EM-30185
- **THEN** el ensayo incluye solo las 25 partidas posteriores a la separadora «(ERM 30185)» de la fila 73

#### Scenario: Primer bloque sin separadora

- **WHEN** se revisa el libro de Proagro para EM-30184, cuyo encabezado nombra «(ERM 30184)» y «(ERM 30185)»
- **THEN** el ensayo incluye las 31 partidas de las filas 11 a 71 y ninguna de EM-30185

#### Scenario: Sitio sin bloque en el libro

- **WHEN** se revisa el libro de Proagro para el sitio EM-30167
- **THEN** el sistema rechaza el archivo e indica que el libro solo trae EM-30184 y EM-30185

#### Scenario: Libro sin claves de sitio

- **WHEN** el libro no nombra ninguna clave de sitio
- **THEN** todas sus partidas se importan al sitio elegido

#### Scenario: Filas sin sitio determinable

- **WHEN** hay partidas antes de la primera separadora y el encabezado no permite saber a qué sitio pertenecen
- **THEN** el sistema rechaza el archivo e indica las filas sin sitio

#### Scenario: Número repetido dentro del bloque

- **WHEN** el bloque del sitio elegido trae dos filas P con el número de partida 7
- **THEN** el sistema rechaza el archivo e indica las dos filas, sin quedarse con una de ellas

### Requirement: Columnas del programa por cabecera o por posición

El sistema SHALL ubicar el número, la actividad, la cantidad anual, la periodicidad y la marca P/R por
el texto de sus cabeceras. Si las cabeceras no tienen texto, SHALL tomarlas por posición: la columna
P/R es la que alterna «P» y «R» antes del primer mes, y las cuatro anteriores son, en orden, número,
actividad, cantidad anual y periodicidad. Si los valores no corresponden, SHALL rechazar el libro.

#### Scenario: Cabecera combinada sin texto

- **WHEN** la cabecera B8:F9 del libro de Proagro está combinada y sin texto
- **THEN** el sistema toma B como número, C como actividad, D como cantidad anual, E como periodicidad y F como P/R

#### Scenario: Columna con valores de otro tipo

- **WHEN** la columna que corresponde a la periodicidad trae números
- **THEN** el sistema rechaza el archivo e indica la hoja y la columna

#### Scenario: Periodicidad no reconocida

- **WHEN** una partida del bloque trae la periodicidad «QUINQUENAL»
- **THEN** el sistema rechaza el archivo e indica la fila, la partida y el valor

### Requirement: Meses y periodo del programa importado

La fila de meses SHALL ser la primera, sobre las partidas, con al menos dos nombres de mes con o sin
año. Sin año, el año inicial SHALL tomarse del título «PROGRAMA ANUAL AAAA» o indicarse al importar,
y SHALL aumentar cuando un mes es anterior al previo. Cada mes SHALL abarcar todo su rango combinado.
Los meses ocultos no SHALL formar parte del programa, cuyo periodo va del primer día del primer mes
visible al último día del último.

#### Scenario: Meses sin año

- **WHEN** la fila 8 trae ENERO a DICIEMBRE, ENERO y FEBRERO, el título dice «PROGRAMA ANUAL 2026» y enero y febrero de 2026 están ocultos
- **THEN** el programa va del 2026-03-01 al 2027-02-28, con doce meses de «Marzo 2026» a «Febrero 2027»

#### Scenario: Marcas en columnas ocultas

- **WHEN** una partida tiene marcas en las columnas ocultas G a O
- **THEN** esas marcas no cuentan y una advertencia indica cuántas se ignoraron y en qué partidas

#### Scenario: Marca en la última columna del último mes

- **WHEN** una partida mensual tiene su marca de febrero de 2027 en BP, la última de las cuatro columnas combinadas de ese mes
- **THEN** febrero de 2027 cuenta como programado y la partida suma 12

#### Scenario: Año desconocido

- **WHEN** los meses no traen año, el título no lo indica y no se da al importar
- **THEN** el sistema rechaza el archivo e indica que falta el año del programa

### Requirement: Cantidad programada según las marcas

Una celda de mes SHALL contar como marcada si tiene relleno sólido no blanco o el texto X, P, R o un
número. En las semanales y quincenales, la cantidad del mes SHALL ser el número de columnas marcadas;
en las diarias, los días del mes; en las demás, 1 por mes marcado. Las «Cuando aplique» SHALL quedar
sin cantidad. Otros valores no SHALL contar y SHALL generar una advertencia.

#### Scenario: Semanal según sus marcas

- **WHEN** la partida semanal 30184-1 tiene 5 columnas marcadas en abril de 2026 y 4 en mayo
- **THEN** abril tiene 5 programadas y mayo 4, sin repartir por los lunes del mes

#### Scenario: Mensual con una marca por mes

- **WHEN** la partida mensual 30184-4 tiene una marca en la última semana de cada mes
- **THEN** cada mes del periodo tiene 1 programada

#### Scenario: Relleno blanco

- **WHEN** diciembre de 2026 de la partida 30185-14 solo tiene relleno blanco
- **THEN** diciembre no queda programado

#### Scenario: Valor no reconocido

- **WHEN** la fila R de la partida 30185-2 trae «.» en septiembre de 2026
- **THEN** no cuenta como realizado y una advertencia indica el sitio, la partida, la fila R y el mes

#### Scenario: Dos marcas en un mes de una partida mensual

- **WHEN** una partida mensual tiene dos columnas marcadas en el mismo mes
- **THEN** ese mes tiene 1 programada y una advertencia lo indica

### Requirement: Datos que actualiza la importación de programa

Al aplicar, el sistema SHALL crear o actualizar el programa y, en cada partida del bloque, cambiar solo
la periodicidad y la cantidad anual y reemplazar sus meses programados. La actividad SHALL cambiar solo
en las partidas elegidas, y el estado del catálogo solo si se pide confirmar. Alcances, entregas,
requisitos, materiales, homologados, distribución, notas y normas no SHALL cambiar: no se confirma ni
reemplaza todo como en la importación del catálogo.

#### Scenario: Partida por confirmar actualizada

- **WHEN** se aplica el programa de EM-30184 y su partida 3 está registrada como mensual, sin cantidad anual y «por confirmar»
- **THEN** queda trimestral con cantidad 4, programada en marzo, junio, septiembre y diciembre, sigue «por confirmar» y conserva su actividad, alcances y entregas

#### Scenario: Actividad del libro elegida

- **WHEN** se pide usar la actividad del libro solo en la partida 22 de EM-30184
- **THEN** su actividad pasa a «VERIFICACION Y MANTENIMIENTO PREVENTIVO A SISTEMA DE FILTRADO DE GAS NATURAL DE LA ERM», sin la periodicidad final, y las demás partidas conservan la suya

#### Scenario: Partida que el sitio no tiene

- **WHEN** el bloque de EM-30185 trae la partida 25 y el sitio no la tiene registrada
- **THEN** se crea «por confirmar» con el número, la actividad sin la periodicidad final, la periodicidad y la cantidad anual del libro, y sus meses programados

#### Scenario: Partida del sitio que el libro no trae

- **WHEN** el sitio tiene una partida que no aparece en el bloque
- **THEN** la partida y sus meses no cambian y el ensayo la lista como no incluida

### Requirement: Realizados marcados en el programa importado

Las marcas de la fila R SHALL registrarse como realizados sin reporte de origen importación, con la
misma regla de cantidad que la fila P. Al reimportar, SHALL reemplazarse solo los realizados de origen
importación de las partidas del bloque; los realizados registrados a mano y los reportes no SHALL
cambiar.

#### Scenario: R importada

- **WHEN** se aplica el programa de EM-30184 y la partida 14 tiene marca en la fila R de junio de 2026
- **THEN** junio de la partida 14 cuenta 1 realizado sin reporte con la nota «Marcado como realizado en el programa importado»

#### Scenario: Reimportación con un realizado manual

- **WHEN** se reimporta un programa y la partida tiene un realizado registrado a mano en otro mes
- **THEN** el realizado manual se conserva y solo se reemplazan los de origen importación

### Requirement: Advertencias del programa importado

El ensayo SHALL listar, sin corregirlas, las inconsistencias del libro: suma de meses distinta de la
cantidad anual, meses sin marca en una partida mensual, varias marcas en un mes de una partida mensual
o mayor, fila resaltada en rojo, R sin P en ese mes, valores no reconocidos, marcas en columnas
ocultas, filas ocultas y cambio de periodicidad en partidas con reportes. Cada una SHALL nombrar el
sitio, la partida y el mes que correspondan.

#### Scenario: Semanal con más marcas que su cantidad

- **WHEN** la partida semanal 30184-1 tiene cantidad anual 52 y 53 marcas visibles
- **THEN** se importan 53 programadas y el ensayo advierte que suman 53 contra una cantidad de 52

#### Scenario: Mensual sin diciembre

- **WHEN** la partida mensual 30185-16 no tiene marca en diciembre de 2026
- **THEN** el ensayo advierte que suma 11 contra 12 y que diciembre de 2026 no tiene marca

#### Scenario: Fila resaltada en rojo

- **WHEN** el número y la actividad de la partida 30185-25 tienen relleno rojo
- **THEN** el ensayo advierte que la fila está resaltada en rojo en el libro

#### Scenario: Realizado sin programado

- **WHEN** la partida 30184-14 tiene R en junio de 2026 y su P de junio está en blanco
- **THEN** el ensayo advierte que junio tiene realizado sin programado

#### Scenario: Partida con reportes que cambia de periodicidad

- **WHEN** una partida con reportes pasa de mensual a trimestral en el ensayo
- **THEN** el ensayo advierte que los reportes existentes conservan su periodo y su ocurrencia

### Requirement: Vigencia del contrato frente al periodo importado

Si el periodo del programa no está dentro de la vigencia del contrato, el ensayo SHALL advertirlo con
los dos rangos y los meses que quedan fuera, e indicar que la captura rechaza esos meses. La
advertencia no SHALL impedir aplicar. Complementa el escenario «Contrato vigente» de «Registro de
clientes, contratos y sitios» (`catalogo-contratos`, cambio `reportes-mantenimiento-for-icsi-rmt-01`).

#### Scenario: Programa que empieza antes de la vigencia

- **WHEN** la vigencia del contrato es del 2026-05-01 al 2027-04-30 y el programa va del 2026-03-01 al 2027-02-28
- **THEN** el ensayo advierte que marzo y abril de 2026 quedan fuera de la vigencia del contrato

#### Scenario: Programa dentro de la vigencia

- **WHEN** la vigencia del contrato es del 2026-03-01 al 2027-02-28 y el programa tiene el mismo periodo
- **THEN** el ensayo no muestra advertencia de vigencia

### Requirement: Programa superpuesto en la importación

Si el contrato y sitio ya tienen un programa con otro inicio cuyo periodo se superpone con el
importado, el sistema SHALL rechazar la importación desde el ensayo, indicar ambos periodos y no
guardar cambios. Un programa con el mismo inicio SHALL actualizarse con el fin y los meses del libro.

#### Scenario: Periodo superpuesto

- **WHEN** EM-30184 ya tiene un programa del 2026-05-01 al 2027-04-30 y el libro trae del 2026-03-01 al 2027-02-28
- **THEN** el ensayo se rechaza indicando los dos periodos y no se guarda nada

#### Scenario: Mismo inicio

- **WHEN** EM-30184 ya tiene un programa que inicia el 2026-03-01 y termina el 2026-12-31
- **THEN** el ensayo propone actualizar el fin al 2027-02-28 y reemplazar los meses del libro

### Requirement: Resumen del ensayo del programa

El ensayo SHALL mostrar el archivo, el sitio, el periodo, la acción sobre el programa y los totales
por crear, actualizar y sin cambios. Por partida SHALL mostrar la acción, la periodicidad y la cantidad
anual antes → después, el total programado, los realizados importados, si sigue «por confirmar» y sus
advertencias. «Aplicar» SHALL ofrecerse solo con cambios y el ensayo SHALL caducar a las 2 horas.

#### Scenario: Ensayo con cambios

- **WHEN** se revisa el libro de Proagro para EM-30184 con sus partidas sin programa
- **THEN** el resumen muestra el periodo 2026-03-01 a 2027-02-28, «se creará el programa anual», 31 partidas por actualizar y, en la partida 3, «Mensual → Trimestral» y cantidad «— → 4»

#### Scenario: Ensayo sin cambios

- **WHEN** el ensayo no encuentra cambios
- **THEN** el resumen lo dice y no ofrece «Aplicar»

#### Scenario: Ensayo caducado

- **WHEN** el usuario elige «Aplicar» más de 2 horas después del ensayo
- **THEN** el sistema informa que la importación caducó y pide volver a cargar el archivo, sin guardar cambios

### Requirement: Importación de programa por línea de comandos

La importación de programa SHALL poder ejecutarse por línea de comandos con el libro, el contrato y el
sitio. Por omisión SHALL hacer solo el ensayo e imprimir el resumen y las advertencias; SHALL guardar
solo con la opción de aplicar. SHALL admitir, por número de partida, usar la actividad del libro y
fijar la periodicidad, y reflejarlo ya en el ensayo.

#### Scenario: Ensayo por omisión

- **WHEN** se ejecuta la importación del programa de EM-30185 sin la opción de aplicar
- **THEN** se imprime el resumen con advertencias y la base no cambia

#### Scenario: Periodicidad fijada para una partida

- **WHEN** se ejecuta la importación de EM-30185 fijando la partida 25 como cuatrimestral
- **THEN** el ensayo muestra la partida 25 por crear como cuatrimestral, con cantidad 3 y abril, agosto y diciembre de 2026 programados

#### Scenario: Partida inexistente en un ajuste

- **WHEN** se pide usar la actividad del libro o fijar la periodicidad de una partida que el bloque no trae
- **THEN** el comando se rechaza antes de tocar la base e indica el número de partida
