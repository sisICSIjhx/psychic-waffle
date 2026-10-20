# Historial del proyecto

Registro de cambios y decisiones significativas. Zona horaria: America/Mexico_City (pendiente de confirmar).
Consultar por tema. El estado vigente está en docs/CONTEXTO_PROYECTO.md.

## 2026-10-19 — FOR-ICSI-RMT-01, fase 1: shell y navegación

- Motivo: corregir las observaciones del shell que bloqueaban el desarrollo (tareas 1.1 a 1.7 del cambio OpenSpec).
- Alcance: `src/lib/layout/navegacion.ts` como fuente única de rutas (`routesByView`), títulos y accesos de captura; rutas `/planeacion`, `/captura?cliente=`, `/historial`, `/catalogo`, `/personal` y `/perfil` con vistas provisionales; barra lateral con enlaces reales (`resolve`), props `activeView`/`isCollapsed`/`isMobileOpen` y evento `navigate`; HeaderBar con título `h1` y estilo corregido; campos `SelectField`, `DateField`, `NumberField` y `TextAreaField`. Se eliminaron la vista Prosasa, `ProagroView`, `VirtualView` y el `Sidebar` duplicado (sin importaciones). `GUIA_INSTALACION_IA_PARA_CLAUDE.md` quedó fuera de Prettier.
- Archivos: `src/routes/`, `src/lib/layout/`, `src/lib/components/`, `src/app.css`, `.prettierignore`, `.claude/launch.json` y `docs/revisiones/fase-1.md`.
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
