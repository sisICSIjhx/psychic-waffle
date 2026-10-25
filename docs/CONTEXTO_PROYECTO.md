# Contexto breve del proyecto

Verificado el 2026-10-21 contra los archivos locales (rama `feat/tablero-cumplimiento`).

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
    captura (`captura.ts`), fotos y almacenamiento local, generación DOCX (`documentos/`, con el índice
    resuelto por `paginacion.ts` e `indice.ts`; plantilla v2 en `plantillas/`) e importación del Excel y de reportes existentes (`importacion/`).
  - `supabase/migrations/0001…0019`: esquema, RLS y funciones; PGlite las aplica al abrir la base.
  - `src/lib/components/`: vistas (`views/`), catálogo, editor de reportes, campos y `ui/` (diálogo,
    notificaciones con deshacer, botones segmentados y selector con búsqueda). Tokens de tema
    (contraste AA) en `src/app.css`; tema y menú contraído recordados (`layout/preferencias.ts`).
- Rutas: `/` «Mi trabajo» (avance del mes, tarjetas y siguiente trabajo; `?ver=`); `/planeacion`
  matriz P/R con estados de ejecución y documental y ajustes (`?vista=mensual` y `?vista=semanal`);
  `/cumplimiento` tablero de indicadores en el menú; `/captura` (`?cliente=`, `?contrato=`, `?sitio=`, `?partida=`, `?mes=`) selección
  guiada con búsqueda; `/reportes/[id]` editor (autoguardado, fotos, estados),
  `/reportes/[id]/documento` DOCX y `/reportes/[id]/fotos/[fotoId]` (`?tamano=mini` para la miniatura); `/historial`; `/catalogo` con
  contratos y partidas (en `/catalogo/contratos/[id]`, corrección del contrato, sitios y firmantes con
  motivo e historial); `/personal` y `/perfil` existen pero no están en el menú hasta que haya
  autenticación.
- Datos locales: sin `.env` se usa PGlite en `storage/pglite`; fotos y documentos en `storage/`
  (ignorado). Supabase se activa con `PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (tarea 3.8,
  pendiente del usuario). PGlite no admite dos procesos: detener el servidor antes de usar los scripts.
- Scripts: `npm run importar` (Excel del catálogo, o `--programa` para un programa anual por sitio;
  ensayo por omisión), `node scripts/derivar-partidas.ts`
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
| Cambios en curso               | openspec/changes/ (rmt-01 en cierre; ux-editor-inicio-captura)      |
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
- Plan de diseño UX: fase A (fundamentos) en `feat/ux-fase-a`; fases B (editor) y C (inicio «Mi
  trabajo» y captura con selector de partida) del cambio OpenSpec `ux-editor-inicio-captura` en
  `feat/ux-fase-b` y `feat/ux-fase-c`, con todas sus tareas hechas (uso solo en escritorio; la misma
  persona envía y emite). Siguen las pruebas con usuarios y archivar el cambio; fases D y E por
  planear.
- Cambios de octubre de 2026 (seis cambios OpenSpec apilados, uno por rama): `importacion-programa-anual`
  terminado (Proagro con programa 2026-03 a 2027-02 en EM-30184 y EM-30185 y vigencia ajustada);
  `fechas-ejecucion-multiples` terminado (días en segmentos `dias_ejecucion`; diarias por mes o por
  semana, con un día cubierto = una ejecución); `indice-docx-actualizado` terminado (índice con
  páginas calculadas y sin aviso al abrir; `npm run verificar:indice` mide contra Word); `editor-fotos`
  terminado (barra sobre la foto, arrastre, vista ampliada, reemplazo y giro como dato con la 0017);
  `edicion-contratos-bitacora` terminado (bitácora `cambios_catalogo`, corrección con motivo y aviso
  en el editor; permisos en `src/lib/server/permisos.ts`); `tablero-cumplimiento` terminado (ajustes del programa, vistas mensual y semanal y
  tablero; dominio en `src/lib/dominio/cumplimiento.ts`). Ninguno está archivado.
- Pendientes: medir con el usuario el tiempo real de un reporte (meta de 30 minutos); carga del
  histórico antes de usar el tablero; proyecto de
  Supabase (3.8); autenticación y permisos; almacenamiento en SharePoint; destino de despliegue
  (con `adapter-node`, `BODY_SIZE_LIMIT` ≥ 16 MB); confirmar el contrato de Virtual y las partidas
  derivadas por confirmar; probar HEIC con una foto real.
- Herramientas: OpenSpec 1.14.2 y CodeGraph 1.6.2 (MCP en `.mcp.json`; `npm run graph:sync` tras cambios
  grandes).
