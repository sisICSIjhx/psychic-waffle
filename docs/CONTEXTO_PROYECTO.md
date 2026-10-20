# Contexto breve del proyecto

Verificado el 2026-10-19 contra los archivos locales.

## Producto y arquitectura

- Producto: «ICSI Reportes» (marca «ICSI V2» en la barra lateral). Panel web en español con vistas de Panel de Control, Planeación Anual, Captura (Prosasa, Virtual, Proagro), Historial Global, Administración de Personal y Mi Perfil. Objetivo confirmado por el usuario: centralizar y automatizar reportes técnicos, reduciendo su elaboración de unos 60 a 30 minutos o menos.
- Stack y runtime: SvelteKit 2.49 + Svelte 5.45 + Vite 7.2 + TypeScript 5.9 + Tailwind CSS 4.1; adapter-auto (destino de despliegue no definido). Pruebas con Vitest 4 y Playwright 1.57. npm con package-lock v3 y engine-strict=true. Equipo local: Node 26.2.0, npm 11.13.0.
- Módulos y entradas:
  - src/routes/+layout.svelte: shell (Sidebar, HeaderBar, tema dark/light, título por vista, navegación por URL con routesByView).
  - src/routes/+page.svelte: página raíz que importa DashboardView.
  - src/lib/layout/: Sidebar.svelte y HeaderBar.svelte usados por el layout.
  - src/lib/components/views/: una vista por sección (`*View.svelte`), hoy vacías.
  - src/lib/components/fields/: campos de formulario; solo TextField.svelte tiene contenido.
  - src/app.css: estilos globales y variables de tema; src/routes/layout.css: Tailwind (no importado aún).
- Persistencia e integraciones: no hay backend, endpoints, base de datos ni src/lib/server. El indicador «Conectado» del encabezado es estático.
- Propuesta pendiente de implementar y validar: [PROPUESTA_TECNOLOGICA_Y_PENDIENTES.md](PROPUESTA_TECNOLOGICA_Y_PENDIENTES.md). Contempla Supabase/PostgreSQL, SharePoint, DOCX desde plantillas Word, edición local con carga del corregido y PDF desde la misma revisión; uso en oficina y pruebas con 40 sesiones activas. Generador y conversor sujetos a prueba con formatos reales.

## Reglas que deben conservarse

- Textos de interfaz en español; formato Prettier del proyecto; sintaxis Svelte heredada en componentes existentes (ver AGENTS.md).
- Preservar cambios manuales y límites de permisos existentes. Sin Git: respaldar antes de editar.

## Observaciones del código (no corregidas; pendientes de decidir)

- src/routes/+page.svelte importa $lib/views/DashboardView.svelte, pero el archivo está en $lib/components/views/.
- routesByView navega a /dashboard, /planeacion, etc.; solo existe la ruta raíz.
- +layout pasa currentView/sidebarCollapsed/mobileMenuOpen y escucha selectView, mientras Sidebar exporta activeView/isCollapsed y emite navigate.
- src/lib/components/Sidebar.svelte es idéntico a src/lib/layout/Sidebar.svelte y no se importa.
- HeaderBar muestra como texto un atributo style mal ubicado.
- src/routes/page.svelte.spec.ts espera un h1 que la página no tiene. check/lint/test no se ejecutaron en esta configuración.

## Mapa para recuperar contexto

| Tema                           | Entrada real                                          |
| ------------------------------ | ----------------------------------------------------- |
| Interfaz o módulo principal    | src/routes/+layout.svelte, src/lib/layout/            |
| Vistas y formularios           | src/lib/components/views/, src/lib/components/fields/ |
| Datos y contratos              | Pendiente: aún no hay modelo de datos ni API          |
| Propuesta técnica y pendientes | docs/PROPUESTA_TECNOLOGICA_Y_PENDIENTES.md            |
| Validación                     | npm run check, npm run lint, npm run test (raíz)      |
| Decisiones anteriores          | Buscar por tema en HISTORIAL.md                       |
| Requisitos                     | openspec/specs/<capacidad>/spec.md                    |
| Uso de memoria y herramientas  | docs/MEMORIA_Y_ESPECIFICACIONES.md                    |

## Estado vigente

- OpenSpec 1.14.2 y CodeGraph 1.6.2 como devDependencies exactas; spec memoria-proyecto válida.
- MCP: codegraph en .mcp.json (Windows, cmd + node_modules\.bin\codegraph.cmd). Activo y verificado desde Claude Code el 2026-10-19 (codegraph_explore con maxFiles 2).
- Cobertura del índice: 25 archivos (18 Svelte, 5 TypeScript, 2 JavaScript). Excluidos .svelte-kit, static, openspec, .claude y similares; CSS y Markdown no se indexan.
- Proceso adaptativo en AGENTS.md, importado por CLAUDE.md.
- Pendientes: inicializar Git si se desea; decidir sobre las observaciones del código.
