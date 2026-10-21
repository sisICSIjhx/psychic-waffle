# Contexto breve del proyecto

Verificado el 2026-10-21 contra los archivos locales (rama `feat/ux-fase-a`).

## Producto y arquitectura

- Producto: «ICSI Reportes» (la misma marca en la barra lateral). Panel web en español para capturar
  el reporte FOR-ICSI-RMT-01 desde el catálogo de cada contrato, generar el DOCX y dar seguimiento al
  programa anual. Objetivo confirmado por el usuario: bajar la elaboración de un reporte de unos 60 a
  30 minutos o menos. Clientes actuales: Cerritos (TEMEX GAS), Proagroindustrias y Virtual Pipelines.
- Stack: SvelteKit 2.49 + Svelte 5.45 (sintaxis heredada) + Vite 7.2 + TypeScript 5.9 + Tailwind 4.1;
  `adapter-auto` (despliegue no definido). Datos: Zod 4, `@supabase/supabase-js` y PGlite (desarrollo).
  Documentos: `docx-templates`, `sharp`, `jszip` y `heic-decode`. Pruebas: Vitest 4 (servidor y
  componentes en Chromium con Playwright). Node 26.2.0, npm 11.13.0.
- Capas:
  - `src/lib/dominio/`: reglas puras compartidas (esquemas Zod, documento, captura, planeación,
    fechas en la zona America/Mexico_City, textos de la interfaz).
  - `src/lib/server/`: acceso a datos por funciones SQL `api_*` (`bd/`, `repositorios/`), servicio de
    captura (`captura.ts`), fotos y almacenamiento local, generación DOCX (`documentos/`, plantilla en
    `plantillas/`) e importación del Excel y de reportes existentes (`importacion/`).
  - `supabase/migrations/0001…0012`: esquema, RLS y funciones; PGlite las aplica al abrir la base.
  - `src/lib/components/`: vistas (`views/`), catálogo, editor de reportes y campos. Tokens de
    tema (contraste AA) en `src/app.css`; tema y menú contraído recordados (`layout/preferencias.ts`).
- Rutas: `/` panel; `/planeacion` matriz P/R; `/captura` (`?cliente=`, `?mes=`) selección guiada;
  `/reportes/[id]` editor (autoguardado, fotos, estados), `/reportes/[id]/documento` DOCX y
  `/reportes/[id]/fotos/[fotoId]`; `/historial`; `/catalogo` con contratos y partidas; `/personal` y
  `/perfil` existen pero no están en el menú hasta que haya autenticación.
- Datos locales: sin `.env` se usa PGlite en `storage/pglite`; fotos y documentos en `storage/`
  (ignorado). Supabase se activa con `PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (tarea 3.8,
  pendiente del usuario). PGlite no admite dos procesos: detener el servidor antes de usar los scripts.
- Scripts: `npm run importar` (Excel del catálogo, ensayo por omisión), `node scripts/derivar-partidas.ts`
  (partidas por confirmar desde reportes; `--complementar` para las confirmadas),
  `npm run verificar:datos` (nombres de los insumos fuera de lo versionable), `npm run prueba:documental`.

## Reglas que deben conservarse

- Textos de interfaz en español; formato Prettier del proyecto; sintaxis Svelte heredada (ver
  AGENTS.md). Nunca datos personales (firmantes, nombres de los reportes) en commits, semillas, specs ni
  historial; `insumos/`, `storage/` y `.env*` están ignorados.
- Git: repositorio con remoto `origin` en GitHub; trabajo en ramas por cambio. No hacer push sin
  autorización del usuario.

## Mapa para recuperar contexto

| Tema                           | Entrada real                                                        |
| ------------------------------ | ------------------------------------------------------------------- |
| Interfaz y navegación          | src/routes/+layout.svelte, src/lib/layout/navegacion.ts             |
| Vistas y editor                | src/lib/components/views/, src/lib/components/reportes/             |
| Datos y contratos              | supabase/migrations/, src/lib/dominio/esquemas.ts, src/lib/server/  |
| Documento DOCX                 | src/lib/server/documentos/, src/lib/server/plantillas/              |
| Cambio en curso                | openspec/changes/reportes-mantenimiento-for-icsi-rmt-01/            |
| Revisiones con Codex           | docs/revisiones/fase-N.md y ux-fase-X.md                            |
| Propuesta técnica y pendientes | docs/PROPUESTA_TECNOLOGICA_Y_PENDIENTES.md                          |
| Plan de diseño UI/UX           | docs/PLAN_DISENO_UX.md                                              |
| Validación                     | npm run check, npm run lint, npm run test (raíz)                    |
| Decisiones anteriores          | Buscar por tema en HISTORIAL.md                                     |
| Requisitos                     | openspec/specs/<capacidad>/spec.md y los deltas del cambio en curso |
| Uso de memoria y herramientas  | docs/MEMORIA_Y_ESPECIFICACIONES.md                                  |

## Estado vigente

- Cambio `reportes-mantenimiento-for-icsi-rmt-01`: fases 0 a 6 implementadas y revisadas con Codex;
  cierre (fase 7) en curso. Todo funciona en local con PGlite.
- Plan de diseño UX: fase A (fundamentos y arreglos rápidos) terminada en `feat/ux-fase-a`; las
  fases B y C (editor, «Mi trabajo» y captura) se planean en un cambio OpenSpec propio.
- Pendientes: medir con el usuario el tiempo real de un reporte (meta de 30 minutos); proyecto de
  Supabase (3.8); autenticación y permisos; almacenamiento en SharePoint; destino de despliegue
  (con `adapter-node`, `BODY_SIZE_LIMIT` ≥ 16 MB); confirmar el contrato de Virtual y las partidas
  derivadas por confirmar; probar HEIC con una foto real.
- Herramientas: OpenSpec 1.14.2 y CodeGraph 1.6.2 (MCP en `.mcp.json`; `npm run graph:sync` tras cambios
  grandes).
