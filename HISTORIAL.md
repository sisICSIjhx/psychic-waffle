# Historial del proyecto

Registro de cambios y decisiones significativas. Zona horaria: America/Mexico_City (pendiente de confirmar).
Consultar por tema. El estado vigente está en docs/CONTEXTO_PROYECTO.md.

## 2026-10-20 — Plan de diseño de interfaz y experiencia de usuario

- Motivo: solicitud del usuario de un plan para mejorar la interfaz con prioridad en funcionalidad y experiencia de usuario, basado en reglas de diseño investigadas.
- Alcance: `docs/PLAN_DISENO_UX.md` (reglas: heurísticas de Nielsen, reglas de Shneiderman, leyes de UX, Gestalt, patrones de formularios, autoguardado, tablas y paneles, WCAG 2.2 AA; diagnóstico con 17 hallazgos; principios; propuesta por pantalla; hoja de ruta en fases A a E con su nivel de OpenSpec; medición y decisiones abiertas). Sin cambios de código.
- Validación: auditoría en el navegador con la base local a 1366 × 800 y 375 × 812 (contraste calculado, tamaño de controles, alto de página y desbordes) sobre el servidor de desarrollo que ya estaba abierto; Prettier sobre el documento.
- Pendientes: respuestas del usuario a las decisiones abiertas (sección 8 del plan); línea base de tiempo de un reporte real (7.1) antes de implementar.

## 2026-10-20 — FOR-ICSI-RMT-01, fase 7: cierre (parcial)

- Motivo: dejar el cambio listo para su uso local y para archivarlo (tareas 7.1 a 7.4).
- Alcance: `docs/CONTEXTO_PROYECTO.md` reescrito con la arquitectura, rutas, datos locales, Git y pendientes vigentes (7.2); índice de CodeGraph sincronizado (105 archivos); `npm run spec:check` aprobado (7.4). El archivado se hará después de la medición con el usuario.
- Pendientes para cambios posteriores (7.3): medir con el usuario el tiempo de un reporte real de principio a fin frente a la meta de 30 minutos (7.1, requiere al usuario); autenticación y permisos por usuario (hoy cualquiera con acceso a la aplicación puede capturar y emitir); almacenamiento en SharePoint detrás de la interfaz de `almacenamiento.ts`; ciclo de revisiones con flujo de aprobación (hoy la revisión es un borrador nuevo vinculado); proyecto de Supabase (3.8) y destino de despliegue (`adapter-node` con `BODY_SIZE_LIMIT` ≥ 16 MB, o el que se elija); conversión a PDF (LibreOffice no está instalado); confirmar el contrato de Virtual y las partidas por confirmar de Proagro y Virtual; probar HEIC con una foto real; `AGENTS.md` aún dice que el proyecto no usa Git.

## 2026-10-20 — FOR-ICSI-RMT-01, fase 6: planeación anual, historial y panel

- Motivo: dar seguimiento al programa anual con lo realizado de los reportes y localizar cualquier reporte (tareas 6.1 a 6.5).
- Alcance: reglas puras en `src/lib/dominio/planeacion.ts` (estado de cada celda P/R, pendientes vencidos, filtros, resumen del mes y programa vigente); `/planeacion` (matriz P/R por mes con filtros por contrato, sitio, programa, distribución y periodicidad, vencidos agrupados por mes, celda pendiente que abre `/captura` con partida y mes elegidos, enlace del realizado a sus reportes y registro de realizados hechos fuera del sistema); `/historial` (filtros por cliente, contrato, sitio, partida, TAG, estado y periodo en la URL, paginación, apertura y descarga); panel de control con partidas programadas, cumplidas y pendientes del mes, vencidos, borradores y reportes recientes.
- Decisiones: el panel cuenta partidas y no cantidades (una partida diaria programa unos 30 por mes y dominaría cualquier suma); un mes vence al terminar, según la fecha de la zona del negocio.
- Validación: `check` 0/0; `lint` sin observaciones; suite completa aprobada (dominio de planeación, filtros del historial y realizado solo de emitidos sobre PGlite, componentes de planeación, historial y panel). Navegador con la base local: matriz de Cerritos (55 partidas, 12 meses), enlace «Capturar» con partida y mes preseleccionados, historial filtrado por cliente y estado, y panel con los indicadores de octubre.
- Revisión de Codex en 2 rondas: 4 hallazgos corregidos (`docs/revisiones/fase-6.md`): el realizado separa las ejecuciones con reporte de lo realizado sin reporte (`0012`), el historial vuelve a la última página válida y valida los meses de la URL.

## 2026-10-20 — FOR-ICSI-RMT-01, fase 5: captura de reportes

- Motivo: capturar el reporte desde el catálogo para que el técnico solo registre lo que cambia en cada ejecución (tareas 5.1 a 5.9). Por indicación del usuario todo es local: sin Supabase, con PGlite y datos tomados de los reportes reales (sin firmantes).
- Alcance: reglas puras en `src/lib/dominio/captura.ts` (periodos y ocurrencias, prellenado, validaciones para revisión, huella del catálogo y aplicación explícita de sus cambios); servicio `src/lib/server/captura.ts` (alta, guardado, fotos, estados, revisión y DOCX), almacenamiento local y validación de fotos (JPEG, PNG y HEIC de hasta 15 MB); migraciones `0007` (huella del catálogo por reporte) y `0009` (la importación conserva alcances si el libro solo trae notas); rutas `/captura` (selección guiada con `?cliente=` y borradores recientes) y `/reportes/[id]` (editor con autoguardado de 1,5 s, conflicto de versión, fotos por alcance con antes/durante/después, tabla de verificación con confirmación, estados, revisión y descarga en `/reportes/[id]/documento`). `derivar-partidas --complementar` llena con los reportes lo que les falta a las partidas confirmadas (el Excel de Cerritos solo trae viñetas).
- Decisiones: la plantilla se empaqueta con `?inline` para el build; HEIC con `heic-decode` 2.1.0 y `libheif-js` 1.23.2 fijado (LGPL-3.0); una foto por petición (en `adapter-node`, `BODY_SIZE_LIMIT` ≥ 16 MB). Diseño D5, D6 y D7 actualizados.
- Validación: `check` 0/0; `lint` sin observaciones; `test` 16 archivos y 125 pruebas (dominio de captura, recorrido completo crear → fotos → emitir → DOCX → revisión, fotos y almacenamiento, componentes del editor en Chromium). Navegador con la base local: partida 7 de Cerritos («07.- TOMA DE POTENCIALES TUBO-SUELO. MAYO 2026»), autoguardado, carga con un PDF rechazado, conflicto entre dos pestañas, confirmación de la tabla, revisión, emisión, descarga del DOCX (658 KB) y aplicación de los cambios del catálogo. Complemento de Cerritos: 39 partidas (la 43 se omitió por actividad distinta) y reimportación del Excel sin cambios. `vite build` incrusta la plantilla.
- Revisión de Codex en 2 rondas: 9 hallazgos corregidos (`docs/revisiones/fase-5.md`): guardado antes de navegar y acciones con la URL del reporte, DOCX registrado con su versión (`0010`, `0011`) en una ruta exclusiva, fecha dentro de la semana, quincena o día, edición bloqueada durante los cambios de estado, fechas en America/Mexico_City y detección de «Cambiar» por campo.
- Pendientes: la decodificación HEIC no se probó con una foto HEIC real (no hay en los insumos).

## 2026-10-20 — FOR-ICSI-RMT-01, fase 4: catálogo e importación

- Motivo: cargar el catálogo de partidas, alcances y programa anual desde el Excel oficial y dar de alta lo que falta desde la interfaz (tareas 4.1 a 4.6).
- Alcance: lector XLSX propio sobre `jszip` y analizador del «CATALOGO DE ALCANCES» en `src/lib/server/importacion/` (cabeceras por texto, viñetas clasificadas en alcance, nota o norma, programa P/R por relleno de celda, firmantes solo propuestos); migración `0005_importacion.sql` (`api_importar_catalogo` con ensayo, aplicación en una transacción e idempotencia; columnas de entrega de OMA y propuesta); vistas `/catalogo`, `/catalogo/contratos/[id]` y `/catalogo/partidas/[id]` con edición de partidas, sitios, equipos/TAG, firmantes, filtro y confirmación de partidas «por confirmar», e importación con ensayo previo; scripts `npm run importar` y `scripts/derivar-partidas.ts` (partidas por confirmar desde reportes existentes, sin leer firmas). `verificar-datos-personales` revisa ahora también los nombres de los libros de Excel.
- Decisiones: se descartó `exceljs` (depende de `uuid` con aviso de seguridad); el formulario del editor conserva sus campos tras guardar (`update({ reset: false })`), porque Svelte 5 los reiniciaba; el alcance derivado guarda «título\ndescripción» (diseño D4 actualizado).
- Validación: `check` 0/0; `lint` sin observaciones; `test` 11 archivos y 90 pruebas (importador con `.xlsx` sintético versionado: estructura, columnas faltantes, idempotencia, reemplazo de partidas por confirmar y atomicidad; lectura de un DOCX generado; confirmación y filtro). Importación local del libro de Cerritos: 55 partidas creadas y reimportación sin cambios; derivación de 55 partidas de Proagro y 37 de Virtual con contrato provisional. Interfaz revisada en el navegador (alta de cliente, contrato y sitio, ensayo con el libro sintético, uso de un firmante propuesto y dos guardados de una partida con 6 alcances). Verificación de datos personales sin coincidencias (157 reportes y 1 libro).
- Revisión de Codex en 2 rondas: 12 hallazgos corregidos (`docs/revisiones/fase-4.md`). Migraciones `0006` (descripción conservada, marcas R sincronizadas, fin de periodo del programa) y `0008` (columna `origen` de los realizados); el ensayo de `npm run importar` ya no escribe; edición de equipos y firmantes. Tras las correcciones: `check` 0/0, `lint` sin observaciones y 117 pruebas aprobadas.
- Decisión del usuario (2026-10-20): las estaciones de Proagroindustrias usan la clave «EM» (como dicen los encabezados de los reportes).
- Pendientes: confirmar con el usuario el número de contrato de Virtual y las partidas derivadas.

## 2026-10-20 — FOR-ICSI-RMT-01, fase 3: modelo de datos y repositorios

- Motivo: crear desde cero el esquema PostgreSQL del catálogo, el programa anual y los reportes, probado con PGlite porque el proyecto de Supabase aún no existe (tareas 3.1 a 3.9).
- Alcance: migraciones `supabase/migrations/0001` a `0004` (catálogo con claves normalizadas y unicidad de sitio, partida y TAG; firmantes sin traslapes; programa sin periodos superpuestos y con realizados manuales; reportes con versión, estados, revisiones, copia del TAG y documentos generados; vistas de ejecuciones y de realizado por programa; RLS en todas las tablas). Acceso solo mediante funciones `api_*` (jsonb → jsonb) con errores IC404/IC409/IC422. Esquemas Zod en `src/lib/dominio/esquemas.ts`; cliente SQL con implementaciones PGlite y Supabase (`rpc` con clave de servicio) y repositorios en `src/lib/server/`.
- Decisiones: la lógica de persistencia vive en SQL para que ambas implementaciones sean adaptadores delgados probados con las mismas migraciones (diseño D2 actualizado); `@supabase/ssr` y `hooks.server.ts` se difieren al cambio de autenticación. Dependencias exactas: `zod` 4.6.7, `@supabase/supabase-js` 2.118.0 y `@electric-sql/pglite` 0.5.10 (desarrollo).
- Validación: `check` 0/0, `lint` sin observaciones y suite completa aprobada (25 pruebas de repositorios sobre PGlite y 3 del adaptador de Supabase simulado). Revisión de Codex en 2 rondas: 9 hallazgos corregidos (`docs/revisiones/fase-3.md`).
- Pendientes: tarea 3.8 del usuario (crear el proyecto de Supabase y el `.env`; después se aplican las migraciones y se prueba la conexión).

## 2026-10-20 — FOR-ICSI-RMT-01, fase 2: prueba documental y plantilla v1

- Motivo: validar el riesgo principal del cambio, la fidelidad del DOCX, antes de construir la captura (tareas 2.1 a 2.7).
- Alcance: plantilla `src/lib/server/plantillas/FOR-ICSI-RMT-01.v1.docx` construida con `scripts/construir-plantilla.ts` desde un reporte real de manómetros (conserva portada, encabezado, firmas, estilos, membrete y pies; saneada y auditada); reglas puras en `src/lib/dominio/documento.ts`; generador con `docx-templates` y `sharp` (perfiles adaptativos por presupuesto), auditoría del paquete, utilidades OOXML y conversión de prueba a PDF en `src/lib/server/documentos/`; `scripts/prueba-documental.ts` con 3 ejemplos de firmantes ficticios y `scripts/verificar-datos-personales.ts`. Dependencias exactas: `docx-templates` 4.15.0, `sharp` 0.35.5 y `jszip` 3.10.2.
- Decisiones técnicas: el índice no lleva `w:dirty` (bloqueaba a Word al actualizarlo) y la plantilla activa `updateFields` y `removePersonalInformation`; cada renglón de texto es un párrafo; solo se incrustan fuentes de licencia libre (Open Sans y Arimo).
- Validación: `check` 0/0; `lint` sin observaciones; `test` 6 archivos y 45 pruebas. Los 3 DOCX (20, 36 y 74 fotos; 1,5, 2,2 y 27,7 MB) abren en Microsoft Word sin reparación, actualizan el índice y se exportan a PDF (9, 9 y 16 páginas). LibreOffice no está instalado: la conversión informa «no disponible». Comparación visual con los originales mediante los PDF de Word; capturas en `storage/prueba-documental/comparacion/` (ignorado). Verificación de datos personales sin coincidencias. Revisión de Codex en 2 rondas, 8 hallazgos corregidos (`docs/revisiones/fase-2.md`).
- Punto de control (tarea 2.7): el usuario revisó los 3 DOCX y eligió antes/durante/después en 2 + 1 con fotos de 8 × 6 cm (como Virtual; diseño D5 actualizado), foto sola centrada en la cuadrícula, título en mayúsculas e índice con aviso de actualización al abrir. Ajustes implementados y validados (46 pruebas; Word: 9, 16 y 16 páginas). Plantilla v1 cerrada.
- Pendientes: soporte HEIC en la carga de fotos (fase 5; `sharp` precompilado no lo decodifica); resolver la ruta de la plantilla en el build de producción al exponer el endpoint (fase 5); `npm audit` reporta vulnerabilidades en la cadena de herramientas previa (Kit, Vite, Vitest, OpenSpec), ninguna en las dependencias nuevas.

## 2026-10-19 — FOR-ICSI-RMT-01, fase 1: shell y navegación

- Motivo: corregir las observaciones del shell que bloqueaban el desarrollo (tareas 1.1 a 1.7 del cambio OpenSpec).
- Alcance: `src/lib/layout/navegacion.ts` como fuente única de rutas (`routesByView`), títulos y accesos de captura; rutas `/planeacion`, `/captura?cliente=`, `/historial`, `/catalogo`, `/personal` y `/perfil` con vistas provisionales; barra lateral con enlaces reales (`resolve`), props `activeView`/`isCollapsed`/`isMobileOpen` y evento `navigate`; HeaderBar con título `h1` y estilo corregido; campos `SelectField`, `DateField`, `NumberField` y `TextAreaField`. Se eliminaron la vista Prosasa, `ProagroView`, `VirtualView` y el `Sidebar` duplicado (sin importaciones). `GUIA_INSTALACION_IA_PARA_CLAUDE.md` quedó fuera de Prettier.
- Archivos: `src/routes/`, `src/lib/layout/`, `src/lib/components/`, `src/app.css`, `.prettierignore` y `docs/revisiones/fase-1.md`.
- Validación: `check` 0 errores y 0 advertencias; `lint` sin observaciones; `test` 4 archivos y 10 pruebas aprobadas (server y client en Chromium); validación visual en el servidor de desarrollo (navegación, estado activo, título y menú colapsado, consola sin errores). Revisión de Codex (1 ronda): sin hallazgos.
- Pendientes: fase 2 (prueba documental) con punto de control del usuario.

## 2026-10-19 — FOR-ICSI-RMT-01, fase 0: preparación y revisión con Codex

- Motivo: el usuario aprobó el plan del cambio `reportes-mantenimiento-for-icsi-rmt-01` y autorizó ejecutarlo por fases, con revisión de Codex al cierre de cada una.
- Alcance: rama `feat/reportes-rmt-01` desde `main` (commit inicial de la documentación), `.env.example`, `/storage/` en `.gitignore` y `scripts/revision-codex.ps1`. Ajustes a specs, diseño y tareas por los hallazgos de Codex: varios TAG por reporte y su nombre de archivo, «Ilustración 2.n.m», revisiones de reportes emitidos (`revision`, `sustituye_a`), realizados manuales con `registrado_en` y saneamiento de la plantilla.
- Archivos: `.env.example`, `.gitignore`, `scripts/revision-codex.ps1`, `openspec/changes/reportes-mantenimiento-for-icsi-rmt-01/` y `docs/revisiones/fase-0.md`.
- Decisiones de herramienta: Codex 0.146 no admite `--commit` con instrucciones propias, así que el diff va en el prompt; el modelo por defecto no está disponible con la cuenta de ChatGPT (se usa `gpt-5.6-sol`); el sandbox de Windows de Codex no inicia y no se tocó la configuración de seguridad del equipo.
- Validación: prueba del script sobre el commit 0.1 con 0 comandos ejecutados por Codex; revisión de la fase en 2 rondas (5 hallazgos corregidos: exclusión y aborto ante rutas sensibles con Codex en un directorio vacío, nombre con varios TAG y su orden persistente, `registrado_en`); `openspec validate --strict` válido. Línea base: `check` 5 errores, `lint` 8 archivos sin formato y `test` con el proyecto client fallido, todos preexistentes del shell (fase 1). Se instaló el Chromium de Playwright (la extracción automática se colgó y se completó a mano).
- Pendientes: fase 1 (shell y navegación).

## 2026-10-19 — Análisis de reportes reales y plan de trabajo FOR-ICSI-RMT-01

- Motivo: el usuario entregó, en `insumos/`, los reportes reales (157 DOCX de Cerritos, Proagroindustrias y Virtual) y el catálogo de alcances con el programa anual de Cerritos, y pidió un plan de trabajo para ajustar la captura, la base de datos y la generación de reportes.
- Resultado: se creó el cambio de OpenSpec `openspec/changes/reportes-mantenimiento-for-icsi-rmt-01/` con:
  - propuesta;
  - 4 specs: `catalogo-contratos`, `programa-anual`, `captura-reportes` y `generacion-documental`;
  - diseño con el modelo de datos, las decisiones y las preguntas abiertas;
  - tareas en 8 fases (0 a 7), cada una con revisión de Codex CLI (`codex review --commit`).
- Hallazgos clave: los tres clientes usan el mismo formato FOR-ICSI-RMT-01 y varían en la disposición de las fotos y en la tabla de verificación. Hay inconsistencias de captura: sitios escritos de varias formas, contrato «(Cambiar)», partidas copiadas entre ERM y fechas incompletas.
- `.gitignore`: se agregó `/insumos/` porque los reportes contienen nombres de personal. La extracción de texto se hizo en el scratchpad de la sesión, fuera del repositorio.
- Validación: `openspec validate reportes-mantenimiento-for-icsi-rmt-01 --strict` válido; los artefactos se formatearon con Prettier. No se modificó código de `src/` ni se ejecutaron suites de aplicación (entrega de planeación).
- Decisiones del usuario, incorporadas al plan:
  - se elimina la vista Prosasa, que era de un proyecto anterior;
  - no existe Supabase, así que el esquema se crea desde cero;
  - Proagro y Virtual tienen catálogo pendiente de entrega, por lo que sus partidas se derivan de sus reportes como «por confirmar»;
  - la tabla de verificación es opcional en cualquier cliente;
  - todos los reportes comparten diseño, así que cualquiera sirve de referencia para la plantilla.
- Pendientes: aprobación del plan ajustado para iniciar la fase 0; creación del proyecto de Supabase por el usuario (tarea 3.8).

## 2026-10-19 — Propuesta tecnológica y pendientes de implementación

- Motivo: consolidar la evaluación tecnológica y el alcance confirmado para reportes DOCX/PDF, edición local de Word, archivos en SharePoint y uso por alrededor de 40 usuarios.
- Resultado y alcance: se agregó docs/PROPUESTA_TECNOLOGICA_Y_PENDIENTES.md con tecnologías propuestas, estado observado, ciclo documental, caché, concurrencia, pendientes, criterios de validación y referencias técnicas. docs/CONTEXTO_PROYECTO.md incorpora el objetivo de negocio y una referencia breve a la propuesta. Este cambio es documental; no implementa integraciones ni cambia dependencias o código de la aplicación.
- Respaldo previo: HISTORIAL.md y docs/CONTEXTO_PROYECTO.md copiados fuera del proyecto, con coincidencia SHA-256 verificada, en C:\Users\sistemas\.codex\visualizations\2026\10\20\01a15745-9951-72c0-91f8-3607710a9ba2\respaldos-reportes-icsi\2026-10-19_214325.
- Validación: Prettier --check satisfactorio en los tres documentos; cuatro enlaces locales resueltos y diez URL HTTPS con sintaxis válida; historial anterior conservado íntegramente frente al respaldo; git diff --check sin errores de espacios. La revisión de enlaces externos comprobó sintaxis, no disponibilidad remota. Sin ejecución de pruebas funcionales ni validación visual documental.
- Pendientes: recuperar plantillas y documentos de referencia; comprobar fidelidad del generador DOCX y conversor PDF; implementar los bloques descritos y medir capacidad con carga representativa. No se ejecutan suites de aplicación por tratarse de documentación.

## 2026-10-19 — Activación del MCP de CodeGraph en Claude Code

- Motivo: cerrar el pendiente de aprobar y probar codegraph desde una sesión de Claude Code.
- Resultado: el servidor codegraph conecta en la sesión y expone codegraph_explore. Solo se modificó la documentación: docs/CONTEXTO_PROYECTO.md (estado vigente) y esta entrada.
- Validación: codegraph_explore "Sidebar HeaderBar +layout.svelte" con maxFiles 2 devolvió src/routes/+layout.svelte y src/lib/components/Sidebar.svelte (19 símbolos, con radio de impacto), sin errores.
- Pendientes: los demás pendientes de la entrada de configuración siguen abiertos (npm audit, Git, check/lint/test).

## 2026-10-19 — Configuración de herramientas y memoria

- Motivo: conservar contexto entre sesiones y recuperar código pertinente, siguiendo GUIA_INSTALACION_IA_PARA_CLAUDE.md.
- Resultado:
  - devDependencies exactas @fission-ai/openspec 1.14.2 y @colbymchenry/codegraph 1.6.2 (instaladas con --ignore-scripts). npm subió el paquete hoisted yaml de 2.8.2 a 2.9.1 porque OpenSpec exige ^2.8.3 (dependencia opcional de Vite, dentro de su rango ^2.4.2). Sin otros cambios de versión en la aplicación.
  - Scripts graph, graph:status, graph:sync, spec, spec:check y spec:list en package.json.
  - OpenSpec inicializado solo para Claude (perfil core, español): openspec/config.yaml con contexto y reglas, 6 habilidades en `.claude/skills/openspec-*`.
  - CodeGraph: codegraph.json (exclusiones genéricas + .svelte-kit, build, static, openspec), índice .codegraph/, servidor MCP en .mcp.json y permisos rutinarios en .claude/settings.json.
  - Documentos: AGENTS.md, CLAUDE.md, docs/CONTEXTO_PROYECTO.md, docs/MEMORIA_Y_ESPECIFICACIONES.md, openspec/specs/memoria-proyecto/spec.md. Entradas añadidas a .gitignore y /.claude/skills/ a .prettierignore (las habilidades generadas no siguen el estilo Prettier del proyecto y no se editan a mano).
- Decisiones: memoria breve, CodeGraph como índice de código y OpenSpec según impacto/riesgo. No se modificó código de src/.
- Validación:
  - spec --version 1.14.2; graph --version 1.6.2.
  - spec:check: 1 passed, 0 failed. spec:list: memoria-proyecto (3 requisitos).
  - graph init: 25 archivos, 111 nodos, 120 aristas; graph:status «Index is up to date».
  - graph explore "handleSelectView toggleTheme" --max-files 2: devolvió src/routes/+layout.svelte y src/lib/components/Sidebar.svelte.
  - MCP con cliente de diagnóstico stdio usando la definición de .mcp.json: initialize (codegraph 1.6.2), tools/list (codegraph_explore) y tools/call sin error. No probado aún desde una sesión de Claude Code.
  - JSON/YAML de configuración analizados sin errores; prettier --check sobre los archivos nuevos y openspec/: sin observaciones. Sin cambios en src/ ni en configuraciones de la aplicación.
- Pendientes:
  - Reiniciar Claude Code en C:\reportes-icsi, aprobar codegraph en /mcp y ejecutar codegraph_explore con maxFiles 2.
  - npm audit: 28 vulnerabilidades tras la instalación frente a 24 antes; las 4 nuevas (high) vienen de OpenSpec y su cadena fast-glob/micromatch/braces, solo de desarrollo. No se ejecutó npm audit fix para no alterar paquetes de la aplicación.
  - El proyecto no tiene Git; se respaldaron package.json, package-lock.json y .gitignore fuera del proyecto antes de editarlos.
  - npm run check/lint/test no se ejecutaron (entrega documental). Observaciones del código registradas en docs/CONTEXTO_PROYECTO.md.

## Formato para nuevas entradas

Agregar entradas recientes arriba, sin borrar decisiones anteriores:

- Fecha y título concreto.
- Motivo, resultado y alcance.
- Archivos, spec o commit si existe.
- Validación ejecutada y resultado real.
- Pendientes y limitaciones.

No inventar historia previa. Si se incorporan referencias de Git, indicar commit y asunto sin atribuirles pruebas no verificadas.
Archivar años cerrados en docs/historial/ cuando el archivo crezca, conservando enlaces aquí.
