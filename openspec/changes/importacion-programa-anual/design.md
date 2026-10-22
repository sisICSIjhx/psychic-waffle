# Design

## Context

La motivación y el alcance están en `proposal.md`, y los requisitos en `specs/programa-anual/spec.md`
y `specs/catalogo-contratos/spec.md`. Este es el estado de partida, comprobado en `feat/ux-fase-c`:

- `src/lib/server/importacion/xlsx.ts`: `leerLibro` devuelve por hoja las filas, las celdas combinadas
  y los rellenos. `esRellenoMarcado` (93-95) trata como marca un relleno sólido que no sea blanco. No
  lee `<cols hidden>` ni `<row hidden>`.
- `src/lib/server/importacion/catalogo.ts`: `analizarHojas` (454-532) une las hojas «PROGRAMA» y
  «CATALOGO/ALCANCES» por número de partida con un `Map`, que con números repetidos se queda con la
  última fila. `analizarPrograma` (215-308) exige cabeceras con texto y meses «MES AAAA», y al último
  mes le da `columna + 2` (263-266). `cantidadDelMes` (115-129) reparte las semanales por los lunes
  del mes.
- `src/routes/catalogo/contratos/[id]/+page.server.ts`: `importarEnsayo` (153-189) acepta solo .xlsx
  de hasta 10 MB, analiza el libro, ejecuta el ensayo y guarda la carga con
  `guardarImportacionPendiente` (`src/lib/server/importacion/temporal.ts`, caducidad de 2 horas).
  `importarAplicar` (191-214) recupera la carga por su token. El sitio es el elegido en la vista
  (`ContratoView.svelte:247-266`), y el resumen lo muestra `ResumenImportacion.svelte`.
- `RepositorioCatalogo.importarCatalogo` (`src/lib/server/repositorios/catalogo.ts:152-156`) llama a
  `api_importar_catalogo`, cuya versión vigente está en
  `supabase/migrations/0009_importacion_alcances.sql`. Esa función confirma la partida y reemplaza
  todos sus campos del catálogo. Lo que sí sirve de modelo es la forma en que reemplaza los meses y
  las R de origen importación (186-198, origen definido en `0008_realizados_origen.sql`).
- `supabase/migrations/0002_programa.sql`: `programas` es único por contrato, sitio e inicio, y el
  trigger `validar_programa` impide traslapes y que un periodo deje fuera meses registrados.
  `validar_mes_programa` exige que la partida y el mes correspondan al programa. Los contratos
  (`0001_catalogo.sql:95-99`) solo validan `vigencia_fin >= vigencia_inicio`, y
  `api_guardar_contrato` (390-421) actualiza la vigencia sin más controles.
- La captura rechaza los meses fuera de la vigencia del contrato (`src/lib/server/captura.ts:100`;
  `mesesDeVigencia` en `src/lib/dominio/captura.ts:81-94`). `/planeacion`
  (`src/routes/planeacion/+page.server.ts:17-62`) muestra el programa vigente del sitio con
  `obtenerAvance`.
- CLI `scripts/importar-catalogo.ts`: con `--contrato` y `--sitio` hace un ensayo por omisión y guarda
  con `--aplicar`. Necesita el servidor de desarrollo detenido, porque PGlite admite un solo proceso.
  Las migraciones se aplican al abrir la base (`src/lib/server/bd/migraciones.ts`).
- Libro de Proagro: ver el detalle en `proposal.md`. Ninguno de los contratos tiene firmantes, y
  Proagro no tiene reportes ni programas.

## Goals / Non-Goals

**Goals:**

- Un analizador para programas por sitio que no dependa del formato de Cerritos, con reglas puras
  que se puedan probar con libros sintéticos.
- Que la importación de programa no pierda nada del catálogo y que el ensayo diga exactamente lo que
  va a cambiar.
- Que la carga real de Proagro sea reproducible con comandos y tenga resultados verificables.

**Non-Goals:**

- Cambiar `api_importar_catalogo` o el reparto semanal por lunes del catálogo de Cerritos. Solo se
  corrige el último mes.
- Elegir la actividad o la periodicidad por partida desde la interfaz: para la carga se hace con el
  CLI, y después se corrige en el editor de partidas (`/catalogo/partidas/[id]`).
- Editar contratos desde la interfaz o con bitácora (cambio `edicion-contratos-bitacora`), estados de
  cumplimiento o reprogramaciones (cambio `tablero-cumplimiento`) y semana planeada.
- Importar varios sitios en una sola operación: se conserva un sitio por carga, como hoy.

## Decisions

### D1. Analizador propio en `src/lib/server/importacion/programa.ts`

`analizarProgramaAnual(hojas, { claveSitio, anio? })` devuelve el programa, las partidas, las
advertencias y los bloques que encontró. Reutiliza `periodicidadDeTexto`, `cantidadDelMes`,
`ErrorImportacion` y la normalización de `catalogo.ts`, además de `valorEn` y `esRellenoMarcado` de
`xlsx.ts`. La detección del tipo de libro va en `tipoDeLibro(hojas)`. Es catálogo si alguna hoja se
llama «CATALOGO» o «ALCANCES»; si no, es programa cuando una hoja tiene fila de meses y columna P/R.
Cualquier otro libro produce un error que describe las dos estructuras.
Alternativas descartadas: generalizar `analizarPrograma` de `catalogo.ts`, porque depende de las
cabeceras con texto y de la hoja de catálogo y mezclaría dos formatos en una función ya probada; y
editar el Excel a mano (opción I2 del análisis), que sigue perdiendo febrero de 2027 y confirma las
partidas.

### D2. Columnas y filas ocultas en `leerLibro`

`Hoja` agrega `columnasOcultas: Set<number>` y `filasOcultas: Set<number>`, en base 0, leídos de
`<cols><col min max hidden="1">` y de `<row r hidden="1">`. Son campos nuevos que los consumidores
actuales ignoran. El analizador de programa excluye los meses cuyas columnas están todas ocultas y no
cuenta las marcas que caen en columnas ocultas. Cada partida con marcas ignoradas se informa en una
advertencia. Las filas ocultas no se excluyen, pero también se advierten (el libro de Proagro no
tiene partidas en filas ocultas).

### D3. Meses, año y periodo

La fila de meses es la primera, por encima de las partidas, con dos o más nombres de mes (`MESES` de
`src/lib/dominio/documento.ts`), con o sin año. Si un mes trae año, se usa ese año. Si no, el año
inicial sale de `PROGRAMA ANUAL (\d{4})` en las filas de encabezado o de la opción `anio`, y aumenta
cuando el índice de un mes no es mayor que el del anterior. El rango de cada mes es el de su celda
combinada en esa fila. Sin combinar, llega hasta la columna anterior al mes siguiente, y el último
mes toma el ancho del anterior. Si los meses visibles no son consecutivos, el libro se rechaza. Así,
el libro de Proagro queda con marzo en P-S, abril en T-X… y febrero de 2027 en BM-BP: 2026-03-01 a
2027-02-28.

### D4. Bloques por sitio

Por debajo de la fila de meses, una fila separadora es una fila sin «P» ni «R» cuyo texto nombra
exactamente una clave `\(?E?RM[\s-]*(\d{5})\)?`. Las filas anteriores a la primera separadora
pertenecen a la primera clave de las filas de encabezado que no tenga separadora propia: en Proagro,
G7 nombra «(ERM 30184)» y «(ERM 30185)», y la fila 73 es la separadora de 30185. La clave del sitio
se compara por sus cinco dígitos (EM-30184 ↔ ERM 30184). Un libro sin claves es un solo bloque del
sitio elegido. Un número repetido dentro del bloque rechaza el libro, indicando las filas, para no
repetir el problema del `Map` del catálogo.

### D5. Columnas por cabecera o por posición

Primero se buscan las cabeceras PARTIDA, ACTIVIDAD, CANTIDAD, PERIODICIDAD y P/R con la misma
normalización del catálogo. Si no aparecen, la columna P/R es la que, a la izquierda de las columnas
de meses (ocultas incluidas), solo trae «P» o «R» en las filas que tienen valor en ella. Las cuatro anteriores son número (`^\d+[A-Z]?$`),
actividad (texto), cantidad anual (número o vacío) y periodicidad (texto reconocido). Un valor que no
corresponda rechaza el libro indicando la columna. Una periodicidad no reconocida rechaza el libro
indicando la fila y el valor, como hace el catálogo.

### D6. Marcas, cantidades y actividad

Una celda está marcada si `esRellenoMarcado` lo indica o si su texto es X, P, R o un número. Cualquier
otro texto genera una advertencia y no cuenta; es el caso del «.» de 30185-2. Para la cantidad del
mes:

- semanal y quincenal: el número de columnas visibles marcadas;
- diaria: `cantidadDelMes`, es decir, los días del mes;
- mensual o de mayor periodo: 1 por mes marcado, con advertencia si hay más de una marca;
- cuando aplique: sin meses.

La fila R usa la misma regla. Una fila está «resaltada en rojo» si el número o la actividad tienen un
relleno `rgb:(FF)?FF0000`. La actividad que se envía es el texto del libro sin la periodicidad final,
con o sin paréntesis, coma previa o punto («(SEMANAL).», «(MENSUAL)», «, MENSUAL», « MENSUAL.»), que
calcula `actividadSinPeriodicidad`. Solo se usa en las partidas nuevas y en las que se piden con
`usarActividad`. Las comillas y los paréntesis internos se conservan, como en «MANTENIMIENTO A POSTES
TIPO "R" (PROTECCION CATODICA) MENSUAL.».

### D7. Función `api_importar_programa` en `0015_importar_programa.sql`

Entrada: `{ contratoId, sitioId, ensayo, confirmar, programa: { periodoInicio, periodoFin, nombre },
partidas: [{ numero, actividad, usarActividad, periodicidad, cantidadAnual, meses, realizados }] }`.
Comportamiento:

- Valida que el sitio pertenezca al contrato (IC422, como en 0009).
- Busca un programa del contrato y sitio con el mismo inicio. Si otro programa se superpone, devuelve
  IC422 `programa_superpuesto` con los dos periodos, también en el ensayo.
- Crea el programa o actualiza su fin y su nombre.
- Por partida, compara por `numero_normalizado`:
  - si existe, actualiza `periodicidad` y `cantidad_anual`; `actividad` solo con `usarActividad`, y
    `estado_catalogo` solo con `confirmar`;
  - si no existe, la inserta con número, actividad, periodicidad, cantidad anual y
    `estado_catalogo = 'por_confirmar'` (o `confirmado` con `confirmar`).
- Reemplaza los `programa_meses` de la partida en ese programa y los realizados de origen
  `importacion`, con la nota de 0009.
- No toca `partida_alcances`, entregas, requisitos, materiales, homologados, descripción ni
  distribución.

Salida: la acción y el periodo del programa; los totales por crear, actualizar y sin cambios; y por
partida número, actividad resultante, acción, periodicidad y cantidad anual antes y después, meses,
total programado, realizados, `cambiaPrograma`, `estabaPorConfirmar`, `quedaPorConfirmar` y
`tieneReportes`. Al final, `noIncluidas` lista las partidas del sitio que el libro no trae. Todo
ocurre en una transacción: el ensayo no escribe, y si algo falla al aplicar no queda nada. Termina con
el bloque de permisos de 0009 (solo `service_role`).
Alternativa descartada: agregar opciones a `api_importar_catalogo`. Habría que bifurcar casi toda la
función, ya probada con Cerritos, y el riesgo de confirmar o borrar campos seguiría en el mismo
código.

### D8. Repositorio, advertencias y carga pendiente

`RepositorioPrograma.importarPrograma(carga, ensayo)` (`src/lib/server/repositorios/programa.ts`)
valida la respuesta con un esquema Zod nuevo. `advertenciasDelEnsayo(analisis, resultado, contrato)`
en `programa.ts` (importación) une las advertencias del libro con las que dependen de la base: la
vigencia que no contiene el periodo, con los meses fuera, y el cambio de periodicidad en partidas con
reportes. La usan la ruta y el CLI, así que los dos muestran lo mismo. Cada advertencia es
`{ partida, mes, fila, texto }` y su texto nombra el sitio. `temporal.ts` guarda
`{ tipo: 'catalogo' | 'programa', … }`. Una carga sin `tipo`, guardada antes del cambio, se trata
como catálogo.

### D9. Interfaz de importación en el contrato

La sección de `ContratoView.svelte` pasa a llamarse «Importar catálogo o programa desde Excel». El
formulario es el mismo (archivo y sitio elegido), y una nota explica los dos formatos. `importarEnsayo`
lee el libro una vez, decide el tipo (D1) y, si es programa, analiza el bloque del sitio elegido y
devuelve `tipo: 'programa'`. Un componente nuevo, `src/lib/components/catalogo/ResumenPrograma.svelte`
(sintaxis heredada, como el resto), muestra el resumen del requisito «Resumen del ensayo del
programa». Es una tabla con «antes → después» y una insignia de texto para la acción; primero van las
advertencias generales y después las de cada partida, en su fila. También lista las partidas no
incluidas. `importarAplicar` despacha por `tipo`. No se toca `ResumenImportacion.svelte`, porque sus
columnas (alcances, firmantes) no aplican a un programa.

### D10. CLI `--programa`

`scripts/importar-catalogo.ts` agrega `--programa`, que exige un contrato y un sitio existentes y no se
combina con `--crear`. Sus opciones:

- `--anio <AAAA>`;
- `--usar-actividad <n[,n…]>`;
- `--periodicidad <n>=<valor>`, repetible;
- `--ajustar-vigencia <inicio>:<fin>`;
- `--confirmar`.

Los ajustes por partida se aplican a la carga antes del ensayo, y un número que no esté en el bloque
rechaza el comando. El ensayo imprime el programa, los totales, las líneas por partida con cambios y
las advertencias.
Para `--ajustar-vigencia`, el comando comprueba en TypeScript que la nueva vigencia contenga el
periodo del programa. También comprueba que no deje fuera reportes del contrato (`listarTodos` con
`contratoId`) ni programas de sus sitios (`listarProgramas`). Con `--aplicar`, guarda la vigencia con
`guardarContrato` y luego importa. Si la importación falla después de guardar la vigencia, el mensaje
lo dice y da la vigencia anterior para restaurarla. La bitácora de estos cambios llegará con
`edicion-contratos-bitacora`; mientras tanto, el ajuste se registra en `HISTORIAL.md`. Ese cambio
(`0018`) deja `api_guardar_contrato` solo para altas y pasa `--ajustar-vigencia` a `api_editar_contrato`
con motivo y origen «script» (su tarea 3.4); por eso este cambio no agrega otro llamador de
`guardarContrato` con `id`.

### D11. Último mes del catálogo

En `analizarPrograma` (`catalogo.ts:262-266`), el rango de cada mes sale de su celda combinada en la
fila de meses. Si no está combinada, llega hasta el mes siguiente, y el último mes toma el ancho del
anterior. No cambia nada más del importador del catálogo.

### D12. Carga de Proagro

Se hace con el CLI, un sitio por vez, con el servidor detenido y una copia de `storage/pglite` (ver
Migration Plan):

- EM-30184: `--programa --ajustar-vigencia 2026-03-01:2027-02-28 --usar-actividad 22`.
- EM-30185: `--programa --periodicidad 25=cuatrimestral`.

Primero el ensayo y luego `--aplicar`. Valores esperados según el análisis del 2026-10-21:

| Sitio    | Partidas                        | Total programado | Partidas con diferencia                                                   |
| -------- | ------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| EM-30184 | 31, todas por actualizar        | 446              | 1, 2, 23 y 26 (53/52); 27 (52/48); 10 (3/2); 14 (3/4)                     |
| EM-30185 | 24 por actualizar y 1 por crear | 278              | 1 y 20 (53/52); 21 (52/48); 13 (1/2); 14 y 16 (11/12); 15 (5/6); 17 (2/3) |

Además, en EM-30184 debe aparecer un realizado importado (14, junio). Si los números del ensayo
difieren, se investiga antes de aplicar.

## Risks / Trade-offs

- [El Excel parece a medio editar («AQUÍ ME QUEDÉ» en C57, diciembre en blanco en 30185-13 a 17) y
  deja vencidos o diferencias falsas] → se importa tal cual por decisión del usuario, con todas las
  diferencias en advertencias; las correcciones se hacen en la app o con un libro corregido, que se
  reimporta sin duplicar.
- [Una reimportación posterior sin `--periodicidad 25=cuatrimestral` devolvería la 30185-25 a mensual,
  y la periodicidad corregida a mano en el editor también se sobrescribe] → el ensayo muestra
  «antes → después» de la periodicidad, y el historial registra los ajustes usados en la carga.
- [Cambiar la periodicidad de una partida con reportes deja reportes con otra ocurrencia] →
  advertencia en el ensayo (`tieneReportes`). Proagro no tiene reportes.
- [Ajustar la vigencia y después importar no ocurre en una sola transacción] → el ensayo valida todo
  antes y Proagro no tiene reportes. Si la importación falla, el mensaje da la vigencia anterior.
- [Tras la carga, «Mi trabajo» y `/planeacion` muestran como vencidos los meses de marzo a septiembre
  de 2026 de Proagro, porque sus 78 reportes Word no están en la base] → es el estado real según los
  datos; registrar el histórico como realizado queda fuera de este cambio.
- [Las columnas de semana del Excel (53) no son semanas de calendario] → este cambio solo cuenta
  marcas por mes; no guarda la semana planeada.
- [PGlite admite un solo proceso] → las tareas de migración y carga detienen el servidor y respaldan
  `storage/pglite` antes.
- [Datos personales] → el libro de Proagro no trae firmantes. Las pruebas usan libros sintéticos con
  datos ficticios, y el Excel real sigue en `insumos/` (ignorado).

## Migration Plan

1. Agregar `supabase/migrations/0015_importar_programa.sql`, que solo crea funciones, y probarla sobre
   PGlite en memoria (`repositorios.spec.ts`).
2. Base de desarrollo: detener el servidor (`npm run dev`) y copiar `storage/pglite` fuera del
   repositorio. Al abrir la base, el CLI o el servidor aplican 0015. En Supabase se aplicará con el
   resto de las migraciones (tarea 3.8 del cambio `reportes-mantenimiento-for-icsi-rmt-01`).
3. Carga de Proagro (D12) con el servidor detenido. Después se inicia el servidor y se verifica con
   GET a `/planeacion`.
4. Reversión del código: por commit. 0015 no cambia tablas: volver atrás solo deja una función sin
   usar. Reversión de los datos: restaurar la copia de `storage/pglite` hecha en el paso 2.

## Open Questions

- ¿El «.» de la fila R de 30185-2 en septiembre significa realizado? Por ahora se ignora con
  advertencia y se puede registrar a mano en `/planeacion`.
- El número `PRO-AGRO-PRV-016-2026` y su descripción («confirmar número y vigencia») siguen
  provisionales. Su corrección corresponde a `edicion-contratos-bitacora`, y este cambio no los toca.

## Decisiones del usuario

Respondidas el 2026-10-21:

1. Programa de marzo de 2026 a febrero de 2027 en EM-30184 y EM-30185, con la vigencia del contrato
   ajustada a 2026-03-01..2027-02-28.
2. Partida 25 de EM-30185 («Disposición segura final de residuos peligrosos»): se crea «por
   confirmar», cuatrimestral, con cantidad 3 en abril, agosto y diciembre de 2026.

Adoptadas por omisión: importar tal cual con advertencias; en las partidas existentes, actualizar
solo la periodicidad y la cantidad anual, salvo la actividad de la 30184-22, que se toma del Excel;
confirmar las partidas a mano; importar solo el programa, con ensayo, corrigiendo el último mes e
ignorando las columnas ocultas.
