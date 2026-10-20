# Design

## Context

**Hallazgos en los insumos** (`insumos/`, ignorado por Git):

- Reportes analizados: 157 DOCX.
  - Cerritos: 41. Cliente TEMEX GAS, EM-30167. Recibe ALPEK Polyester.
  - Proagroindustrias: 78. ERM 30184 Pajaritos y ERM 30185 Área VI, organizados por partida.
  - Virtual: 38. Virtual Pipelines, EM-30179 Agua Dulce. Son plantillas sin fotos ni fecha.
- Los 157 usan FOR-ICSI-RMT-01 con la misma estructura:
  - título «NN.- ACTIVIDAD MES AAAA»;
  - tabla de encabezado de 7 campos;
  - tabla de firmas de 3 columnas (nombre, cargo y empresa);
  - 1. Objetivo;
  - 2. Alcance: introducción, y por cada alcance un subtítulo, una descripción y fotos con pie
       «Ilustración 2.n.m»;
  - 3. Herramientas y equipo (ID, cantidad y material);
  - 4. Documentos de verificación: aparece en 76 reportes, casi todos de Proagro, y es una tabla de
       alcance, estado y observaciones;
  - Conclusiones y/o recomendaciones.
- Tres disposiciones de fotografías:
  - cuadrícula de 2 columnas con pie (Proagro y Cerritos);
  - antes/durante/después (Virtual y algunos de Cerritos);
  - volumen alto: de 6 a 129 fotos por reporte.
- Reportes por instrumento: Proagro emite un reporte por TAG (PI-xxxx, PIT-xxxx, TI/TIT-xxxx, PSV-xxxx).
  Cerritos agrupa varios TAG en un solo reporte.
- Periodicidades observadas: diario, semanal, mensual, bimestral, trimestral, cuatrimestral, semestral,
  anual y «cuando aplique».
- `CATALOGO DE ALCANCES.xlsx` (solo de Cerritos):
  - Hoja «PROGRAMA ANUAL 2026», formato FOR-TEC-004(A) R00: 55 partidas con periodicidad, cantidad,
    distribución, filas P/R por mes (mayo 2026 a abril 2027) y cantidad realizada.
  - Hoja «Catálogo de Conceptos-ALCANCES»: actividad, alcances con viñetas (incluye notas y normas),
    distribución, frecuencia, entrega, entrega según OMA, entrega propuesta, ODM/PT/AST (sí/no),
    materiales (ICSI o ALPEK) y reportes homologados.

**Código actual:**

- `src/routes/+layout.svelte` tiene el shell.
- `src/routes/+page.svelte` importa `$lib/views/DashboardView.svelte`, que no existe.
- Las vistas de `src/lib/components/views/` y casi todos los campos de `src/lib/components/fields/`
  están vacíos.
- No hay `src/lib/server`, base de datos ni endpoints.
- Componentes con sintaxis heredada de Svelte (`export let`, `on:`).
- `adapter-auto`.

## Goals / Non-Goals

**Goals**

- Un único modelo de reporte FOR-ICSI-RMT-01 configurable por contrato y partida, sin código distinto
  por cliente.
- Prellenar el 80 % o más del texto del reporte desde el catálogo.
- Generar el DOCX fiel a los reportes actuales.
- Planeación anual alimentada por los reportes emitidos.
- Revisión de cada fase por Codex y corrección iterativa.

**Non-Goals** (cambios posteriores)

- Autenticación y roles con Entra ID.
- SharePoint.
- Ciclo «subir Word corregido» con revisiones.
- Emisión oficial en PDF.
- Cola de trabajos.
- Pruebas de carga con k6.
- Despliegue.

## Decisions

### D1. Modelo relacional en PostgreSQL (Supabase) con migraciones SQL

Las migraciones van en `supabase/migrations/NNNN_descripcion.sql`.

Tablas principales:

| Grupo    | Tablas                                                                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo | `clientes`, `contratos`, `sitios`, `contrato_sitios`, `partidas`, `partida_alcances` (orden y tipo `alcance\|nota\|norma`), `partida_herramientas`, `equipos`, `partida_equipos`, `firmantes` |
| Programa | `programas` (contrato, sitio y periodo), `programa_meses` (partida, mes y cantidad programada), `programa_realizados_manuales` (partida, mes, cantidad, nota y `registrado_en`)               |
| Reportes | `reportes`, `reporte_alcances`, `reporte_fotos`, `reporte_herramientas`, `reporte_equipos`, `documentos_generados`                                                                            |

Detalle de las tablas:

- `partidas`: número, actividad, descripción, distribución, periodicidad, cantidad anual, entrega,
  `requiere_odm`, `requiere_pt`, `requiere_ast`, materiales por, reportes homologados, objetivo, texto
  base de conclusiones, disposición de fotos, `propone_verificacion` (valor inicial) y `estado_catalogo`
  (`confirmado` o `por_confirmar`, para las partidas derivadas de reportes de Proagro y Virtual).
- `reportes`: contrato, sitio, partida, periodo (mes y ocurrencia), fecha, tipo de mantenimiento,
  título, objetivo, conclusiones, `incluye_verificacion` (decisión del usuario en cualquier cliente),
  estado, `version` para la concurrencia optimista, copia de los firmantes, `revision` (0, 1, …) y
  `sustituye_a` (reporte emitido que corrige; al emitirse, el anterior pasa a `sustituido`).
- `reporte_alcances`: título, descripción, estado de verificación y observaciones.
- `reporte_equipos`: equipo y `orden`, único por reporte; define el orden del encabezado y el primer TAG
  del nombre de archivo.
- `reporte_fotos`: alcance, orden, pie, momento (antes, durante o después) y referencia de
  almacenamiento.
- `documentos_generados`: versión de plantilla, ruta y fecha.

El realizado del programa se calcula con una vista SQL sobre los reportes emitidos no sustituidos más
los realizados manuales; no se guarda un contador. Las claves son UUID. Hay restricciones `unique` para (contrato, sitio, número de partida),
para la clave de sitio y para el TAG por sitio. La clave de sitio se normaliza: sin acentos, en
mayúsculas y con espacios simples.

- **Alternativa descartada:** guardar el reporte como un JSON único. Se pierden las consultas por
  TAG/partida y el cálculo del programa.

### D2. Acceso a datos detrás de repositorios en `src/lib/server/repositorios/`

- La interfaz se define por agregado (catálogo, programa, reportes).
- Hay dos implementaciones:
  - Supabase, con `@supabase/ssr` en `hooks.server.ts` y la clave de servicio solo en servidor;
  - PGlite, para pruebas y desarrollo sin credenciales.
- Las pruebas `*.spec.ts` (proyecto server de Vitest) aplican las mismas migraciones en PGlite. Así
  las fases 1 a 5 avanzan aunque todavía no exista el proyecto de Supabase.
- RLS: se habilita en todas las tablas con una política de servicio. Las políticas por rol llegan con
  el cambio de autenticación. Mientras tanto, la aplicación no se despliega.

### D3. Dominio y validación en `src/lib/dominio/`

- Hay tipos y esquemas Zod compartidos entre cliente y servidor.
- Las reglas puras se prueban con Vitest: título, numeración de ilustraciones, meses del periodo,
  ocurrencias por periodicidad, nombre de archivo y validación para enviar a revisión.

### D4. Importador del catálogo en `src/lib/server/importacion/`

- Lee el `.xlsx` con `exceljs` y localiza las cabeceras por texto, no por coordenada fija.
- Agrupa las viñetas por partida. Una viñeta «·» es un alcance, «Nota:» es una nota y «NOM-…» o
  «CONTROL DE…» es una norma.
- Primero hace un ensayo («dry-run») con el resumen y después aplica todo en una transacción.
- El importador acepta un archivo cargado desde la interfaz, y además se ofrece un script
  `npm run importar -- <archivo>` para el uso local.
- Los nombres de firmantes de la hoja no se importan automáticamente: se proponen y se confirman en
  la interfaz.

### D5. Generación DOCX con `docx-templates` y plantilla en `src/lib/server/plantillas/FOR-ICSI-RMT-01.v1.docx`

- La plantilla se construye a partir de un reporte real limpio, con logotipos, encabezado y pie, y
  marcadores para los campos y los bloques repetidos (`FOR alcance`, `FOR fila`).
- Las fotos se agrupan en filas de 2 (cuadrícula) o en juegos 2 + 1 (antes y durante arriba, después
  centrada abajo, como los reportes de Virtual) antes de pasar a la plantilla. Todas usan una caja de
  8 × 6 cm; una foto sola en la última fila de la cuadrícula se centra. Decisión del usuario en el
  punto de control de la fase 2 (2026-10-20).
- Las imágenes se preparan con `sharp`: se corrige la orientación EXIF, el lado mayor queda en
  1600 px y se guardan en JPEG de calidad 80.
- Si `docx-templates` no puede reproducir alguna parte de la tabla de encabezado, se sustituye ese
  bloque por un XML de tabla en la plantilla. La alternativa evaluada es `docxtemplater` con el módulo
  de imágenes, que es de pago, por lo que se descarta salvo que falle lo anterior.
- El PDF se obtiene con `soffice --headless --convert-to pdf` si `SOFFICE_PATH` está configurado.

### D6. Almacenamiento de fotos detrás de una interfaz

- La implementación inicial guarda en disco local, en `storage/` (ignorado por Git), con el original y
  la versión optimizada.
- SharePoint será otra implementación en un cambio posterior.

### D7. Rutas e interfaz

| Ruta                       | Contenido                                                                |
| -------------------------- | ------------------------------------------------------------------------ |
| `/`                        | Panel                                                                    |
| `/planeacion`              | Programa P/R                                                             |
| `/captura`                 | Selección guiada; con `?cliente=` filtra por Cerritos, Proagro o Virtual |
| `/reportes/[id]`           | Editor del reporte                                                       |
| `/reportes/[id]/documento` | Endpoint de descarga del DOCX                                            |
| `/historial`               | Historial de reportes                                                    |
| `/catalogo`                | Contratos, partidas, equipos, firmantes e importación                    |
| `/personal`, `/perfil`     | Se mantienen                                                             |

- `routesByView` del layout se alinea con estas rutas.
- La vista Prosasa se elimina: pertenecía a un proyecto anterior que ya no existe. El submenú de
  Captura muestra los clientes registrados (hoy Cerritos/TEMEX GAS, Proagroindustrias y Virtual
  Pipelines), todos con `/captura?cliente=<clave>`. Las vistas vacías `ProagroView` y `VirtualView` se
  sustituyen por esa ruta común y se retiran.
- Los formularios usan acciones de SvelteKit y `fetch` para el autoguardado (con espera de 1,5 s).
- Los componentes nuevos se escriben con la sintaxis heredada para mantener la homogeneidad. Migrar a
  runes queda como decisión aparte.

### D8. Revisión con Codex por fase

- Cada fase se trabaja en la rama `feat/reportes-rmt-01` y termina en un commit.
- Al cerrar la fase se ejecuta `codex review --commit <sha> "<instrucciones>"`, que es de solo lectura
  y revisa el diff del commit. Las instrucciones:
  - prohíben abrir `insumos/`, `storage/` y `.env*`;
  - piden hallazgos con severidad, archivo y línea.
- Claude clasifica cada hallazgo como corregir, descartar con motivo o diferir, aplica las
  correcciones, vuelve a ejecutar las comprobaciones y hace un commit de corrección.
- Hay como máximo 2 rondas por fase.
- El resumen sin datos personales queda en `docs/revisiones/fase-N.md`.
- Codex envía el diff a OpenAI. Por eso los commits nunca contienen insumos ni credenciales.

## Risks / Trade-offs

| Riesgo                                                               | Mitigación                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| La fidelidad del DOCX con muchas fotos y tablas complejas.           | La fase 2 es una prueba temprana con 3 reportes reales (Proagro manómetros, Virtual PSV y Cerritos postes R) antes de construir la captura. |
| Faltan los catálogos de Proagro y Virtual.                           | El modelo es el mismo; se derivan partidas y alcances de sus reportes y se marcan «por confirmar».                                          |
| No existe proyecto de Supabase (confirmado).                         | El esquema se diseña desde cero y se prueba con PGlite; el usuario crea el proyecto y aporta el `.env` para aplicar las migraciones.        |
| Hay datos personales (firmantes) en los insumos.                     | No van en semillas, specs, historial ni commits. Se cargan desde la interfaz o con un importador local.                                     |
| Sin autenticación, cualquiera con acceso a la red ve los datos.      | Solo se ejecuta en local hasta el cambio de autenticación.                                                                                  |
| La observación de Codex puede contradecir decisiones de este diseño. | Prevalece el diseño aprobado. Las discrepancias se registran y, si son materiales, se consultan.                                            |

## Migration Plan

No hay datos previos en el sistema. El catálogo de Cerritos se carga con el importador, y Proagro y
Virtual se cargan cuando se reciban sus catálogos o se derivan de sus reportes. Los reportes Word
históricos no se migran: siguen como archivo y se registran en el programa como realizados manualmente
cuando corresponda.

## Resolved Questions (2026-10-19)

1. **Prosasa:** pertenecía a un proyecto anterior que ya no existe. Se elimina la vista y su entrada
   en el menú.
2. **Supabase:** no existe proyecto ni esquema. El modelo se crea desde cero con migraciones.
3. **Catálogos de Proagro y Virtual:** existen, pero aún no se tienen. Las partidas y alcances se
   derivan de sus reportes con `estado_catalogo = por_confirmar`, y se reemplazan al importar el
   catálogo oficial.
4. **Tabla de verificación:** es opcional en cualquier cliente, por decisión del usuario en cada
   reporte. La partida solo propone el valor inicial.
5. **Referencia visual:** todos los reportes comparten el mismo diseño. La plantilla se construye con
   cualquiera de ellos, y la prueba documental usa uno de cada disposición de fotos.

## Open Questions

- Ninguna que bloquee el inicio.
