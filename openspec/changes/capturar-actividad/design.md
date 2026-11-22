# Design

## D1. Una ventana global, datos bajo demanda

La ventana vive en la barra superior, presente en todas las páginas. Para no cargar datos en cada
navegación, pide `GET /actividades` al abrirse (centros visibles con su programa vigente y personal
activo) y `GET /actividades?centro=<id>` al elegir un centro (partidas con lo que falta por mes). Al
registrar, `POST /actividades` con JSON; después se invalida la página para que la matriz, el tablero
o «Mi trabajo» reflejen el cambio.

## D2. «Sí» es una marca de ejecución; «No», un ajuste «No ejecutado»

No se crea un concepto nuevo: «Sí» llama a `api_marcar_ejecutado` (cantidad 1, fecha, nota
«Registrado desde Capturar actividad») y hereda la absorción por reportes emitidos. «No» llama a
`api_registrar_ajuste` con `tipo = no_ejecutado`, cantidad 1, motivo `otro` y la nota «No realizada
(registrado desde Capturar actividad)», que satisface la restricción de nota con «Otro». El usuario
pidió no preguntar más que si se realizó; el motivo podrá agregarse después.

## D3. Fecha y mes

Sin fecha se usa la de hoy en America/Mexico_City (`fechaEnZona`). El mes es el de la fecha. La
fecha no puede ser posterior a hoy ni salir del periodo del programa; la base ya exige que la marca
caiga en un mes con algo por ejecutar.

## D4. Personas de la marca

Tabla `programa_marca_personal (marca_id, personal_id)`, clave primaria compuesta, borrado en cascada
con la marca (desmarcar la quita). `api_marcar_ejecutado` recibe `personalIds` (opcional) y rechaza
ids inexistentes o de personas inactivas. RLS como el resto: solo el rol de servicio. La ventana
agrupa primero al personal del centro elegido y después al resto.

## D5. Permisos

`/actividades` se agrega a `MODIFICACIONES` con `capturar`: quien captura reportes es quien hace el
trabajo en campo. «Marcar ejecutado» del panel de la matriz sigue con `ajustarPrograma`. Los ids que
llegan se comprueban con `exigirCentro` (programa) y el `GET` filtra centros con el alcance.

## D6. Centros sin programa

El `GET` marca cada centro con su programa vigente o `null`. Sin programa, la ventana muestra el
enlace `/seguimiento?centro=<id>&mes=<mes actual>`, como pidió el usuario mientras llegan sus
programas anuales.
