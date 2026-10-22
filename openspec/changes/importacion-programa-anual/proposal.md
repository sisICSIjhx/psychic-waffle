# Proposal

## Why

El usuario agregó el programa anual 2026 de Proagroindustrias
(`insumos/PROAGROINDUSTRIAS/PROGRAMA ANUAL 2026 PROAGROS 1.xlsx`) y pidió integrarlo. Hoy no se puede
importar: el importador solo acepta el libro «CATALOGO DE ALCANCES» con dos hojas, y su función SQL
confirma las partidas y borra entregas, requisitos, notas y normas. Sin programa, las 55 partidas de
Proagro no aparecen en la planeación ni en «Mi trabajo», y la vigencia registrada del contrato (mayo
2026 a abril 2027) no coincide con el periodo del programa (marzo 2026 a febrero 2027).

## What Changes

**Comportamiento actual comprobado (2026-10-21, rama `feat/ux-fase-c`):**

- `analizarHojas` (`src/lib/server/importacion/catalogo.ts:454-532`) exige una hoja con «PROGRAMA» y
  otra «CATALOGO/ALCANCES». El libro de Proagro se rechaza con «El libro no tiene la hoja «PROGRAMA
  ANUAL»». Ese libro tiene una sola hoja, «ANUAL 2026», con la cabecera combinada sin texto y los
  meses sin año. Las columnas de enero y febrero de 2026 están ocultas, y los dos sitios van en la
  misma hoja: EM-30184, filas 11-71, y EM-30185 a partir de la separadora «(ERM 30185)» de la fila 73.
- `api_importar_catalogo` (`supabase/migrations/0009_importacion_alcances.sql:153-173`) deja la
  partida «confirmado». También pone en nulo entregas, requisitos y materiales, y borra notas y
  normas. No sirve para un libro que solo trae programa.
- Defectos del importador actual: el último mes solo revisa 2 columnas (`catalogo.ts:263-266`), de
  modo que se pierde una marca en la 3.ª columna o más allá. Además, `leerLibro`
  (`src/lib/server/importacion/xlsx.ts:97-129`) no informa qué columnas y filas están ocultas.
- Proagro en la base de desarrollo: contrato `PRO-AGRO-PRV-016-2026`, vigencia 2026-05-01 a
  2027-04-30 «por confirmar». EM-30184 tiene 31 partidas y EM-30185 tiene 24, todas «por confirmar»,
  sin cantidad anual y sin programa. La periodicidad difiere del Excel en 20 partidas. La 30184-22
  tiene una actividad mal derivada, y la 30185-25 no existe.

**Comportamiento propuesto:**

- Importación de **solo programa anual**: el sistema reconoce un libro sin hoja de catálogo y
  procesa solo el bloque del sitio elegido. Las columnas se identifican por cabecera o por
  posición. El año se deduce del título y cambia en la secuencia de meses. Los rangos de cada mes
  salen de las celdas combinadas, y las columnas ocultas se ignoran.
- Cantidades por mes según las marcas: en las semanales y quincenales, el número de marcas; en las
  mensuales y de mayor periodo, 1 por mes marcado. Se leen las filas R y se avisa de las
  inconsistencias del libro sin corregirlas: cantidad distinta de la suma, meses en blanco, fila
  en rojo, valores no reconocidos y marcas en columnas ocultas.
- Nueva función SQL `api_importar_programa` (migración `0015_importar_programa.sql`) con ensayo. La
  función crea o actualiza el programa del sitio y actualiza solo la periodicidad y la cantidad
  anual. Reemplaza los meses programados y las R de origen importación. Las partidas que faltan se
  crean «por confirmar». No toca actividad (salvo que se pida para una partida), alcances,
  entregas, requisitos, materiales, notas, normas ni distribución. El estado del catálogo solo
  cambia con la opción explícita de confirmar, que la carga de Proagro no usa.
- Interfaz del contrato (`/catalogo/contratos/[id]`): detecta el tipo de libro y muestra un resumen
  del ensayo del programa (periodo, periodicidad y cantidad antes → después, meses y advertencias).
  El CLI `npm run importar` recibe `--programa`, ajustes explícitos por partida y el ajuste
  validado de la vigencia del contrato.
- Se corrige el rango del último mes en la importación del catálogo actual.
- Carga real del programa en la base de desarrollo, con ensayo previo, para EM-30184 y EM-30185
  según las decisiones del usuario. La carga ajusta la vigencia del contrato a 2026-03-01 a
  2027-02-28, toma la actividad del Excel en la 30184-22 y crea la 30185-25 «por confirmar» como
  cuatrimestral, con cantidad 3 en abril, agosto y diciembre. Se verifica con un GET a
  `/planeacion`.

Fuera de alcance (cambio `tablero-cumplimiento`): estados de cumplimiento, reprogramación, «no
ejecutado» y vistas mensual o semanal. Tampoco entran la edición de contratos con bitácora (cambio
`edicion-contratos-bitacora`), la carga de los 78 reportes Word de Proagro como realizados ni el
programa de Virtual. No cambia el reparto semanal por lunes del importador del catálogo.

Decisiones del usuario (2026-10-21) aplicadas: periodo de marzo de 2026 a febrero de 2027 en los dos
sitios y la vigencia del contrato alineada con él; la 30185-25 se crea «por confirmar» como
cuatrimestral. Decisiones adoptadas por omisión: importar tal cual con advertencias y corregir en
la app; actualizar solo la periodicidad y la cantidad anual, salvo la actividad de la 30184-22; y
confirmar las partidas a mano.

## Capabilities

### New Capabilities

- `programa-anual`: se **agregan** los requisitos de la importación de un programa anual sin
  catálogo (bloques por sitio, meses, cantidades por marcas, alcance de los datos, advertencias,
  ensayo y línea de comandos). Usa la misma ruta de capacidad que el cambio en cierre
  `reportes-mantenimiento-for-icsi-rmt-01`, todavía sin archivar y por eso fuera de
  `openspec/specs/`. Solo se usa `ADDED`: los requisitos de ese cambio no se modifican.
- `catalogo-contratos`: se **agregan** el rango completo del último mes en la importación del
  catálogo y el ajuste validado de la vigencia del contrato al importar un programa. Ambos amplían
  «Importación del catálogo desde Excel» del mismo cambio en cierre.

### Modified Capabilities

Ninguna en `openspec/specs/`.

## Impact

- Código: `src/lib/server/importacion/xlsx.ts` (columnas y filas ocultas), un analizador nuevo en
  `src/lib/server/importacion/programa.ts`, `catalogo.ts` (último mes), `temporal.ts` (tipo de
  carga), `src/lib/server/repositorios/programa.ts` (`importarPrograma`) y
  `src/routes/catalogo/contratos/[id]/+page.server.ts`. También `ContratoView.svelte`, un
  componente nuevo `ResumenPrograma.svelte` en `src/lib/components/catalogo/` y el CLI
  `scripts/importar-catalogo.ts`.
- Datos: migración `supabase/migrations/0015_importar_programa.sql`, solo con funciones y sin
  tablas nuevas. PGlite la aplica al abrir la base: hay que detener el servidor de desarrollo y
  respaldar `storage/pglite` antes de reiniciarlo o de usar el CLI.
- Datos de desarrollo: se ajusta la vigencia del contrato de Proagro y se cargan dos programas con 56
  partidas (55 actualizadas y 1 nueva) y un realizado importado (30184-14, junio). El «.» de la
  30185-2 en septiembre se informa como valor no reconocido.
- Sin dependencias nuevas.
