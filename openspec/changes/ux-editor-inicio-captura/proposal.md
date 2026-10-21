# Proposal

## Why

La meta del producto es que un reporte FOR-ICSI-RMT-01 tome 30 minutos o menos, y el plan de diseño
(`docs/PLAN_DISENO_UX.md`) identifica los mayores retrasos en tres pantallas: el editor mide 5
pantallas sin índice y deja los pendientes al final (H2), confirma con `confirm()` y vuelve definitivo
lo eliminado en 1,5 s (H11), y oculta «Descargar DOCX» sin decir por qué (H12); la captura obliga a
elegir entre 55 partidas en una lista sin búsqueda (H1), y el panel muestra cinco números iguales sin
acciones (H8). La fase A ya dejó la base visual y de accesibilidad; estas fases cambian el
comportamiento de los módulos, por eso se planean con OpenSpec.

## What Changes

**Comportamiento actual comprobado (2026-10-21, rama `feat/ux-fase-a`):**

- `/reportes/[id]` (`EditorReporte.svelte`): todas las secciones abiertas en orden; la barra fija
  muestra estado, guardado y acciones (62 px en escritorio, 96 px en móvil); «Enviar a revisión» está
  arriba y la lista de pendientes abajo, sin enlaces; la verificación es una lista desplegable; las
  fotos se cargan con un botón por alcance y muestran «Cargando N fotos…»; quitar un alcance o una
  foto y emitir usan `confirm()`; «Descargar DOCX» solo aparece si hay fecha de ejecución.
- `/captura` (`CapturaView.svelte`): listas desplegables encadenadas (contrato, sitio, partida, mes,
  ocurrencia y TAG); la partida no se puede buscar ni indica si está programada, vencida o con
  borrador; no se avisa si ya existe un reporte de esa partida y periodo.
- `/` (`DashboardView.svelte`): cinco indicadores del mes, los 8 vencidos más antiguos con enlace a la
  planeación y los 5 reportes recientes.

**Comportamiento propuesto:**

- **Editor (fase B):** barra compacta con contexto, estado, guardado con hora relativa y
  «Reintentar», avance «faltan N» y la acción primaria del estado; índice de secciones con marca de
  completitud; «Enviar a revisión» siempre disponible que, si faltan datos, abre un resumen con
  enlaces a cada campo; lo que viene del catálogo y no cambia (encabezado fijo, firmas, objetivo) se
  muestra como resumen con «Editar»; verificación con botones segmentados de un clic; fotos con
  arrastrar y soltar, «Tomar foto» en dispositivos con cámara, progreso por archivo y quitar con
  «Deshacer»; quitar alcance con «Deshacer»; diálogo propio para emitir con el foco en «Cancelar»;
  «Descargar DOCX» siempre visible, deshabilitado con el motivo; atajo «Hoy» para la fecha.
- **Inicio «Mi trabajo» (fase C):** avance del mes contra lo programado, tarjetas accionables
  (vencidos, pendientes del mes, borradores, en revisión) y la lista «Siguiente trabajo» ordenada por
  urgencia, con «Capturar» o «Continuar borrador» según exista un borrador de esa partida y periodo.
- **Captura (fase C):** selector de partida con búsqueda por número o texto, agrupado en
  «Programadas este mes», «Con borrador» y «Otras partidas»; contexto ya resuelto como resumen con
  «Cambiar»; aviso de reporte existente de la misma partida y periodo con enlace para abrirlo.
- **Datos:** el listado de reportes devuelve también la partida y el sitio de cada fila (migración
  aditiva), para relacionar borradores con pendientes sin comparar textos.

Fuera de alcance (fases D y E del plan): planeación e historial, copiar del último reporte, bandeja de
fotos sin asignar, atajos de teclado, pestañas del catálogo y limpieza de CSS. Sin cambios en el DOCX
ni en las reglas de validación, estados o autoguardado.

## Capabilities

### New Capabilities

- `mi-trabajo`: página de inicio orientada a tareas: avance del mes, tarjetas accionables y la lista
  del siguiente trabajo con su acción directa.
- `captura-reportes`: se **agregan** requisitos de interacción del editor y de la selección de
  partida. Es la misma ruta de capacidad que define el cambio en cierre
  `reportes-mantenimiento-for-icsi-rmt-01` (aún sin archivar, por eso no está en `openspec/specs/`);
  este cambio solo usa `ADDED` y no modifica sus requisitos, de modo que ambos se integran en
  cualquier orden de archivado.

### Modified Capabilities

Ninguna en `openspec/specs/`.

## Impact

- Código: `src/lib/components/reportes/` (editor, fotos, componentes nuevos de índice, resumen de
  pendientes, verificación segmentada, diálogo y notificación con «Deshacer»),
  `src/lib/components/views/CapturaView.svelte` y `DashboardView.svelte`, `src/routes/+page.server.ts`
  y `src/routes/captura/+page.server.ts`, reglas puras en `src/lib/dominio/` (completitud por sección,
  siguiente trabajo, agrupación de partidas).
- Datos: migración `supabase/migrations/0013_*` que redefine `api_listar_reportes` para incluir
  `partidaId` y `sitioId`; `esquemaReporteResumen` los agrega. PGlite la aplica al reiniciar el
  servidor de desarrollo.
- Sin dependencias nuevas. Decisiones abiertas del plan (sección 8) que condicionan partes del
  alcance: peso del uso en celular o tableta (1) y quién envía a revisión y quién emite (2).
