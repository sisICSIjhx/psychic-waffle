# Plan de diseño de interfaz y experiencia de usuario

Fecha: 2026-10-20. Estado: propuesta para revisión; no hay cambios implementados.

Prioridad pedida por el usuario: funcionalidad y experiencia de usuario primero, después la estética.
La interfaz debe entenderse sin capacitación y apoyar la meta del producto: elaborar un reporte
FOR-ICSI-RMT-01 en 30 minutos o menos (hoy, unos 60).

## 1. Cómo se armó este plan

1. Investigación de reglas y principios reconocidos de diseño de interfaces (sección 2 y fuentes).
2. Revisión del código de la interfaz (`src/routes/`, `src/lib/layout/`, `src/lib/components/`,
   `src/app.css`).
3. Auditoría en el navegador con la base local (PGlite): panel, captura, editor, planeación e
   historial, a 1366 × 800 y a 375 × 812 (móvil), con mediciones de contraste, tamaño de controles,
   alto de página y desbordes.

## 2. Reglas de diseño que se deben seguir

### 2.1 Heurísticas de usabilidad de Nielsen (NN/g)

| #   | Heurística                                       | Qué exige                                                                                |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | Visibilidad del estado del sistema               | Informar siempre qué está pasando, con retroalimentación oportuna.                       |
| 2   | Relación con el mundo real                       | Hablar el idioma del usuario y seguir el orden natural de su trabajo.                    |
| 3   | Control y libertad                               | Salidas claras, cancelar y deshacer.                                                     |
| 4   | Consistencia y estándares                        | Mismas palabras, controles y comportamientos en toda la aplicación y según convenciones. |
| 5   | Prevención de errores                            | Evitar las condiciones de error, buenos valores por omisión y confirmar lo riesgoso.     |
| 6   | Reconocer antes que recordar                     | Opciones, contexto y acciones visibles; no obligar a memorizar.                          |
| 7   | Flexibilidad y eficiencia                        | Aceleradores para el usuario frecuente sin estorbar al nuevo.                            |
| 8   | Diseño estético y minimalista                    | Quitar lo irrelevante o poco usado de la vista principal.                                |
| 9   | Reconocer, diagnosticar y recuperarse de errores | Mensajes en lenguaje claro, visibles y con la solución.                                  |
| 10  | Ayuda y documentación                            | Ayuda breve, en contexto y orientada a la tarea.                                         |

### 2.2 Reglas de oro de Shneiderman (complementan a Nielsen)

Consistencia; atajos para usuarios frecuentes; retroalimentación proporcional a la importancia de la
acción; **diálogos con cierre** (inicio, desarrollo y final claros); prevención y manejo simple de
errores; acciones reversibles; **el usuario tiene el control** (él inicia las acciones); reducir la
carga de memoria de corto plazo.

### 2.3 Leyes de UX aplicables

- **Jakob:** los usuarios esperan que la aplicación funcione como las que ya conocen; usar patrones
  convencionales (menú lateral, migas, tablas con filtros, botones primarios a la derecha).
- **Hick:** el tiempo de decisión crece con el número y complejidad de opciones; reducir y ordenar lo
  que se ofrece en cada paso.
- **Fitts:** el tiempo para alcanzar un control depende de su tamaño y distancia; acciones frecuentes
  grandes y cerca del contenido.
- **Memoria de trabajo limitada (Miller):** agrupar en bloques con sentido; no es una regla de «siete
  elementos por menú».
- **Tesler:** la complejidad no desaparece, se traslada; que la absorba el sistema (prellenado,
  cálculos) y no el técnico.
- **Umbral de Doherty y tiempos de respuesta:** respuestas por debajo de 0,4 s mantienen el ritmo;
  0,1 s se percibe instantáneo, 1 s conserva el hilo de pensamiento y a los 10 s se pierde la
  atención: mostrar progreso en operaciones largas (fotos, DOCX).

### 2.4 Percepción visual (Gestalt)

- **Proximidad:** lo relacionado va junto (etiqueta con su campo, acciones con su elemento).
- **Similitud:** lo que funciona igual se ve igual (todos los estados, todos los botones primarios).
- **Región común:** tarjetas y fondos agrupan; abusar de bordes genera ruido.
- **Jerarquía:** un solo elemento dominante por pantalla (la siguiente acción).

### 2.5 Patrones específicos para esta aplicación

- **Formularios:** etiqueta visible sobre el campo; formato esperado explícito; validación al salir
  del campo o tras el primer intento de envío; mensaje junto al campo (`aria-describedby`) y, con
  varios errores, un resumen con enlaces que lleve el foco al primero; nunca borrar lo capturado.
- **Valores por omisión inteligentes:** prellenar cuando el sistema conoce el valor real (catálogo,
  reporte anterior); usar suposiciones solo si casi todos elegirían lo mismo y dejarlas editables.
- **Autoguardado:** estado visible y cerca del contenido (guardando, guardado, error), reintento ante
  un fallo, aviso al salir con cambios pendientes y guardado tras una pausa (ya se hace).
- **Acciones destructivas:** preferir **deshacer** para lo reversible; reservar la confirmación para lo
  irreversible (emitir), con la opción segura por omisión y `Esc` para cancelar. Confirmar todo acaba
  en que nadie lee las confirmaciones.
- **Pasos y secciones:** asistente (pasos en orden) para flujos secuenciales cortos; índice o acordeón
  cuando el usuario salta entre secciones de un formulario largo.
- **Estados vacíos (NN/g):** decir si de verdad no hay datos o si se está cargando, enseñar para qué
  sirve el espacio y ofrecer el botón que lo llena.
- **Tablas:** encabezado y primera columna fijos, pocos filtros visibles y el resto en «Más filtros»,
  filtros activos visibles, orden por columna y acciones de fila consistentes.
- **Paneles:** pocos indicadores, accionables, con contexto (avance contra meta) y rojo solo para lo
  que exige actuar ya.
- **Divulgación progresiva:** mostrar primero lo necesario y dejar lo avanzado o poco frecuente a un
  clic.

### 2.6 Accesibilidad mínima: WCAG 2.2 nivel AA

| Criterio                    | Requisito                                                                       |
| --------------------------- | ------------------------------------------------------------------------------- |
| 1.4.3 Contraste (mínimo)    | Texto 4.5:1; texto grande 3:1.                                                  |
| 1.4.11 Contraste no textual | Bordes de campos, iconos informativos y foco: 3:1.                              |
| 1.4.1 Uso del color         | El color nunca es el único medio de transmitir un estado.                       |
| 2.5.8 Tamaño del objetivo   | Mínimo 24 × 24 px (recomendado 44 × 44 px en pantallas táctiles, Apple/Google). |
| 2.4.7 y 2.4.11 Foco         | Foco visible y no tapado por barras fijas.                                      |
| 2.5.7 Arrastre              | Todo lo que se arrastra tiene alternativa con un clic.                          |
| 3.3.1 y 3.3.3 Errores       | Identificar el error en texto y sugerir la corrección.                          |
| 3.3.7 Entrada redundante    | No pedir de nuevo lo que el usuario ya proporcionó en el proceso.               |
| 3.1.1 Idioma de la página   | `lang` correcto en el documento.                                                |

## 3. Diagnóstico de la interfaz actual

### 3.1 Lo que funciona y se conserva

- Autoguardado con concurrencia optimista, aviso de conflicto y aviso al salir con cambios.
- Captura guiada cuyos pasos viven en la URL; la celda pendiente de la planeación abre la captura con
  partida y mes ya elegidos.
- Prellenado desde el catálogo (objetivo, alcances, herramientas, conclusiones, firmantes).
- Buen uso de `aria-label`, `role="status"`/`alert`, `:focus-visible` y etiquetas en la mayoría de los
  campos; estados vacíos con enlace al siguiente paso en varias vistas.
- Confirmación propia (no nativa) al omitir la tabla de verificación, que conserva los datos.

### 3.2 Hallazgos

Severidad: **A** bloquea o retrasa mucho la tarea, **M** la entorpece, **B** detalle o deuda.
Reglas: **N1** a **N10** son las heurísticas de Nielsen (2.1) y **S** las reglas de Shneiderman
(2.2). Mediciones del 2026-10-20 con los datos locales.

| ID  | Sev. | Hallazgo y evidencia                                                                                                                                                                                                                                                | Reglas            |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| H1  | A    | **Elegir la partida** es una lista desplegable de 55 opciones (Cerritos) con textos largos truncados, sin búsqueda y sin indicar cuáles están programadas o vencidas en el mes ni si ya existe un borrador.                                                         | Hick, N6, N5      |
| H2  | A    | **El editor mide 5 pantallas** en escritorio y 6,3 en móvil, con 47 campos y sin índice de secciones. Los pendientes para enviar a revisión aparecen al final mientras el botón está arriba, y no llevan al campo.                                                  | N1, N6, S-cierre  |
| H3  | A    | **Contraste insuficiente:** texto blanco sobre el primario 2.77:1 (claro) y 2.14:1 (oscuro); enlaces en tema claro 2.77:1; insignias de éxito y alerta en claro 2.28:1 y 1.92:1; bordes de campo 1.18:1 (claro) y 1.72:1 (oscuro).                                  | WCAG 1.4.3/1.4.11 |
| H4  | A    | **Los estados del reporte no se distinguen:** las clases `estado-borrador`, `estado-en_revision`, `estado-emitido` y `estado-sustituido` no tienen estilo; la insignia se ve como texto plano. La matriz P/R comunica el estado solo con color.                     | N1, WCAG 1.4.1    |
| H5  | A    | **Móvil:** el editor se desborda horizontalmente a 375 px; 14 de 32 controles miden menos de 24 px (las flechas ↑↓ miden 15 × 27 px); la barra fija de estado ocupa 161 px (20 % de la pantalla) y puede tapar el foco.                                             | Fitts, WCAG 2.5.8 |
| H6  | M    | **Indicador «Conectado» falso:** siempre verde, no refleja la conexión ni el resultado del guardado.                                                                                                                                                                | N1                |
| H7  | M    | **Campos de firmas sin estilo:** fondo blanco, texto negro y relleno de 1 px en el tema oscuro, distintos al resto de los campos.                                                                                                                                   | N4                |
| H8  | M    | **Panel sin jerarquía ni acciones:** cinco indicadores iguales; «Realizado del mes: 0» sin referencia a las 33 programadas; los 156 vencidos no destacan y su enlace va a la planeación en lugar de a «Capturar».                                                   | N8, paneles       |
| H9  | M    | **Planeación:** el encabezado de meses se pierde al desplazar (55 filas, 7 pantallas); no hay leyenda; las celdas «P 1 / R 0» son densas y «Capturar» es pequeño.                                                                                                   | N6, tablas        |
| H10 | M    | **Historial:** ocho filtros siempre visibles con comportamiento mixto (las listas buscan al cambiar, TAG y meses requieren «Buscar»); sin búsqueda por texto ni orden por columna.                                                                                  | N4, Hick          |
| H11 | M    | **Confirmaciones nativas** (`confirm()`) para emitir, quitar alcance y quitar foto, sin deshacer; el autoguardado vuelve definitiva la eliminación en 1,5 s.                                                                                                        | N3, S-reversión   |
| H12 | M    | **Descargar DOCX desaparece** si falta la fecha de ejecución, sin explicar por qué.                                                                                                                                                                                 | N1, N6            |
| H13 | M    | **Navegación con callejones sin salida:** «Personal» y «Mi Perfil» muestran «Sección en preparación»; marca «ICSI V2» frente a «ICSI Reportes»; la cabecera del editor dice «Captura de Reportes» en vez del reporte abierto.                                       | N4, N8            |
| H14 | B    | **Preferencias que no se recuerdan:** el tema siempre inicia oscuro (se aplica en `onMount`, con parpadeo del tema claro) y no respeta la preferencia del sistema; el menú colapsado tampoco se recuerda.                                                           | N7                |
| H15 | B    | **Accesibilidad base:** `lang="en"` en `src/app.html`; sin enlace «Saltar al contenido»; el menú marca la página activa solo con clase (falta `aria-current`); la animación de entrada de 0,3 s ignora `prefers-reduced-motion`.                                    | WCAG 3.1.1, 2.4.1 |
| H16 | B    | **Textos:** plurales con «(s)» («1 programa(s) anual(es) vigente(s)»), meses en mayúsculas en el panel y títulos de catálogo en mayúsculas sostenidas, que se leen peor.                                                                                            | N2                |
| H17 | B    | **Deuda de estilos:** CSS duplicado entre `app.css` y `Sidebar.svelte`; reglas heredadas sin uso (calendario, FAB, gestor de imágenes, `#btn-collapse`); variables no definidas (`--card-bg`, `--surface-2`); los componentes de `fields/` no se usan en el editor. | N4                |

## 4. Principios del rediseño

1. **El trabajo pendiente primero.** Al abrir la aplicación se ve qué toca hacer y se empieza con un
   clic.
2. **Un camino corto y obvio.** De un pendiente a un reporte listo para revisión con el menor número
   de decisiones; el sistema propone y el usuario confirma.
3. **Contexto siempre visible.** Cliente, sitio, partida, periodo y estado a la vista en todo momento.
4. **Estado honesto.** Guardado, errores, avance y conexión reales, en texto e icono, no solo color.
5. **Prevenir y deshacer.** Evitar el error antes de que ocurra; deshacer en lo reversible y confirmar
   solo lo irreversible.
6. **Un solo sistema visual.** Mismos componentes, tokens y palabras en todas las pantallas.
7. **Accesible por defecto.** WCAG 2.2 AA como piso y controles cómodos en pantalla táctil para tomar
   y subir fotos.

## 5. Propuesta por área

### 5.1 Base: sistema de diseño (habilita todo lo demás)

- **Tokens de color con contraste AA** en `src/app.css` (valores medidos):
  - Primario en tema claro `#0369a1` (blanco sobre él 5.93:1; como enlace sobre blanco 5.93:1). En
    tema oscuro conservar `#38bdf8` con texto `#0f172a` en los botones (8.33:1).
  - Semánticos para texto sobre blanco: éxito `#15803d` (5.02:1), alerta `#a16207` (4.92:1), peligro
    `#b91c1c` (6.47:1). En oscuro: `#4ade80`, `#facc15` y `#f87171` sobre `#1e293b` (8.4, 9.55 y
    5.29:1).
  - Borde de campos `#64748b` (4.76:1 sobre blanco; 3.75:1 sobre `#0f172a`).
  - Definir las variables que hoy faltan (`--surface-2`, `--card-bg`) o sustituirlas.
- **Escalas:** espaciado en múltiplos de 4 px, tipografía de 4 a 5 tamaños, radios, sombras y capas
  (`z-index`) como variables.
- **Componentes compartidos** (sintaxis Svelte heredada, como el resto del proyecto):
  `Boton` (primario, secundario, peligro y fantasma; alto mínimo 40 px en escritorio y 44 px en
  táctil), `Campo` (etiqueta, ayuda y error enlazados), `Selector con búsqueda`, `InsigniaEstado`
  (icono + texto + color), `Aviso` y `Notificacion` (`role="status"`, con «Deshacer»), `Dialogo`
  (foco atrapado, `Esc`, foco inicial en la opción segura), `Tarjeta`, `Tabla`, `EstadoVacio`,
  `Esqueleto` de carga e `IndiceSecciones`. Reutilizar y ampliar `src/lib/components/fields/`.
- **Iconos:** un componente `Icono` con los trazos que ya usa la barra lateral, para no repetir SVG.
- **Movimiento:** quitar la animación de entrada de cada vista o limitarla y respetar
  `prefers-reduced-motion`.
- **Limpieza:** eliminar CSS sin uso y duplicado. Decidir una sola vía de estilos: variables globales
  más estilos con alcance por componente (lo que ya predomina) y Tailwind solo si se adopta en todo.

### 5.2 Estructura y navegación

- **Menú:** «Mi trabajo» (inicio), «Capturar», «Planeación», «Historial» y «Catálogo». Ocultar
  «Personal» y «Mi Perfil» hasta que existan (llegarán con la autenticación). Los accesos por cliente
  pasan a ser un selector dentro de «Capturar» (o se conservan como subelementos si el usuario
  prefiere entrar por cliente).
- **Cabecera contextual:** título de la página o del reporte abierto, migas completas y, en el editor,
  el estado del guardado. Quitar «Conectado» o convertirlo en un indicador real (sin conexión,
  guardado pendiente).
- **Preferencias:** tema guardado en el navegador y aplicado antes de pintar la página (sin parpadeo),
  con la preferencia del sistema como valor inicial; menú colapsado recordado.
- **Accesibilidad base:** `lang="es"`, enlace «Saltar al contenido», `aria-current="page"` y barra de
  progreso de navegación cuando una carga pase de 1 s.

### 5.3 Inicio: «Mi trabajo»

- **Encabezado de avance:** «Octubre 2026: 0 de 33 partidas realizadas» con barra de progreso.
- **Tarjetas accionables** (texto + icono + color): vencidos (peligro), pendientes del mes,
  borradores abiertos y en revisión. Cada una lleva a su lista filtrada.
- **Lista «Siguiente trabajo»:** pendientes ordenados por urgencia (vencidos primero) con acción
  primaria **Capturar**, que abre la captura con todo preseleccionado; si ya hay borrador de esa
  partida y periodo, la acción es **Continuar borrador**.
- **Estados vacíos** con la siguiente acción («Sin programas vigentes: importe el programa desde el
  catálogo» con botón).

### 5.4 Captura: crear un reporte

- **Selector de partida con búsqueda** (número o texto) en lugar de la lista desplegable, agrupado:
  «Programadas este mes» (pendientes y vencidas, con insignia), «Con borrador» y «Otras partidas».
  Cada opción muestra número, actividad completa en dos líneas y periodicidad.
- **Contexto como resumen:** si el cliente tiene un solo contrato y sitio, mostrarlos como
  «Cerritos · contrato · sitio [Cambiar]» en lugar de listas ya resueltas.
- **Pasos visibles** (1 Partida, 2 Periodo y TAG, 3 Crear) con lo elegido resumido arriba.
- **Prevención de duplicados:** advertir si ya existe un borrador o un emitido de esa partida y
  periodo, con enlace a abrirlo.
- **Mes sugerido:** el pendiente más antiguo o el mes actual; TAG preseleccionado si solo hay uno (ya
  se hace).

### 5.5 Editor del reporte (mayor impacto en la meta de 30 minutos)

Esquema propuesto en escritorio:

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Cerritos › Partida 7 › Mayo 2026     [Borrador] ✓ Guardado hace 5 s           │
│ Listo para revisión: faltan 4  [Ver pendientes]        [Descargar] [Enviar ▸] │
├──────────────────────┬────────────────────────────────────────────────────────┤
│ Índice               │  Datos de la ejecución   (fecha, tipo, TAG)            │
│ ✓ Encabezado         │  Firmas            Elaboró · Aprobó · Recibió [Editar] │
│ ✓ Firmas             │  1. Objetivo       (del catálogo)              [Editar] │
│ ✓ 1. Objetivo        │  2. Alcance                                            │
│ ! 2. Alcance (4)     │   ▾ 2.1 Título ··· 3 fotos · Verificación: [C][O][NA]  │
│     2.1 ! · 2.2 !    │   ▸ 2.2 Título ··· 0 fotos · sin verificar             │
│ ✓ Herramientas       │  Herramientas y equipo   (tabla compacta)              │
│ ✓ Conclusiones       │  Conclusiones                                          │
└──────────────────────┴────────────────────────────────────────────────────────┘
```

- **Índice de secciones fijo** con marca de completitud (✓ o «!» con cantidad) que lleva a cada
  sección y alcance; en móvil, un índice desplegable bajo la barra.
- **Barra superior compacta** (una línea en escritorio, dos en móvil y sin pasar de 64 px fija):
  contexto, insignia de estado, guardado con hora relativa y **Reintentar** si falla, avance «faltan
  N» y la acción primaria según el estado.
- **Validación en el momento justo:** «Enviar a revisión» siempre disponible; si faltan datos, abre un
  resumen con enlaces a cada campo y mueve el foco al primero. Los campos marcan su error en texto
  junto al campo al salir de ellos.
- **Divulgación progresiva respetando el orden del formato:** las secciones siguen el orden del
  documento, pero lo que viene del catálogo y no cambia (usuario, contrato, sitio, periodicidad,
  firmas, objetivo) se muestra como resumen de lectura con **Editar**. Lo que cambia en cada
  ejecución (fecha, TAG, fotos, verificación y observaciones) queda abierto y destacado.
- **Fecha de ejecución:** atajo «Hoy» cuando cae en el periodo y mensaje claro del rango permitido.
- **Alcances como tarjetas plegables** con resumen (fotos, verificación). La verificación pasa de
  lista desplegable a **botones segmentados** (un clic) y el campo de observaciones aparece y se
  vuelve obligatorio solo con «con observación».
- **Fotos:**
  - zona para arrastrar y soltar más el botón «Agregar fotos»; en móvil, «Tomar foto» con la cámara
    trasera (`capture="environment"`);
  - progreso por foto («3 de 12») y error por archivo con la causa (ya se informa la causa);
  - miniaturas más grandes; mover, cambiar de espacio y quitar en un menú «⋯» con objetivos de 44 px;
  - quitar con **Deshacer** en una notificación, en lugar de `confirm()`.
- **Herramientas:** tabla compacta; `Enter` en la última fila agrega otra.
- **Descargar DOCX** visible siempre; deshabilitado con el motivo («Indique la fecha de ejecución»).
- **Emitir:** diálogo propio que resume lo que se emite, explica que es irreversible y deja el foco en
  «Cancelar».
- **Atajos discretos** para el usuario frecuente: `Ctrl+S` guarda en el momento, `Alt+↑/↓` cambia de
  sección; listados en una ayuda («?»).

### 5.6 Planeación

- **Encabezado de meses fijo** al desplazar, además de la columna de partidas (que ya es fija), y
  desplazamiento automático al mes actual.
- **Leyenda visible** y estados con símbolo + texto + color: ✓ cumplido, ● pendiente, ! vencido,
  \+ realizado sin programar.
- **Celdas simples** («1/1» con su símbolo) y un panel emergente con el detalle y las acciones
  (Capturar, Ver reportes, Registrar realizado fuera del sistema).
- **Filtros rápidos:** «Solo pendientes y vencidos» y búsqueda de partida.

### 5.7 Historial

- **Búsqueda por texto** (título, TAG) y tres filtros visibles: cliente, estado y periodo; el resto en
  «Más filtros».
- **Un solo comportamiento:** todos los filtros se aplican al cambiar (texto con una pausa de
  300 ms); filtros activos como fichas con «×» y «Limpiar filtros».
- **Orden** por periodo, fecha y estado; toda la fila abre el reporte; «Descargar» como acción
  secundaria con icono y texto.
- **Estado vacío** con «Limpiar filtros» o «Ir a Capturar» según el caso.

### 5.8 Catálogo (administración)

- Pestañas en el contrato: Sitios, Partidas, Equipos (TAG), Firmantes e Importar.
- Importación como asistente de tres pasos (archivo, ensayo con resumen, aplicar) con el resultado
  como notificación.
- Las partidas «por confirmar» como cola de trabajo con su contador en el menú.

### 5.9 Textos de la interfaz

- Español con trato de usted (como hoy), mayúscula inicial solo en la primera palabra, verbos en los
  botones («Crear reporte», «Enviar a revisión»).
- Plurales correctos en lugar de «(s)»; meses como «mayo 2026» en la interfaz (el DOCX conserva su
  formato).
- Los títulos en mayúsculas del catálogo se muestran tal cual en el documento; en la interfaz pueden
  mostrarse con mayúscula inicial sin cambiar el dato.
- Mensajes de error que digan qué pasó y qué hacer, sin códigos.

## 6. Hoja de ruta

Ordenada por impacto en la meta de 30 minutos y por dependencia. Tamaño relativo: S, M y L.

| Fase | Contenido                                                                                                                                                                                                                                                              | Hallazgos            | Tamaño | Nivel (AGENTS.md)                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------ | ------------------------------------------------------------------ |
| A    | **Fundamentos y arreglos rápidos:** tokens AA, insignias de estado, estilo de firmas, tamaños de objetivo, desborde móvil, `lang="es"`, saltar al contenido, `aria-current`, tema persistente, menú sin pantallas vacías, «Conectado» real o fuera, textos y plurales. | H3–H7, H13–H16       | M      | 1: directo, sin OpenSpec                                           |
| B    | **Editor:** barra compacta, índice con completitud, resumen de pendientes enlazado, divulgación progresiva, verificación segmentada, fotos (arrastre, cámara, progreso, deshacer), diálogo de emisión y Descargar con motivo.                                          | H2, H11, H12         | L      | 2–3: OpenSpec por el cambio de comportamiento del módulo           |
| C    | **Inicio y captura orientados a tareas:** «Mi trabajo» con acciones, selector de partida con búsqueda y pendientes primero, aviso de borrador existente.                                                                                                               | H1, H8               | M      | 2: plan y criterios; OpenSpec junto con B si se agrupan            |
| D    | **Planeación e historial:** encabezado fijo, leyenda, panel de celda, filtros simplificados, búsqueda y orden.                                                                                                                                                         | H9, H10              | M      | 2                                                                  |
| E    | **Aceleradores:** copiar del último reporte de la partida, bandeja de fotos sin asignar (subir todas y repartirlas), atajos, pestañas del catálogo, limpieza de CSS.                                                                                                   | H17 y meta de tiempo | L      | 3 si cambia datos (fotos sin alcance, copia de reportes); OpenSpec |

Criterios de aceptación generales para cada fase:

- `npm run check`, `npm run lint` y `npm run test` sin errores; pruebas de componentes para cada
  componente nuevo o modificado.
- Revisión heurística de las pantallas tocadas con la tabla de la sección 3.2: ningún hallazgo A
  abierto en ellas.
- Contraste, objetivos de 24 px y foco verificados en ambos temas y a 375 px de ancho, sin desborde
  horizontal.
- Validación visual en el navegador con capturas antes y después.

## 7. Medición del resultado

1. **Línea base antes de implementar** (tarea 7.1 pendiente): cronometrar un reporte real por etapa
   (elegir partida, encabezado, fotos, verificación, revisión y descarga).
2. **Pruebas con usuarios** al cerrar las fases B y C: de 3 a 5 personas que capturen reportes, con
   tareas reales y sin ayuda.
3. **Indicadores y metas:**
   - tiempo total del reporte ≤ 30 min;
   - éxito sin ayuda en crear, completar y enviar a revisión ≥ 90 %;
   - de un pendiente del inicio al editor en ≤ 3 clics;
   - correcciones devueltas en revisión (tendencia a la baja);
   - SUS ≥ 80 (68 es el promedio de referencia).
4. Repetir la medición tras cada fase y registrar el resultado en `HISTORIAL.md`.

## 8. Decisiones abiertas para el usuario

1. ¿Los técnicos usan celular o tableta en campo para tomar y subir fotos, o solo escritorio? Define
   cuánto peso tiene el diseño móvil en las fases B y C.
2. ¿Quién envía a revisión y quién emite: la misma persona o un supervisor? Define qué ve cada quien
   en «Mi trabajo» y se resuelve con la autenticación.
3. ¿Tema por omisión claro, oscuro o el del sistema?
4. ¿Se quiere «Copiar del último reporte» y con qué campos (herramientas, observaciones, firmas)?
5. ¿Se entra a capturar por cliente desde el menú (como hoy) o desde «Capturar» con selector?

## 9. Fuentes

- Nielsen Norman Group: [10 heurísticas de usabilidad](https://www.nngroup.com/articles/ten-usability-heuristics/),
  [estados vacíos en aplicaciones complejas](https://www.nngroup.com/articles/empty-state-interface-design/),
  [límites de tiempo de respuesta](https://www.nngroup.com/articles/response-times-3-important-limits/),
  [región común](https://www.nngroup.com/articles/common-region/) y
  [similitud](https://www.nngroup.com/articles/gestalt-similarity/).
- [Reglas de oro de Shneiderman (resumen)](https://www.simonwhatley.co.uk/writing/shneirderman-8-golden-rules-of-interface-design/).
- [Laws of UX](https://lawsofux.com/).
- W3C: [WCAG 2.2](https://www.w3.org/TR/WCAG22/); Deque:
  [novedades de WCAG 2.2](https://dequeuniversity.com/resources/wcag-2.2);
  [contraste mínimo](https://www.getstark.co/wcag-explained/perceivable/distinguishable/contrast-minimum/);
  [contraste no textual](https://www.digitala11y.com/understanding-sc-1-4-11-non-text-contrast/);
  [tamaño de objetivos táctiles](https://frontendchecklist.io/rules/accessibility/touch-targets).
- Formularios y validación: [CMS Design System](https://design.cms.gov/v/9.0.0/patterns/Forms/validation)
  y [Primer, formularios](https://primer.style/product/ui-patterns/forms/).
- Autoguardado: [Grafana Saga, guardado](https://grafana.com/developers/saga/patterns/save/) y
  [estados de guardado en SaaS](https://www.saasui.design/blog/saas-autosave-save-states-ux-patterns).
- Acciones destructivas: [Primer, eliminar](https://primer.style/product/scenario-patterns/delete).
- Pasos y secciones: [Visa, asistente](https://design.visa.com/patterns/wizard/usage/) y
  [Equinor, acordeón](https://eds.equinor.com/docs/Next/components/surfaces/accordion).
- Tablas: [patrones de tablas de datos](https://www.saasui.design/blog/saas-data-table-ui-patterns).
- Paneles: [diseño de paneles](https://www.uxstudioteam.com/ux-blog/dashboard-design).
- Valores por omisión: [Good defaults](https://pattern-playground.onrender.com/patterns/good-defaults).
- Medición: [System Usability Scale](https://www.userlytics.com/resources/blog/the-system-usability-scale).
