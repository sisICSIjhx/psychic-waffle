# Historial del proyecto

Registro de cambios y decisiones significativas. Zona horaria: America/Mexico_City (pendiente de confirmar).
Consultar por tema. El estado vigente está en docs/CONTEXTO_PROYECTO.md.

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
