# Diseño de experiencia: estatus y KPI por centro de costo

Guía para implementar las tareas 2.1 a 2.4 y 3.1 de `tasks.md`. Parte de `design.md` (D1 a D11) y
del sistema «Panel claro» de `src/app.css`. Los ejemplos son ficticios («EM-00001 · Centro de
ejemplo»). Donde este documento y el código actual difieran, este documento describe el destino.

## 1. Decisiones transversales

1. **Dos públicos, una sola maqueta.** Cada pantalla tiene un único marcado que se reacomoda con
   CSS (tarjetas en una columna en teléfono, rejilla en escritorio). No se mantienen una tabla y
   unas tarjetas en paralelo para lo mismo, salvo la tabla del tablero (§4), que es solo lectura.
2. **Lo primero que se ve es el estatus y qué falta**; debajo, dónde se resuelve. Cada frase de
   «Qué falta» es un enlace al lugar exacto.
3. **Una acción principal por tarjeta**, en `.boton.primario` y a todo el ancho en teléfono. Lo
   demás va en `.boton.contorno` o `.boton.fantasma`.
4. **Trato de usted e impersonal** (`docs/PLAN_DISENO_UX.md` §5.9): «Seleccione…», «Escriba…».
   Se corrigen de paso los «tu cuenta» y «deja vacío» de estas pantallas.
5. **Sin diálogos modales en la captura.** `Dialogo.svelte` necesita JavaScript; los formularios
   secundarios se abren con `<details>` cuyo `<summary>` tiene aspecto de botón.
6. **Sin optimismo:** una casilla cambia cuando el servidor responde. Mientras tanto se ve
   «Guardando…».

### 1.1 Vocabulario

| En el sistema                 | En pantalla (operativo)                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| concepto (documentos)         | el nombre del documento («Reporte», «ODT»); en plural, «documentos» |
| concepto de nivel periodo     | «Datos del mes»                                                     |
| actividad (n de m)            | «Ejecución 1 de 3»; con una sola, no se numera                      |
| grupo                         | «Partida»                                                           |
| manual en centro con programa | «Fuera del programa»                                                |
| periodo                       | «Mes»                                                               |
| plantilla, origen, indicador  | no se muestran fuera del editor de plantillas                       |
| nocturnas                     | «Atenciones de emergencia»                                          |
| en_proceso (carpeta)          | «En preparación»                                                    |

Mensajes vigentes que se sustituyen: «Este centro de costo aún no tiene una plantilla de
seguimiento» → «Este centro de costo todavía no está configurado para el seguimiento. Avise a
administración.»; «Marcar fila» → «Marcar todo hecho»; «Marcar mes como hecho» → «Marcar todo el
mes como hecho» (queda al final de «Actividades», como `.boton.fantasma`, no arriba).

### 1.2 Guardar y avisar del resultado

Problema actual: la región `.resultado` está arriba de la página
(`src/routes/seguimiento/+page.svelte:74-82`, `src/routes/cobranza/+page.svelte:76-84`); en
teléfono, quien marca una casilla a media página no ve ni el «Guardado» ni el error.

Regla única para `/seguimiento` y `/cobranza`:

- Cada tarjeta que contiene formularios tiene un `id` (su **ancla**: `p-<grupo>`, `carpeta-<id>`,
  `emergencias`, `datos-mes`, `adicionales`, `cobranza`, `contrato`, `carta`). Todos sus
  formularios envían `<input type="hidden" name="ancla">` y su `action` termina en `#<ancla>`.
  Sin JavaScript, el navegador vuelve a la tarjeta tras recargar.
- La acción devuelve `{ mensaje, ancla }` o `fail(…, { error, ancla })` (cambio en
  `+page.server.ts`, no en la base). La página pasa `form` a la tarjeta cuya ancla coincide; si no
  llega ancla, se usa la región de arriba como hoy.
- En la cabecera de la tarjeta, `EstadoGuardado` (nuevo, §1.5) ocupa siempre una línea de 20 px
  (sin saltos de maquetación): vacío → «Guardando…» (mientras el formulario tiene `aria-busy`) →
  «Guardado» con marca. Es `role="status"`.
- El error se muestra dentro de la tarjeta, bajo su cabecera, con `.aviso.aviso-error` y
  `role="alert"`, y permanece hasta el siguiente envío.
- Si la petición no llega al servidor (`result.type === 'error'`): «No se guardó: no hay conexión.
  Inténtelo de nuevo cuando tenga señal.»
- Tras guardar, si el control que tenía el foco desaparece (un `<details>` que se cierra, una
  partida nueva), el foco pasa al título de la tarjeta (`tabindex="-1"`).
- Se conserva el bloqueo de doble envío por `aria-busy` del `enviar` actual. Durante el envío:
  `form[aria-busy='true']` con `opacity: 0.7` y `cursor: progress` (ya existe la opacidad).

### 1.3 Contexto: centro de costo y mes

`BarraContexto` (nuevo) sustituye a las tarjetas «Centro y mes» y «Centro de costo y año». Es un
formulario `GET`; con JavaScript se envía al cambiar el centro, y sin él muestra «Consultar»
dentro de `<noscript>`.

- **Centro de costo:** `<select>` con etiqueta visible, «EM-00001 · Centro de ejemplo».
- **Mes:** `NavegacionMes` (nuevo): dos enlaces y el mes al centro, «‹ oct · **Noviembre 2026** ·
  dic ›». Sustituye a `<input type="month">` (`src/routes/seguimiento/+page.svelte:68`), que en
  Firefox y Safari de escritorio es un campo de texto sin ayuda. El mes en curso lleva
  `aria-current="date"` y el texto «(mes actual)». `NavegacionPeriodo.svelte` no se reutiliza
  porque sus estilos viven bajo `.programa-anual` (`planeacion/programa.css:1398`).
- En `/cobranza`, en lugar del mes: «‹ 2025 · **2026** · 2027 ›» con el mismo componente.
- En teléfono no es una `.card`: bloque sin relleno, centro arriba y mes debajo (dos filas de
  44 px). En escritorio, una fila.

**Entrada a `/seguimiento` sin `?centro=`:** con un solo centro visible se abre ese. Con varios, la
página muestra «Mis centros de costo»: una `TarjetaCentro` compacta por centro (estatus y primera
frase de «Qué falta»), ordenadas como el tablero. Se elimina el comportamiento actual de abrir
`centros[0]`, que casi nunca es el de quien entra. La carga pide `api_estatus_centros` para los
centros visibles (una consulta).

### 1.4 Clases y tokens

No hacen falta colores ni tokens nuevos. Se usan tal cual `.card`, `.view-heading`, `.view-note`,
`.rotulo-grupo`, `.rotulo`, `.boton` y sus variantes, `.form-group`, `.form-grid`,
`.status-badge` (`.ok`, `.warn`, `.err`), `.aviso` y sus variantes, `.enlace`, `.sr-only` y
`.cifra`, con los tokens semánticos de ambos temas.

Añadidos a `src/app.css` (solo composición de tokens existentes):

| Clase nueva                                        | Definición                                                                                       | Contraste (claro / oscuro) |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| `.status-badge.info` y `.status-badge.por-definir` | se suman al selector de `.status-badge.accion-crear` (`--info` sobre `--info-fondo`)             | 6.4:1 / 6.0:1              |
| `.status-badge.grande`                             | `font-size: var(--texto-sm); padding: 4px 12px; gap: 6px`; icono de 16 px                        | igual que la insignia base |
| `.boton.ancho`                                     | `width: 100%` en `max-width: 768px`                                                              | —                          |
| `.tabla-apilable`                                  | en `max-width: 768px`, `tr` y `td` en bloque; cada celda muestra su `.etiqueta-celda` (ver §6.4) | —                          |
| `.resumen-boton`                                   | `<summary>` con aspecto de `.boton`: `list-style: none`, sin triángulo, `min-height: 44px`       | —                          |

Barras de avance: `<progress>` con el estilo de `.barra-avance` de
`src/lib/components/views/MiTrabajoView.svelte:306-328` (8 px, pista `--neutro-fondo`), con el
relleno según el semáforo: `--exito`, `--alerta` o `--peligro`, y `--accion` cuando no hay
semáforo. Relleno contra pista: 4.7:1, 4.7:1, 5.0:1 y 4.5:1 en claro; 8.0:1, 8.1:1, 6.4:1 y 5.9:1
en oscuro. La cifra siempre acompaña a la barra en texto.

Casilla marcada: fondo `--exito-fondo`, texto e icono `--exito` (4.7:1 / 6.7:1) y **borde
`--exito`**, no `--exito-borde` (1.6:1 sobre blanco, insuficiente para un control). Sin marcar:
`--campo-fondo` con borde `--borde-campo` (3.1:1 / 3.7:1).

### 1.5 Componentes

Reutilizados sin cambios: `ui/EncabezadoPagina.svelte`, `ui/Notificaciones.svelte` (no se usa
para el guardado de estas pantallas; ver §1.2), `cumplimiento/Semaforo.svelte` (sus tres trazos se
reutilizan en `BarraKpi`), `cumplimiento/IndicadoresCumplimiento.svelte`, `TablaCumplimiento`,
`TendenciaCumplimiento` y `ReportesQueFaltan` (el tablero del programa anual no cambia),
`cobranza/CampoConcepto.svelte` (gana la prop `soloLectura`), `catalogo/Aviso.svelte`.

Nuevos (sintaxis heredada: `export let`, `$:`, `on:`):

| Componente (`src/lib/components/…`)       | Props                                                                                          | Estados                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `estatus/InsigniaEstatus.svelte`          | `estatus`, `grande = false`                                                                    | los cuatro estatus                                        |
| `estatus/BarraKpi.svelte`                 | `kpi` (elemento de `kpisDeCentro`)                                                             | con total, solo porcentaje, sin datos                     |
| `estatus/ListaQueFalta.svelte`            | `elementos: { texto; href: string \| null }[]`, `vacio: string`                                | con elementos, vacía                                      |
| `estatus/TarjetaCentro.svelte`            | `centro`, `mes`, `estatus`, `kpis`, `falta`, `emergencias`, `variante`, `verCobranza`          | `tablero`, `ficha`, `compacta`; sin datos                 |
| `ui/NavegacionMes.svelte`                 | `anterior`, `siguiente` (`{ href; texto; nombre } \| null`), `titulo`, `actual = false`        | sin anterior o sin siguiente                              |
| `ui/EstadoGuardado.svelte`                | `estado: 'reposo' \| 'enviando' \| 'guardado'`                                                 | los tres                                                  |
| `ui/SelectorPersonas.svelte`              | `id`, `leyenda`, `nombre`, `personas`, `elegidas: string[] = []`                               | vacío, con búsqueda, sin coincidencias                    |
| `seguimiento/BarraContexto.svelte`        | `ruta`, `centros`, `centroId`, `periodo` (props de `NavegacionMes`)                            | un centro (sin selector), varios                          |
| `seguimiento/TarjetaPartida.svelte`       | `partida`, `actividades`, `conceptosPartida`, `conceptosActividad`, `valores`, + comunes       | abierta, completa (plegada), fuera del programa, consulta |
| `seguimiento/FilaActividad.svelte`        | `actividad`, `titulo`, `conceptos`, `valores`, + comunes                                       | pendiente, ejecutada, enviando, consulta                  |
| `seguimiento/FormularioPartida.svelte`    | `id`, `fueraDelPrograma`, + comunes                                                            | cerrado, abierto, error                                   |
| `seguimiento/AtencionesEmergencia.svelte` | `atenciones`, `personal`, `fechaSugerida`, `mes`, `idNueva`, + comunes                         | vacío, con lista, formulario abierto, consulta            |
| `cobranza/ResumenFinanzas.svelte`         | `centro`, `estatus`, `kpiCobranza`, `montoContrato`, `cobrado`, `adicionales`                  | sin monto, sin cobranza, captura anterior                 |
| `cobranza/Adicionales.svelte`             | `adicionales`, `contratos`, `puedeEditarContrato`, `puedeEditarCobranza`, `idNuevo`, + comunes | vacío, lista, alta, cobro, consulta                       |

«Comunes» = `urlGuardar`, `plantillaId`, `puedeEditar`, `enviar`, `resultado`
(`{ mensaje?; error? } | null`, ya filtrado por ancla).

Reescritos conservando el archivo: `seguimiento/CasillaSeguimiento.svelte` (§5.3),
`seguimiento/ValorSeguimiento.svelte` (etiqueta visible), `seguimiento/CarpetaSeguimiento.svelte`
(por pasos, §5.5) y `cumplimiento/ConcentradoCentros.svelte` (tablero, §4).

## 2. El armazón en teléfono

El riel sí se colapsa: bajo 768 px pasa a panel superpuesto con velo (`src/app.css:1142-1169`,
`src/routes/+layout.svelte:112-119`) y el botón del menú mide 44 px
(`src/lib/layout/BotonPanel.svelte:54-60`). No hay que rehacerlo. Arreglos mínimos:

| #   | Problema                                                                                    | Dónde                                         | Arreglo mínimo                                                                    |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | «Nuevo reporte» mide 38 px de alto entre 421 y 768 px (un teléfono de 430 px cae ahí)       | `src/lib/layout/HeaderBar.svelte:153-157`     | `@media (pointer: coarse) { .acceso-captura { min-height: 44px; } }`              |
| 2   | El resultado de guardar queda fuera de la vista                                             | §1.2                                          | Resultado en la tarjeta de origen                                                 |
| 3   | La casilla mide 32 px y su nombre solo existe en `aria-label`                               | `seguimiento/CasillaSeguimiento.svelte:27-34` | Casilla de 44 px con etiqueta visible (§5.3)                                      |
| 4   | `<input type="month">` sin selector en Firefox y Safari de escritorio                       | `src/routes/seguimiento/+page.svelte:68`      | `NavegacionMes` (§1.3)                                                            |
| 5   | Con el menú abierto en teléfono, el contenido de atrás sigue recibiendo el foco del teclado | `src/routes/+layout.svelte:172`               | `inert={mobileMenuOpen}` en `<main>` (deseable)                                   |
| 6   | Seguimiento queda a dos toques (menú → Seguimiento) y la portada del operativo no lo enlaza | `views/MiTrabajoView.svelte`                  | Tarjeta «Seguimiento de mis centros» en «Mi trabajo» (deseable, fuera de alcance) |

`.main` es el contenedor que se desplaza (`body` tiene `overflow: hidden`): cualquier elemento
fijo debe usar `position: sticky` dentro de `.main`, no `fixed`. La única barra pegada que se
propone es «Guardar cobranza» en teléfono (§6.4), con
`padding-bottom: max(12px, env(safe-area-inset-bottom))`.

## 3. Estatus y KPI: piezas comunes

### 3.1 Insignia de estatus

Icono + texto + color; el icono cambia de forma con cada estatus.

| `estatus`        | Texto            | Clase                | Icono (24 × 24, trazo 2.25)                            |
| ---------------- | ---------------- | -------------------- | ------------------------------------------------------ |
| `atrasado`       | «Atrasado»       | `.status-badge.err`  | triángulo de alerta (el de `MiTrabajoView.svelte:174`) |
| `con_pendientes` | «Con pendientes» | `.status-badge.warn` | reloj (`M12 3a9 9 0 1 0 0 18…M12 7v5l3 2`)             |
| `al_corriente`   | «Al corriente»   | `.status-badge.ok`   | marca (`M20 6 9 17l-5-5`)                              |
| `sin_datos`      | «Sin datos»      | `.status-badge`      | círculo con guion                                      |

No se usa franja de color en el borde de la tarjeta: el estatus es la insignia.

### 3.2 Indicador (`BarraKpi`)

Una fila: nombre a la izquierda, barra al centro y cifra a la derecha; debajo, `detalle` en
`.view-note` si existe. En menos de 420 px la barra pasa a una segunda línea a todo el ancho.

```text
Ejecución     ████████████░░░░   ✓  8 de 10
Documentos    ███████░░░░░░░░░   ◆  12 de 24
              Faltan: Reporte (3), ODT (1)
Carpetas      █████░░░░░░░░░░░   ↓  1 de 3 recibidas
              1 entregada, 1 sin entregar
```

- Cifra: `{valor} de {total}`; sin `total`, `{porcentaje} %`; sin denominador, «Sin datos» en
  `--tinta-tenue` y sin barra. Clase `.cifra`.
- Junto a la cifra, el trazo del semáforo de `Semaforo.svelte` (flecha abajo, rombo, marca) con
  texto oculto «bajo la meta», «cerca de la meta», «en meta».
- `<progress max={total} value={valor} aria-label="Ejecución: 8 de 10">`.
- Nombres: «Ejecución del mes» o «Ejecución del ciclo» (programa anual; ver §10.6), «Estaciones
  de medición», «Documentos», «Carpetas», «Cobranza», «Cobro de EM» o «Cobro de actividades»,
  «Contrato».
- «Cobranza» añade los cuatro pasos del mes como lista en línea, cada uno con marca o guion y su
  nombre: «✓ Estimación · ✓ Prefactura · — Factura · — Cobrado».
- Emergencias no es barra: una línea «Atenciones de emergencia: 2» con enlace a `#emergencias`.

### 3.3 «Qué falta»

Lista `<ul>` de enlaces; cada elemento ocupa 44 px de alto, con chevrón a la derecha. Título
`.rotulo-grupo` «Qué falta». Máximo cinco y «y 2 más» (enlace al seguimiento del centro).

| Caso                                | Frase                                                                                                          | Lleva a                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Actividades sin ejecutar            | «Falta 1 actividad por ejecutar» / «Faltan 4 actividades por ejecutar»                                         | `/seguimiento…#actividades`          |
| Documento faltante                  | «Reporte: falta 1» / «Reporte: faltan 3» (la etiqueta tal cual, sin pluralizarla)                              | `/seguimiento…#actividades`          |
| Carpeta pendiente o en preparación  | «Carpeta de seguridad sin entregar»                                                                            | `/seguimiento…#carpeta-<conceptoId>` |
| Carpeta entregada                   | «Carpeta de seguridad entregada: falta que la reciban»                                                         | igual                                |
| Carpeta recibida con comentarios    | «Carpeta de seguridad con comentarios: falta corregirla y entregarla de nuevo»                                 | igual                                |
| EM sin capturar                     | «Faltan las EM programadas del mes»                                                                            | `/seguimiento…#datos-mes`            |
| EM por realizar                     | «Faltan 2 EM por realizar»                                                                                     | igual                                |
| Cobranza (siguiente paso que falte) | «Falta la estimación de noviembre», «…la prefactura…», «…la factura…», «Falta registrar el cobro de noviembre» | `/cobranza…#cobranza`                |
| Contrato terminado sin carta        | «El contrato terminó y falta la carta de finalización»                                                         | `/cobranza…#carta`                   |
| Datos del contrato                  | «Falta 1 dato del contrato» / «Faltan 3 datos del contrato»                                                    | `/cobranza…#contrato`                |

Vacíos: al corriente → «Nada pendiente este mes.»; sin datos → «Todavía no hay nada capturado este
mes. Empiece por marcar las actividades ejecutadas.» (con enlace a `#actividades` si puede editar).

### 3.4 Tarjeta de centro (`TarjetaCentro`)

```text
┌────────────────────────────────────────┐
│ EM-00001                  [⚠ Atrasado] │  h3 + InsigniaEstatus grande
│ Centro de ejemplo                      │  .view-note
│                                        │
│ QUÉ FALTA                              │
│ Faltan 2 actividades por ejecutar    › │
│ Reporte: faltan 3                    › │
│ Carpeta de seguridad sin entregar    › │
│                                        │
│ Ejecución del mes  ██████░░  ↓ 6 de 10 │
│ Documentos         ████░░░░  ◆ 9 de 20 │
│ Carpetas           ░░░░░░░░  ↓ 0 de 2  │
│ Cobranza           █████░░░    62 %    │  solo con finanzas
│ Atenciones de emergencia: 1            │
│                                        │
│ [ Abrir seguimiento ]                  │
│ Contrato y cobranza ›                  │  solo con finanzas
└────────────────────────────────────────┘
```

- Orden fijo: nombre y estatus → «Qué falta» → indicadores → acciones. Así, en 360 px, estatus y
  primeras dos frases quedan en la primera pantalla.
- Hasta cinco indicadores, en este orden: ejecución, EM, documentos, carpetas, cobranza. «Cobro
  de EM» y «Contrato» aparecen en un `<details>` «Más indicadores» y, sobre todo, como frases de
  «Qué falta».
- **Rol sin `verContrato`:** la respuesta no trae `finanzas`; la tarjeta simplemente tiene menos
  filas y no muestra «Contrato y cobranza». No se pintan filas vacías, candados ni «sin permiso».
- Variantes: `tablero` (completa, con «Abrir seguimiento» como `.boton.primario` solo en la
  primera tarjeta atrasada y `.boton.contorno` en las demás); `ficha` (en `/seguimiento`: sin
  botones, los enlaces de «Qué falta» son anclas de la misma página, el título es «Estatus de
  noviembre 2026»); `compacta` (selector de centro: nombre, insignia y la primera frase; toda la
  tarjeta es un enlace).
- Sin datos: insignia «Sin datos», el texto vacío de §3.3 y ninguna barra.

## 4. A. Tablero de estatus (`/cumplimiento`)

Solo cambia el modo concentrado (sin `?contrato=`). El detalle por contrato queda como está.

```text
TELÉFONO (360–430)                       ESCRITORIO (≥ 1100)
┌──────────────────────────┐   ┌──────────────────────────────────────────────────────┐
│ Programa / Cumplimiento  │   │ Cumplimiento del programa                            │
│ Cumplimiento del programa│   │ Estatus de los centros de costo   ‹ oct  Nov 2026  › │
│ ‹ oct  Noviembre 2026  › │   │ [Todos 14][⚠ Atrasados 2][◷ Con pendientes 5]        │
│ Estatus de los centros   │   │ [✓ Al corriente 6][– Sin datos 1]   [Buscar centro…] │
│ [Todos 14] [⚠ Atras. 2]  │   │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│ [◷ Pend. 5] [✓ Al c. 6]  │   │ │ EM-00001  ⚠ │ │ EM-00002  ⚠ │ │ EM-00003  ◷ │      │
│ [– Sin datos 1]          │   │ │ Qué falta…  │ │ Qué falta…  │ │ Qué falta…  │      │
│ [Buscar centro…        ] │   │ │ barras…     │ │ barras…     │ │ barras…     │      │
│ ┌──────────────────────┐ │   │ └─────────────┘ └─────────────┘ └─────────────┘      │
│ │ TarjetaCentro        │ │   │ ▸ Ver como tabla                                     │
│ └──────────────────────┘ │   │ ── Cumplimiento del programa anual ───────────────── │
│ ┌──────────────────────┐ │   │ Filtros (contrato, centro, periodicidad)             │
│ │ TarjetaCentro        │ │   │ Indicadores · Por contrato · Tendencia · Reportes    │
│ └──────────────────────┘ │   └──────────────────────────────────────────────────────┘
│ ▸ Cumplimiento del       │
│   programa anual         │
└──────────────────────────┘
```

- **Mes de corte:** `NavegacionMes` (sin «siguiente» en el mes en curso). Sale de la tarjeta
  «Filtros»; contrato, centro y periodicidad bajan a la sección «Cumplimiento del programa anual»,
  cuyo formulario lleva el mes en un `<input type="hidden" name="corte">`.
- **Filtro por estatus:** cinco enlaces `GET` (`?estatus=atrasado`…), con aspecto de píldora
  (`.status-badge.grande` de 44 px de alto), el activo con `aria-current="true"` y borde
  `--accion`. Cada uno lleva icono, nombre y cuenta. Los de cuenta 0 se muestran atenuados y sin
  enlace. Funciona sin JavaScript.
- **Búsqueda:** `<input type="search" name="q">` con etiqueta visible «Buscar centro de costo» y
  `placeholder` «Clave o nombre». Con JavaScript filtra al escribir (sin acentos, con
  `normalizarBusqueda` de `dominio/seleccion.ts`); sin él, botón «Buscar» en `<noscript>`. Un
  `role="status"` dice «3 centros de costo» o «Ningún centro coincide con "xyz". Revise la clave o
  quite el filtro.» con el enlace «Quitar filtros».
- **Orden:** atrasado → con pendientes → sin datos → al corriente; dentro de cada grupo, más
  frases de «Qué falta» primero y, a igualdad, menor porcentaje de ejecución; luego por clave.
- **Rejilla:** `repeat(auto-fill, minmax(min(100%, 340px), 1fr))`, `gap: 16px`. Las tarjetas son
  `.card` con `margin-bottom: 0`.
- **Tabla (solo escritorio):** `<details>` «Ver como tabla», cerrado; oculto con `display: none`
  bajo 768 px. Columnas: Centro de costo (enlace al seguimiento) · Estatus · Ejecución ·
  Documentos · Carpetas · Cobranza · Qué falta (primera frase y «y 3 más») · Abrir («Seguimiento»,
  «Contrato y cobranza»). La columna «Cobranza» y el segundo enlace no se generan sin `finanzas`.
  Cifras como «8 de 10», alineadas a la derecha.
- **Resumen** (sustituye a la frase actual): «14 centros de costo en noviembre 2026: 2 atrasados,
  5 con pendientes, 6 al corriente y 1 sin datos.»
- **Vacíos:** sin centros → «Aún no tiene centros de costo asignados. Pida a administración que
  se los asigne en Personal.»; filtro sin resultados → «Ningún centro de costo está "Atrasado" en
  noviembre 2026.» + «Ver todos».
- **Carga:** al cambiar de mes o filtro, la rejilla recibe `aria-busy="true"` y `opacity: 0.6`
  mientras `$navigating` apunta a la misma ruta.
- En teléfono, «Cumplimiento del programa anual» va dentro de un `<details>` cerrado.

## 5. B. Seguimiento (`/seguimiento`)

### 5.1 Estructura

```text
TELÉFONO                                  ESCRITORIO
┌──────────────────────────┐   ┌────────────────────────────────────────────────────┐
│ Seguimiento operativo    │   │ Seguimiento operativo                              │
│ Centro de costo          │   │ Centro [EM-00001 · Centro… ▾]  ‹ oct Nov 2026 dic ›│
│ [EM-00001 · Centro… ▾]   │   │ ┌────────────────────────────────────────────────┐ │
│ ‹ oct   Nov 2026   dic › │   │ │ Estatus de noviembre 2026    [◷ Con pendientes]│ │
│ ┌──────────────────────┐ │   │ │ Qué falta (izquierda) │ Indicadores (derecha)  │ │
│ │ Estatus de nov 2026  │ │   │ └────────────────────────────────────────────────┘ │
│ │ [◷ Con pendientes]   │ │   │ Ir a: Actividades · Datos del mes · Carpetas · …   │
│ │ Qué falta …          │ │   │ ┌ Actividades de noviembre ─ 8 de 10 ejecutadas ─┐ │
│ │ Indicadores …        │ │   │ │ ┌ Partida ───────────────────────────────────┐ │ │
│ └──────────────────────┘ │   │ │ │ De la partida:  [☐ Reporte]                │ │ │
│ Ir a: Actividades ·      │   │ │ │ Ejecución 1 · 5 nov  [✓ Ejecutada] [✓ ODT] │ │ │
│ Datos del mes · Carpetas │   │ │ │ Ejecución 2     [Marcar ejecutada] [☐ ODT] │ │ │
│ · Emergencias            │   │ │ └────────────────────────────────────────────┘ │ │
│ ── Actividades ───────── │   │ │ ▸ Partida completa ✓                           │ │
│ [TarjetaPartida]         │   │ │ [Agregar una partida que no está en el progr.] │ │
│ [TarjetaPartida]         │   │ └────────────────────────────────────────────────┘ │
│ ▸ Partida completa ✓     │   │ Datos del mes │ Carpetas (rejilla) │ Emergencias   │
│ [Agregar una partida…]   │   └────────────────────────────────────────────────────┘
│ ── Datos del mes ─────── │
│ ── Carpetas ──────────── │
│ ── Atenciones de emerg.  │
└──────────────────────────┘
```

- Orden del DOM igual al visual: contexto → ficha → índice → `#actividades` → `#datos-mes` →
  `#carpetas` → `#emergencias`. Las actividades van antes que los datos del mes porque son la
  tarea diaria. Cada sección es una `<section class="card">` rotulada por su `<h2>` de clase
  `.view-heading`.
- **Índice:** `<nav aria-label="Secciones del seguimiento">` con enlaces ancla de 44 px, cada uno
  con su cuenta: «Actividades 8 de 10», «Carpetas 1 de 3», «Emergencias 2». Solo las secciones
  que existen. Sin él, en teléfono, registrar una emergencia exige recorrer todas las partidas.
- **Ficha:** `TarjetaCentro` variante `ficha` (§3.4).
- **Solo consulta:** `.aviso.aviso-info` bajo el contexto: «Solo consulta: su cuenta no puede
  modificar el seguimiento.» No se genera ningún formulario, botón ni `<details>` de edición; las
  casillas son texto con icono («✓ Hecho», «— Pendiente»).
- **Centro sin configurar:** el mensaje de §1.1 dentro de `.card`, sin secciones.

### 5.2 Tarjeta de partida

```text
┌────────────────────────────────────────┐
│ Mantenimiento a estación de ejemplo    │  h3 (id="p-<grupo>", tabindex="-1")
│ 1 de 2 ejecutadas · faltan 3 documentos│  .view-note    [Fuera del programa]
│                              Guardado ✓│  EstadoGuardado
│ DE LA PARTIDA · UNA VEZ AL MES         │  .rotulo-grupo
│ [ ☐ Reporte ]                          │
│────────────────────────────────────────│
│ Ejecución 1 de 2 · 5 nov               │
│ [ ✓ Ejecutada                        ] │  casilla ancha
│ [ ✓ ODT ]  [ ☐ AST ]  [ ☐ PT ]         │
│────────────────────────────────────────│
│ Ejecución 2 de 2                 [Hoy] │
│ [ Marcar ejecutada                   ] │  .boton.primario.ancho
│ [ ☐ ODT ]  [ ☐ AST ]  [ ☐ PT ]         │
│ Marcar todo hecho                      │  .boton.fantasma
│────────────────────────────────────────│
│ ▸ Editar partida                       │  solo escritas a mano
└────────────────────────────────────────┘
```

- Una tarjeta por `grupo`, en el orden del programa. Es un `<details>`: abierto si a la partida le
  falta algo y cerrado si está completa, con resumen «{partida} · ✓ Completa». El estado inicial
  se calcula al cargar y **no** reacciona al guardar (la tarjeta no se cierra sola al marcar lo
  último).
- Resumen: «{e} de {n} ejecutadas»; si faltan documentos, «· falta 1 documento» o «· faltan {n}
  documentos»; completa: «Completa».
- **Documentos por partida** (`nivel: 'partida'`): arriba, una vez, bajo el rótulo «De la partida
  · una vez al mes». El formulario envía la clave de la primera actividad del grupo (D2).
- **Fila de actividad:** título «Ejecución {i} de {n}» y fecha prevista con `textoFechaCorta`;
  insignia neutra «Hoy» si la fecha es hoy. Sin ejecutar: `.boton.primario.ancho` «Marcar
  ejecutada» (acción `ejecucion`, `valor=true`). Ejecutada: casilla ancha marcada «Ejecutada»
  (tocarla la desmarca). Debajo, sus documentos como casillas. Al final, solo si falta algo,
  «Marcar todo hecho» (acción `marcarFila`) con `aria-label` «Marcar ejecutada y todos sus
  documentos · {partida}, ejecución {i}».
- En escritorio la fila es una rejilla de una línea: `minmax(180px, 1.2fr) 200px minmax(0, 3fr)
auto` (título · ejecutada · documentos · «Marcar todo hecho»). Los documentos usan
  `repeat(auto-fill, minmax(132px, 1fr))` para que queden alineados entre filas.
- Conceptos que no son casilla: `estado` → etiqueta visible + `<select>` (se envía al cambiar;
  «Guardar» en `<noscript>`); cantidad, texto, fecha y enlace → etiqueta visible + campo +
  «Guardar» (`.boton`).
- Concepto por definir: insignia `.status-badge.por-definir` «Por definir» junto a la etiqueta; se
  puede marcar. Una sola vez por sección, la ayuda «Lo marcado como "Por definir" todavía no
  cuenta en el estatus.»
- «Fuera del programa»: `.status-badge` neutra junto al título, solo en centros con programa
  anual.
- Vacíos de la sección: programa anual sin actividades → «El programa anual no tiene actividades
  en noviembre 2026. Si se hizo un trabajo, agréguelo como partida.»; mensual → «Todavía no hay
  partidas en noviembre 2026. Agregue la primera.»; origen `ninguno` → la sección no se muestra.

### 5.3 Casilla (`CasillaSeguimiento`)

Botón `type="submit"` con `role="checkbox"`, `aria-checked` y **texto visible** (el nombre del
documento); `name="valor"`, `value` con el estado contrario, como hoy. Props: `etiqueta` (visible),
`contexto` (se añade al nombre accesible: «ODT · Partida X, ejecución 1»), `marcada`,
`puedeEditar`, `porDefinir = false`, `ancha = false`.

- Tamaño: `min-height: 44px` siempre (no depende de `pointer`), `padding: 8px 14px`, `gap: 8px`,
  `border-radius: var(--radio-control)`, separación entre casillas de 8 px.
- A la izquierda, un recuadro de 20 px: vacío con borde `--borde-campo`, o relleno con la marca.
  Colores en §1.4.
- Enviando: `form[aria-busy='true']` → borde punteado y `cursor: progress`.
- Consulta: `<span>` sin borde, «✓ ODT» o «— ODT», con texto oculto «Hecho» o «Pendiente».
- `:focus-visible` global (2 px `--foco`, separación 2 px); no se anula.

### 5.4 Partida escrita a mano (`FormularioPartida`)

Al final de «Actividades», un `<details>` con `<summary class="resumen-boton boton contorno
ancho">`: «Agregar una partida que no está en el programa» (programa anual) o «Agregar partida»
(mensual).

| Campo                       | Control                                                    | Ayuda                                            |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| «Nombre de la partida»      | texto, `required`, `maxlength="250"`, `autocomplete="off"` | «Escríbalo como aparece en la orden de trabajo.» |
| «Veces en el mes»           | número, 1 a 31, valor 1, `inputmode="numeric"`             | «Cuántas veces se ejecuta en noviembre 2026.»    |
| «Fecha prevista (opcional)» | fecha, dentro del mes                                      | —                                                |

Botón `.boton.primario.ancho` «Agregar partida» (acción `nuevaActividad`). Al guardar: mensaje
«Partida agregada. Ya puede marcarla.», el `<details>` se cierra y el foco va al título de la
tarjeta nueva (`#p-<id>`). Errores: nombre vacío → «Escriba el nombre de la partida.»; veces fuera
de rango → «Las veces en el mes van de 1 a 31.»

Edición (solo escritas a mano): `<details>` «Editar partida» al pie de su tarjeta, con nombre,
fecha, «Guardar cambios» y «Quitar partida» (`.boton.peligro`, `formnovalidate`). Si tiene
ejecuciones o documentos marcados, en lugar del botón: «No se puede quitar porque ya tiene
ejecuciones o documentos marcados. Desmárquelos primero.»

### 5.5 Carpeta por pasos (`CarpetaSeguimiento`)

```text
┌────────────────────────────────────────┐
│ Carpeta de seguridad      [Entregada]  │  h3 (id="carpeta-<id>") + insignia
│ ✓ 1 Preparar                           │
│ ✓ 2 Entregar · 12 nov · Persona Ejemplo│  <ol class="pasos">
│ ○ 3 Recibir · falta                    │
│ Documentos de la carpeta   6 de 8  ███░│
│ Abrir carpeta en SharePoint ↗          │
│ [ Registrar recibida correctamente   ] │  primario
│ [ Registrar recibida con comentarios ] │  contorno
│ ▸ Corregir la entrega                  │  fantasma
└────────────────────────────────────────┘
```

Tres pasos visibles (`<ol>`; el actual con `aria-current="step"`; cada uno con icono de hecho,
actual o pendiente, y texto). Insignias: «Pendiente» (neutra), «En preparación» (`.warn`),
«Entregada» (`.status-badge.info`), «Recibida con comentarios»
(`.warn`), «Recibida correctamente» (`.ok`).

| Estado                 | Qué se ve                                                               | Acción principal                   | Otras                                                          |
| ---------------------- | ----------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `pendiente`            | Paso 1 actual                                                           | «Entregar carpeta»                 | «Marcar en preparación» (un toque, sin campos)                 |
| `en_proceso`           | Paso 1 hecho, 2 actual                                                  | «Entregar carpeta»                 | «Volver a pendiente» (`.fantasma`)                             |
| `entregada`            | Quién y cuándo entregó; paso 3 actual                                   | «Registrar recibida correctamente» | «Registrar recibida con comentarios»; «Corregir la entrega»    |
| `recibida_comentarios` | `.aviso.aviso-alerta` «Comentarios de quien recibió: …», quién y cuándo | «Entregar de nuevo»                | «Registrar recibida correctamente»; «Corregir los comentarios» |
| `recibida`             | Los tres pasos hechos, quién recibió, cuándo y «Ver acuse»              | ninguna                            | «Corregir la recepción» (`.fantasma`)                          |

Cada acción con campos es un `<details name="carpeta-<id>">` (solo uno abierto a la vez) con su
propio formulario `multipart/form-data` y su `estado` en un campo oculto; así no hay campos
condicionales y funciona sin JavaScript. El botón de enviar nombra lo que guarda.

| Formulario                           | Campos                                                                                                                                                                                                                                        | Botón                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Entregar carpeta / Entregar de nuevo | «Quién entrega» (`<select>` del personal, `required`; preseleccionada la persona de la sesión). «Fecha de entrega» (`required`, hoy). «Enlace de la carpeta en SharePoint (opcional)». «O un archivo (opcional, hasta 8 MB)».                 | «Guardar entrega»     |
| Recibida correctamente               | «Quién recibe» (texto, `required`, 200). «Fecha de recepción» (`required`, hoy, mínimo la de entrega). Grupo «Acuse de recibido»: «Foto o archivo del acuse (hasta 8 MB)» (`accept="image/*,application/pdf"`) y «O el enlace de SharePoint». | «Guardar recepción»   |
| Recibida con comentarios             | «Quién recibe». «Fecha de recepción». «Comentarios» (`<textarea>`, `required`, 1000).                                                                                                                                                         | «Guardar comentarios» |

- Ayudas: acuse → «Tome una foto del acuse firmado o pegue el enlace. Solo uno de los dos.»;
  comentarios → «Escriba qué pidieron corregir.»; entregar con documentos incompletos →
  `.aviso.aviso-alerta` «Faltan 2 documentos de esta carpeta. Puede entregarla y completarlos
  después.» (no bloquea).
- **De «con comentarios» a entregar de nuevo:** «Entregar de nuevo» abre el formulario de entrega
  con quien entregó antes y la fecha de hoy. Al guardar, el estado vuelve a `entregada` y los
  comentarios siguen visibles como «Comentarios de la entrega anterior» hasta que quede recibida
  correctamente (ver §10.4).
- Errores: «Seleccione quién entrega la carpeta.», «Escriba la fecha de entrega.», «Escriba quién
  recibe la carpeta.», «Agregue el acuse: una foto, un archivo o el enlace.», «Deje solo uno: el
  archivo o el enlace.», «El archivo pesa más de 8 MB. Súbalo a SharePoint y pegue el enlace.»,
  «Escriba los comentarios de quien recibió.»
- Mensajes: «Carpeta entregada.», «Recepción con comentarios guardada. Falta corregir y entregar
  de nuevo.», «Carpeta recibida correctamente.»
- Por definir: insignia «Por definir» y la nota «Todavía no se define cómo es esta carpeta. Puede
  llenarla; no cuenta en el estatus.»
- «Documentos de la carpeta»: `BarraKpi` con los documentos del mes asignados a la carpeta (D1).
- Rejilla de carpetas: `repeat(auto-fit, minmax(min(100%, 20rem), 1fr))`.

### 5.6 Atenciones de emergencia (`AtencionesEmergencia`)

Lista `<ul>`; cada atención: fecha en negrita, horario «22:30 a 01:15» (o «Sin horario»), quién
asistió («Persona Uno, Persona Dos» o nada) y descripción; «Quitar» (`.boton.compacto.peligro`,
44 px en teléfono) con `aria-label` «Quitar la atención del 12 nov».

Vacío: «Sin atenciones de emergencia en noviembre 2026. Si atendió una, regístrela aquí.»

Formulario en `<details>` con `<summary class="resumen-boton boton primario ancho">` «Registrar
atención de emergencia»; se abre solo si el último envío falló.

| Campo                       | Control                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------- |
| «Fecha»                     | fecha, `required`, hoy (o el día 1 si se consulta otro mes), `min` y `max` del mes  |
| «Hora de inicio (opcional)» | `type="time"`; en la misma fila que la de fin, también en teléfono                  |
| «Hora de fin (opcional)»    | `type="time"`; ayuda: «Si terminó después de medianoche, escriba la hora tal cual.» |
| «Quién asistió (opcional)»  | `SelectorPersonas`                                                                  |
| «Qué se atendió (opcional)» | `<textarea>`, `maxlength="1000"`, 3 filas                                           |

Botón «Registrar atención». Mensaje: «Atención registrada.» Errores: «Escriba la fecha de la
atención.», «La fecha debe ser de noviembre 2026. Para otro mes, cambie el mes arriba.»

`SelectorPersonas`: `<fieldset>` con `<legend>`; dentro, campo «Buscar persona» (solo con
JavaScript; oculta las etiquetas que no coinciden y nunca las ya elegidas) y una lista de casillas
`name="asistentes"` con `max-height: 240px` y desplazamiento propio; cada etiqueta mide 44 px. Un
`role="status"` dice «2 personas elegidas». Sin coincidencias: «Nadie coincide con "xyz".» Sin
JavaScript es la lista completa de casillas.

### 5.7 Datos del mes

Conceptos de nivel periodo que no son carpeta (EM programadas, EM realizadas, EM con cobro…), en
`.form-grid`. Cada uno, su formulario: etiqueta visible, campo (`inputmode="numeric"` en
cantidades) y «Guardar». Casillas y estados, como en §5.2. Ayuda de la sección: «Se llenan una vez
al mes.» La sección no aparece si no hay conceptos.

## 6. C. Contrato y cobranza (`/cobranza`)

### 6.1 Estructura

```text
ESCRITORIO                                             TELÉFONO
┌────────────────────────────────────────────────┐    ┌────────────────────────┐
│ Centro [EM-00001 · Centro… ▾]   ‹ 2025 2026 › │    │ Centro [EM-00001… ▾]   │
│ ┌ Resumen (#resumen) ────────────────────────┐ │    │ ‹ 2025   2026   2027 › │
│ │ [◷ Con pendientes]  Ver seguimiento ›      │ │    │ Resumen (cifras 2×2)   │
│ │ Contrato $… │ Cobrado $… │ Por cobrar $…   │ │    │ ⚠ aviso de carta       │
│ │ Cobranza ██████░░ 62 %  ✓Est ✓Pre —Fac —Cob│ │    │ ▸ Contrato             │
│ └────────────────────────────────────────────┘ │    │ ▸ Órdenes de compra    │
│ ⚠ El contrato terminó y falta la carta…        │    │ Adicionales (tarjetas) │
│ Contrato            │ Carta de finalización    │    │ ▸ Carta de finalización│
│ Órdenes de compra (tabla)                      │    │ Cobranza 2026 (meses   │
│ Adicionales (tabla + alta)                     │    │   apilados)            │
│ Cobranza 2026 (tabla)      [Guardar cobranza]  │    │ [Guardar cobranza] fija│
│ Programa anual (enlace)                        │    └────────────────────────┘
└────────────────────────────────────────────────┘
```

Cambios de orden: «Programa anual» (un enlace) baja al final. En teléfono, «Contrato», «Órdenes de
compra» y «Carta de finalización» son `<details>` cerrados; «Adicionales» y «Cobranza» quedan
abiertos porque son la tarea frecuente.

### 6.2 Resumen (`ResumenFinanzas`)

- `InsigniaEstatus` del centro en el mes en curso y enlace «Ver seguimiento del centro».
- Cifras en `<dl class="rotulo">` con `.cifra`: «Monto del contrato», «Cobrado del contrato»,
  «Por cobrar» (monto − cobrado, solo con monto) y «Adicionales» («3 · pactado $… · cobrado $…»).
- `BarraKpi` «Cobranza» con los pasos del mes (§3.2).
- Bajo «Cobrado del contrato»: «Suma de la cobranza mensual. Lo llena contabilidad.» Si no hay
  cobranza y existe un valor anterior: ese valor con la insignia neutra «Captura anterior».
- Sin monto del contrato: «Sin monto del contrato» y el enlace «Capturarlo» (`#contrato`) si puede
  editar.

En «Contrato», el concepto con indicador `monto_cobrado` deja de ser campo:
`CampoConcepto soloLectura` muestra el valor y la nota «Se calcula con la cobranza mensual.»

### 6.3 Adicionales

Título «Adicionales» y nota «Trabajos fuera del contrato, cada uno con su orden de compra.
Contrato: EM-00001.»

Tabla `.tabla-apilable`: Orden de compra · Descripción · Solicitado · Ejecución («1 al 15 nov
2026») · Pactado · Cobrado · Acciones; fila final «Total» con pactado y cobrado. En teléfono cada
fila es una tarjeta con la orden de compra como título.

- **Con `editarContrato`:** `<details>` «Registrar adicional» (`.resumen-boton.boton.primario`;
  abierto si la lista está vacía): «Orden de compra» (`required`, 100), «Descripción (opcional)»
  (500), «Fecha de solicitud», «Inicio de la ejecución», «Fin de la ejecución», «Monto pactado»
  (`inputmode="decimal"`, `step="0.01"`). Nota: «Lo cobrado lo registra contabilidad.» Botón
  «Registrar adicional». Por fila, `<details>` «Editar» con los mismos campos, «Guardar cambios» y
  «Quitar adicional» (`.peligro`).
- **Con `editarCobranza`:** en la celda «Cobrado», un formulario en línea: campo «Monto cobrado»
  (etiqueta visible en teléfono, `aria-label` «Monto cobrado · orden EJ-001» en escritorio) y
  «Guardar cobro» (acción `cobroAdicional`). Sin `editarContrato` no hay alta, edición ni quitar.
- **Solo `verContrato`:** tabla sin la columna «Acciones».
- Vacío: «Sin adicionales registrados.» y, si puede editar, «Registre el primero con su orden de
  compra.»
- Errores: «Escriba la orden de compra.», «El fin de la ejecución no puede ser anterior al
  inicio.», «Escriba el monto con números, sin signos ni comas (por ejemplo, 15000.50).»
- Mensajes: «Adicional registrado.», «Cobro guardado. El estatus del centro se actualizó.»,
  «Adicional quitado.»

### 6.4 Cobranza mensual

Se conserva un solo formulario con «Guardar cobranza». La tabla pasa a `.tabla-apilable`:

- Marcado: `<table role="table">`, `<tr role="row">`, `<th role="columnheader|rowheader">` y
  `<td role="cell">` explícitos, porque `display: block` hace que algunos navegadores pierdan la
  semántica de tabla.
- Cada casilla va en `<label>` con un `<span class="etiqueta-celda">` («Estimación»…), oculto con
  `display: none` sobre 768 px (el encabezado de columna ya lo dice) y visible debajo. La etiqueta
  completa mide 44 px. Se quita el `aria-label` de la casilla donde la etiqueta visible la nombra.
- En teléfono cada mes es un bloque: nombre del mes, las cuatro casillas en rejilla 2 × 2 y «Monto
  cobrado» a todo el ancho. El mes en curso lleva la insignia neutra «Mes actual» y la página se
  abre con el ancla `#cobranza`.
- En teléfono, «Guardar cobranza» queda pegado abajo (`position: sticky; bottom: 0`, fondo
  `--superficie`, `box-shadow: var(--sombra-barra)`).
- Tras guardar, junto al botón: «Cobranza guardada.» y el enlace «Ver cómo quedó el estatus»
  (`#resumen`).
- Consulta: «✓ Hecho» o «— Pendiente» con texto, y montos con `textoMonto`.

Órdenes de compra: misma maqueta con `.tabla-apilable`; sin cambios de datos.

## 7. D. Editor de plantillas (`/catalogo/plantillas/[id]`)

Pantalla de administración en escritorio; aquí sí se usa el vocabulario del sistema. Solo se
añade a cada fila de `PlantillaEditor.svelte` una segunda línea «Opciones»:

```text
┌ Concepto ───────────┬ Tipo ───────────┬ Se registra ────┬ ↑ ↓ Quitar ┐
│ [Reporte          ] │ [Casilla ▾]     │ [Por partida ▾] │            │
├─────────────────────┴─────────────────┴─────────────────┴────────────┤
│ Carpeta [Carpeta de reportes ▾]   Qué mide [No alimenta… ▾]   ☐ Por definir │
└──────────────────────────────────────────────────────────────────────┘
```

- **«Se registra»** gana «Por partida» en «Documentos» y «Programa y actividades»
  (`ETIQUETA_NIVEL.partida`). Con esa opción, ayuda: «Una vez por partida en el mes, aunque se
  ejecute varias veces.» El bloque «Documentos por actividad» pasa a llamarse «Documentos».
- **«Qué mide»** (`indicador`): `<select>` que solo aparece si el bloque, tipo y nivel de la fila
  admiten algún indicador (tabla de D1). Primera opción «No alimenta ningún indicador». Opciones:
  «Monto del contrato», «Monto cobrado (se calcula con la cobranza)», «Monto facturado»,
  «Periodicidad», «EM programadas», «EM realizadas», «EM con cobro», «Actividad cobrada». Una
  opción ya usada por otro concepto sale deshabilitada: «EM programadas (ya la usa "EM del mes")».
  Al cambiar tipo o nivel, un indicador que deja de ser válido se borra y se avisa en un
  `role="status"`: «Se quitó "EM programadas" porque ya no corresponde a este tipo.»
- **«Por definir»**: casilla; ayuda (una vez por bloque): «Se puede llenar, pero no cuenta en los
  indicadores ni en "Qué falta".» Marcada, la fila muestra `.status-badge.por-definir`.
- **«Carpeta»**: solo en «Documentos» y solo si la plantilla tiene conceptos en «Carpetas».
  `<select>` con «Sin carpeta» y la etiqueta de cada carpeta. Ayuda: «Cuenta en el avance de esa
  carpeta.» Si se quita o renombra la carpeta, el documento vuelve a «Sin carpeta» con el mismo
  aviso de estado.
- La línea «Opciones» es `grid-column: 1 / -1`, `display: flex; flex-wrap: wrap; gap: 8px 16px`;
  bajo 768 px, todo en una columna (ya ocurre con `.concepto`).
- El error del servidor que nombra el concepto se muestra en `Aviso` y, además, la fila cuyo
  nombre coincide recibe `aria-invalid="true"` en el campo afectado.
- El campo oculto `conceptos` incluye `indicador`, `porDefinir` y `carpeta` (etiqueta o id, D1).

## 8. Recorridos de las tareas de aceptación

Toques contados desde que la pantalla está abierta; escribir un texto cuenta aparte.

| #   | Tarea                                           | Recorrido                                                                                                                                                                                                                                                                                               | Toques                           |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Encontrar mi centro y saber cómo va             | Menú → «Seguimiento». Con un centro: la ficha aparece ya, con insignia y «Qué falta» en la primera pantalla. Con varios: «Mis centros de costo» muestra el estatus de cada uno; tocar el suyo.                                                                                                          | 2 (3 con varios centros)         |
| 2   | Marcar ejecutada una actividad y sus documentos | Con el centro abierto, la partida pendiente está desplegada. «Marcar todo hecho» en la ejecución de hoy. Alternativa: «Marcar ejecutada» y cada documento.                                                                                                                                              | 1 (o 1 + un toque por documento) |
| 3   | Marcar el reporte de una partida                | En la tarjeta de la partida, «De la partida · una vez al mes» → casilla «Reporte».                                                                                                                                                                                                                      | 1                                |
| 4   | Escribir una partida fuera del programa         | «Ir a: Actividades» → «Agregar una partida que no está en el programa» → escribir el nombre → «Agregar partida» → en la tarjeta nueva (con el foco y la insignia «Fuera del programa»), «Marcar ejecutada».                                                                                             | 4 + nombre                       |
| 5   | Registrar una atención de emergencia            | «Ir a: Emergencias» → «Registrar atención de emergencia» → la fecha ya es hoy → hora de inicio y de fin → marcar quién asistió → «Registrar atención».                                                                                                                                                  | 3 + horas + 1 por persona        |
| 6   | Entregar y recibir una carpeta                  | «Qué falta: Carpeta… sin entregar» → «Entregar carpeta» → (quien entrega y fecha ya puestos) «Guardar entrega». Después: «Registrar recibida con comentarios» → quién recibe y comentarios → «Guardar comentarios». Después: «Registrar recibida correctamente» → foto del acuse → «Guardar recepción». | 3; 2 + texto; 3 + foto           |
| 7   | Registrar un adicional y lo cobrado             | Administración: `/cobranza` → centro → «Registrar adicional» → orden de compra y monto pactado → «Registrar adicional». Contabilidad: en la fila, «Monto cobrado» → «Guardar cobro».                                                                                                                    | 3 + datos; 1 + monto             |
| 8   | Llenar la cobranza de un mes                    | `/cobranza` → fila del mes: casillas y monto → «Guardar cobranza» → «Ver cómo quedó el estatus» sube al resumen con la insignia y la barra actualizadas.                                                                                                                                                | casillas + 2                     |
| 9   | Abrir el centro más atrasado                    | `/cumplimiento`: la primera tarjeta es la más atrasada → «Abrir seguimiento».                                                                                                                                                                                                                           | 1                                |

Meta de la tarea 2 (≤ 3 toques): se cumple con «Marcar todo hecho» (1) y, marcando a mano, con
hasta dos documentos (3).

## 9. Accesibilidad y táctil

- **Objetivos:** casillas, botones, enlaces de «Qué falta», píldoras de filtro, pasos de mes y
  `<summary>` miden 44 px de alto como mínimo en estas pantallas, con 8 px entre objetivos
  contiguos. `.boton.compacto` (32 px) no se usa bajo 768 px.
- **Foco:** se conserva el `:focus-visible` global. Tras guardar no se pierde el foco (§1.2). Los
  `<summary>` con aspecto de botón muestran el mismo anillo.
- **Nombres:** todo campo tiene etiqueta visible; «(opcional)» va en la etiqueta y lo obligatorio
  lleva `required`. Las casillas repetidas añaden su contexto al nombre accesible. Los errores de
  campo se enlazan con `aria-describedby` y `aria-invalid="true"`.
- **Regiones vivas:** `EstadoGuardado` (`role="status"`), errores (`role="alert"`), cuenta de la
  búsqueda y de personas elegidas (`role="status"`). Una sola región por tarjeta; el mensaje solo
  se genera en la tarjeta que originó el envío, para que no se anuncie dos veces.
- **Encabezados:** `h1` de la página, `h2` por sección, `h3` por partida, carpeta o centro.
- **Orden de lectura:** el del DOM; no se usa `order` ni rejillas que reordenen.
- **Sin depender del color:** estatus, semáforos, pasos y casillas llevan icono y texto. Las
  barras siempre tienen su cifra.
- **Zum y texto grande:** rejillas con `minmax(min(100%, …), 1fr)` y `flex-wrap`; nada con ancho
  fijo. A 200 % de zum en 360 px no hay desplazamiento horizontal. `overflow-wrap: anywhere` en
  nombres de partida y de centro.
- **Teclados:** `inputmode="numeric"` en cantidades, `inputmode="decimal"` en montos,
  `enterkeyhint="done"` en formularios de un campo, `autocomplete="off"` en nombres y órdenes.
- **Movimiento:** ninguna animación nueva salvo el giro del chevrón de `<details>` (150 ms), ya
  cubierto por `prefers-reduced-motion`.
- **Ambos temas:** solo tokens; ningún color literal. Comprobar las insignias y barras en
  `data-theme="dark"`.

## 10. Dónde el contrato de datos se queda corto

Para el agente de base de datos y dominio:

1. **`queFalta` devuelve solo frases** (D9). Hace falta `{ texto, destino, ancla? }` con
   `destino` en `actividades | documentos | datos_mes | carpeta | cobranza | contrato | carta` y,
   en carpetas, el `conceptoId`, para que cada frase lleve al lugar donde se resuelve. Los textos
   son los de §3.3.
2. **`ResumenCentro.carpetas[]` y `documentos.faltantes[]` no llevan `conceptoId`** (D8); se
   necesita para el ancla de la carpeta y para no depender de la etiqueta.
3. **Conceptos en las respuestas de captura.** D1 solo nombra `json_plantilla_seguimiento`. La
   respuesta de `api_obtener_seguimiento_operativo` necesita en cada concepto `porDefinir`,
   `carpetaId` y el nivel `partida`; la de `api_obtener_contrato_cobranza`, `indicador` (para
   mostrar «Monto cobrado» de solo lectura) y `porDefinir`.
4. **Volver a entregar tras «con comentarios»** (D5): definir que al pasar de
   `recibida_comentarios` a `entregada` se conservan `comentarios`, y que se limpian al llegar a
   `recibida`. También los nombres de los campos del acuse en el formulario (`acuseEnlace`,
   archivo `acuse`, `quitarAcuse`).
5. **Monto cobrado:** el plan (§3, decisión 8) suma cobranza mensual y adicionales; D7 solo la
   cobranza mensual. Este diseño los muestra separados («Cobrado del contrato» y «Adicionales»).
   Confirmar que `finanzas.cobrado` no incluye adicionales, o renombrar las cifras.
6. **Ejecución del mes o del ciclo:** con programa anual el KPI es acumulado del ciclo (plan
   §3.1) y la sección «Actividades» cuenta el mes. El KPI debe decir cuál es (`etiqueta` distinta
   o un campo `alcance: 'mes' | 'ciclo'`) para rotularlo «Ejecución del ciclo».
7. **Rutas (no base):** `/cobranza` y la entrada de `/seguimiento` sin centro también necesitan
   `api_estatus_centros` (la tarea 3.2 solo nombra `/cumplimiento` y `/seguimiento`); las acciones
   devuelven `ancla`; la carga de `/seguimiento` entrega el `id` de personal de la sesión para
   preseleccionar «Quién entrega».

## 11. Prioridades

**Imprescindible**

- Resultado de guardar en la tarjeta de origen, con ancla y sin JavaScript (§1.2).
- `CasillaSeguimiento` de 44 px con etiqueta visible; partidas como tarjetas con documentos por
  partida y «Marcar ejecutada» (§5.2, §5.3).
- Ficha de estatus en `/seguimiento` y tablero de tarjetas ordenado en `/cumplimiento`, con
  insignia de icono y texto, barras con cifra y «Qué falta» (§3, §4).
- Carpeta por pasos con sus tres formularios y el regreso desde «con comentarios» (§5.5).
- Atenciones de emergencia con horario y personal (§5.6).
- Partida escrita a mano con «Veces en el mes» y la insignia «Fuera del programa» (§5.4).
- Adicionales con alta para administración y cobro para contabilidad; «Monto cobrado» de solo
  lectura (§6.2, §6.3).
- Nada financiero en pantalla sin `finanzas`; tarjetas y tabla sin huecos.
- Campos nuevos del editor de plantillas (§7).
- Índice «Ir a» en `/seguimiento` (§5.1).
- Sin desplazamiento horizontal a 360 px; textos de §1.1.

**Importante**

- «Qué falta» como enlaces al lugar exacto (depende de §10.1 y §10.2).
- Partidas completas plegadas.
- `BarraContexto` con `NavegacionMes` en lugar de `<input type="month">`.
- «Mis centros de costo» al entrar a `/seguimiento` con varios centros.
- Filtro por estatus y búsqueda del tablero; `<details>` «Ver como tabla».
- `.tabla-apilable` en cobranza mensual, órdenes de compra y adicionales, con «Guardar cobranza»
  pegado abajo en teléfono.
- Resumen de `/cobranza` con el estatus del centro (tarea 8).
- `SelectorPersonas` con búsqueda; foco al título de la tarjeta tras guardar.
- Arreglo 1 del armazón (§2).

**Deseable**

- «Marcar todo hecho» por ejecución con su nombre accesible completo; insignia «Hoy».
- Aviso no bloqueante de documentos faltantes al entregar una carpeta.
- Pasos de cobranza del mes dentro de la barra «Cobranza»; `<details>` «Más indicadores».
- `aria-busy` y atenuado de la rejilla durante la navegación.
- Avisos de estado al invalidarse un indicador o una carpeta en el editor de plantillas.
- Arreglos 5 y 6 del armazón (§2).
