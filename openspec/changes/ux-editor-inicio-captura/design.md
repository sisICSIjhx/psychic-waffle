# Design

## Context

Motivación y alcance en `proposal.md`; requisitos en `specs/captura-reportes/spec.md` y
`specs/mi-trabajo/spec.md`. Estado de partida, comprobado en `feat/ux-fase-a`:

- `src/lib/components/reportes/EditorReporte.svelte` concentra el editor: autoguardado con cola y
  concurrencia optimista (`guardar`, `encolar`, `huella`), acciones por `acciones.ts`, validación con
  `validarParaRevision` de `src/lib/dominio/captura.ts`, cuyas observaciones ya traen la ruta del
  campo (`fechaEjecucion`, `objetivo`, `equipos`, `alcances.<i>.titulo`, `alcances.<i>.estado`…).
- `FotosAlcance.svelte` numera con `ordenDeAparicion` y emite `cargar` y `mover`; la carga es una
  foto por petición, en cola.
- `/captura` resuelve cada paso con parámetros de la URL en `src/routes/captura/+page.server.ts`
  (contrato y sitio se eligen solos si hay uno); la planeación ya enlaza a la captura con partida y
  mes.
- El panel (`src/routes/+page.server.ts`) obtiene los avances de los programas vigentes, el resumen
  del mes (`resumenDelMes`) y los vencidos (`pendientesVencidos`) de `src/lib/dominio/planeacion.ts`.
- `api_listar_reportes` (`supabase/migrations/0003_reportes.sql`) devuelve filas sin la partida ni el
  sitio; el resto del sistema ya los tiene (`reportes.partida_id` es obligatorio).
- Base visual de la fase A: tokens AA, `InsigniaEstado`, objetivos de 32/44 px, `textos.ts`.
- Convenciones: Svelte con sintaxis heredada (`export let`, `$:`, `on:`), textos en español, sin
  dependencias nuevas salvo decisión explícita.

## Goals / Non-Goals

**Goals:**

- Reutilizar la lógica existente (autoguardado, validación, cola de fotos) y cambiar su presentación;
  las reglas nuevas que se puedan probar sin interfaz van en `src/lib/dominio/`.
- Componentes accesibles y compartidos para lo que hoy usa diálogos nativos o listas desplegables.
- Que las fases B y C se puedan entregar y revisar por separado.

**Non-Goals:**

- Cambiar las validaciones para revisión, los estados, el autoguardado o el DOCX.
- Vistas o acciones por rol: la misma persona envía a revisión y emite (decisión del usuario); los
  permisos llegarán con la autenticación sin cambiar este flujo.
- Captura de fotos con la cámara del dispositivo y diseño fuera de línea: el uso es en escritorio
  (decisión del usuario). En móvil se mantiene lo de la fase A: sin desborde y objetivos de 44 px.
- Planeación, historial, atajos de teclado y «Copiar del último reporte» (fases D y E).

## Decisions

### D1. Componentes compartidos propios en `src/lib/components/ui/`

`Dialogo.svelte` sobre `<dialog>` con `showModal()` (foco atrapado, `Esc` y fondo inerte los da el
navegador) y foco inicial en la opción segura; `Notificaciones.svelte` con una región `role="status"`
montada en `+layout.svelte` y una tienda (`notificaciones.ts`) que acepta una acción «Deshacer» y un
plazo; `SelectorBusqueda.svelte` con el patrón combobox de ARIA 1.2 (`input` + `listbox`,
`aria-activedescendant`, grupos con `role="group"`); `BotonesSegmentados.svelte` como `radiogroup` con
tabulación itinerante y flechas; `IndiceSecciones.svelte`.
Alternativa descartada: una biblioteca de componentes (bits-ui, melt-ui): añade dependencia, usa runes
y no cubre la sintaxis heredada del proyecto.

### D2. Completitud y destino de cada pendiente en el dominio

Nueva función pura `destinoDeObservacion(observacion, reporte)` en `src/lib/dominio/captura.ts` que
traduce la ruta de una observación a su sección (`encabezado`, `firmas`, `objetivo`, `alcance:<id>`,
`herramientas`, `conclusiones`) y al `id` del campo en el editor, y `completitudPorSeccion` que cuenta
pendientes por sección. Las rutas de alcance traen el índice (`alcances.<i>.titulo`), no el UUID; por
eso la función recibe el mismo reporte con el que se validó y toma `reporte.alcances[i].id`. Como el
editor recalcula las observaciones con cada cambio del reporte, índice e `id` siempre corresponden,
aunque se agreguen, quiten o reordenen alcances. El índice, la barra («Faltan N») y el resumen de envío
usan la misma lista (`validarParaRevision`), así nunca discrepan.
Alternativa descartada: calcular la completitud en cada componente: duplicaría las reglas.

### D3. «Enviar a revisión» abre el resumen en el cliente

Con observaciones locales, el botón no llama al servidor: muestra el resumen (región con encabezado y
enlaces) y mueve el foco a él. Cada enlace abre la sección si está como resumen (D6) y enfoca el campo
tras `tick()`. Sin observaciones, sigue el flujo actual (`accionConGuardado('estado', …)`); las
observaciones del servidor (422) se muestran en el mismo resumen.

### D4. Quitar con «Deshacer» sin cambios en el servidor

El elemento quitado se oculta y se marca como pendiente de quitar, pero sigue en el reporte que se
autoguarda hasta que vence el plazo (10 s) o el usuario confirma otra acción que depende del contenido
guardado (descargar, enviar, emitir, navegar o cerrar la pestaña): en ese momento se aplica la baja.
«Deshacer» solo retira la marca, por eso restaura fotos, pies, orden y espacio aunque haya habido
autoguardados. La numeración de ilustraciones ignora lo marcado. Al cerrar o recargar la pestaña
(`pagehide`, que solo ocurre si la salida se confirmó), las bajas pendientes se aplican y se guardan
con un envío `keepalive`.
Alternativa descartada: borrado lógico con restauración en el servidor: exige migración y cambia el
contrato de guardado; volver a subir la foto tampoco sirve porque el original ya no estaría.

### D5. Barra compacta y guardado con hora relativa

La barra actual se reorganiza en una línea en escritorio (contexto e insignia a la izquierda; guardado,
«Faltan N», «Descargar» y la acción principal a la derecha) y dos en móvil. La hora relativa sale de
`guardadoEn` (marca al terminar `guardar`) y de un reloj que se actualiza cada 10 s; el texto usa
`textos.ts`. «Reintentar» llama a `guardarAhora()`. El contexto (cliente, partida y periodo) viene de
los campos del reporte, no de la URL.

### D6. Secciones como resumen editable

Componente `SeccionResumen.svelte` con dos estados: resumen de lectura con «Editar» y campos abiertos con
«Listo». Se abre solo si la sección tiene pendientes (D2) o si el usuario lo pide; abrir no cambia el
dato. Los campos de una sección cerrada no se montan; por eso los enlaces de D3 abren antes de enfocar.
El orden de las secciones sigue el del documento. Se usa en firmas y objetivo; usuario, contrato, sitio y
periodicidad no forman parte del guardado (`aGuardado`) y se muestran de solo lectura en el encabezado,
con la indicación de corregirlos en el catálogo.

### D7. Índice de secciones

En escritorio (≥ 1100 px) el editor pasa a dos columnas: índice fijo de 220 px y contenido. En pantallas
angostas, el índice es un `<details>` bajo la barra. Cada sección y alcance tiene un `id` estable
(`seccion-<clave>`, `alcance-<id>`); el destino recibe el foco (`tabindex="-1"`) y el
`scroll-padding-top` de la fase A evita que la barra lo tape.

### D8. Verificación segmentada

`BotonesSegmentados` con OK, No aplica y Con observación; «pendiente» se representa sin selección. El
campo de observaciones se muestra si el estado es «Con observación» o si ya tiene texto (no se oculta
información capturada antes).

### D9. Fotos: arrastre y progreso

Cada grupo de `FotosAlcance` es zona de soltar (`dragover`/`drop`) y conserva el botón «Agregar fotos».
El editor lleva por alcance `{ total, hechas }` en lugar del contador actual para mostrar «Cargando 3
de 12»; los rechazos ya llegan por archivo con su causa. Sin captura con la cámara del dispositivo: el
uso es solo en escritorio (decisión del usuario).

### D10. Emisión y descarga

La emisión usa `Dialogo` con el título, la revisión y el número de fotos; `Esc` o «Cancelar» devuelven
el foco a «Emitir». «Descargar DOCX» es un enlace cuando se puede generar y un botón deshabilitado con
el motivo enlazado por `aria-describedby` cuando no (un enlace no admite `disabled`).

### D11. «Mi trabajo» con una regla pura de siguiente trabajo

`siguienteTrabajo(avances, borradores, hoy)` en `src/lib/dominio/planeacion.ts` devuelve los
pendientes (vencidos y del mes en curso) ordenados por urgencia, con partida, sitio, contrato, mes,
lo que falta y los borradores que coinciden por partida y mes (con su ocurrencia). La carga de `/`
obtiene **todos** los borradores del rango de meses con pendientes (del vencido más antiguo al mes en
curso) con `listarTodos(filtro)`, una función nueva del repositorio de reportes que recorre las páginas
de 100 hasta completar el total; ningún borrador coincidente queda fuera por un límite. La tarjeta de
vencidos filtra la lista con `?ver=vencidos`; «Ver todos» usa `?ver=todos`; borradores y en revisión
llevan al historial filtrado. La lista muestra 10 elementos por omisión.

### D12. Migración aditiva `0013` para relacionar reportes con partidas

`supabase/migrations/0013_resumen_reportes_partida.sql` redefine `api_listar_reportes` (misma firma)
para incluir `partidaId` y `sitioId` en cada fila; `esquemaReporteResumen` los agrega. Es compatible con
los consumidores actuales. PGlite la aplica al abrir la base, es decir, al reiniciar el servidor de
desarrollo.
Alternativa descartada: relacionar por número de partida y texto del sitio: frágil ante partidas
renumeradas o sitios escritos de otra forma, que es justo el error que el sistema evita.

### D13. Captura con selector, grupos y aviso

La carga de `/captura` agrega, cuando hay contrato y sitio, el trabajo pendiente de cada partida según el
avance del programa vigente del sitio: sus meses vencidos (todas las celdas anteriores al mes de
referencia, con `pendientesVencidos`, conservando el mes de cada uno) y el estado de la celda del mes de
referencia (`estadoCelda`). Cada partida cae en un solo grupo, en este orden de precedencia: «Con
borrador» (algún borrador en el rango de meses, sin perder su estado y mes pendientes), «Pendientes»
(algún vencido o pendiente en el mes de referencia) y «Otras partidas». Al elegir una partida vencida sin
`?mes=`, el mes sugerido es su vencido más antiguo.
Los borradores del sitio en ese rango de meses se obtienen completos con `listarTodos` (D11). El selector
reemplaza la lista desplegable de partida y conserva el parámetro `partida` en la URL (los enlaces desde
la planeación y «Mi trabajo» siguen funcionando). Con partida y mes elegidos, la
carga consulta los reportes de esa partida y mes (sin sustituidos); el aviso se filtra en el cliente por
la ocurrencia elegida y muestra los TAG. La búsqueda normaliza acentos y mayúsculas con una función pura
del dominio y ordena primero la coincidencia exacta por número.

## Risks / Trade-offs

- [El editor crece y es difícil de probar] → se extraen componentes (índice, resumen de sección, barra,
  verificación) con pruebas propias en Chromium; las reglas van al dominio con pruebas de servidor.
- [El guardado `keepalive` al cerrar no llega (cuerpo mayor a 64 KB, cierre forzado o un guardado en
  curso con otra versión)] → el elemento sigue en el reporte: no hay pérdida de datos, solo hay que
  volver a quitarlo.
- [Muchos borradores en el rango de meses] → `listarTodos` hace una petición por cada 100; con el
  volumen actual (decenas) es una sola. Si creciera, se agrega un filtro por partidas al SQL.
- [La migración 0013 no se aplica sin reiniciar el servidor] → la tarea lo indica y el esquema acepta
  la ausencia de los campos durante la transición solo en pruebas, no en producción.
- [`<dialog>` y `:has` en navegadores antiguos] → los navegadores de destino (Chromium, Edge, Safari y
  Firefox actuales) los soportan; no se agregan polyfills.

## Migration Plan

1. Agregar `0013` y el campo en el esquema; reiniciar el servidor de desarrollo (PGlite) para
   aplicarla. En Supabase se aplicará con el resto de las migraciones (tarea 3.8 del cambio anterior).
2. Implementar la fase B (editor) y revisarla con Codex; después la fase C (inicio y captura).
3. Reversión: los cambios de interfaz se revierten por commit; `0013` solo agrega campos a la salida de
   la función, y volver a la definición de `0003` no afecta datos.

## Decisiones del usuario

Respondidas el 2026-10-21 (plan, sección 8):

1. **Solo escritorio** (8.1): las fotos se pasan a la PC y se suben desde ahí. El editor se optimiza
   para escritorio (índice fijo desde 1100 px); el índice desplegable en pantallas angostas se conserva
   como respaldo sencillo y no hay captura con la cámara.
2. **La misma persona envía a revisión y emite** (8.2): «Mi trabajo» trata los borradores y lo que está
   en revisión como pasos del mismo flujo y el editor muestra todas las acciones del estado, como hoy.
