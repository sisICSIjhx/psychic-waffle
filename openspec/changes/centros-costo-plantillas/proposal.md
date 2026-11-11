# Proposal

## Why

La etapa 2 del plan de seguimiento por centro de costo (`docs/PLAN_SEGUIMIENTO_CENTROS_COSTO.md`,
apartado 3) da de alta los centros de costo que hoy solo viven en el Excel de dirección, define qué
bloques y conceptos de seguimiento aplica cada uno (apartado 2.5) y hace que cada persona vea solo
los centros de costo que tiene asignados. Las etapas 3 (seguimiento operativo) y 4 (contrato y
cobranza) se construyen sobre esta configuración y sobre esa asignación.

## What Changes

**Comportamiento actual comprobado (2026-11-10, rama `main`):**

- El centro de costo es la tabla `sitios` (clave y nombre); la base local tiene cuatro (EM-30167,
  EM-30184, EM-30185 y EM-30179), cada uno asociado a un contrato. No hay forma de dar de alta un
  centro de costo sin contrato ni de listar los centros de costo por sí mismos.
- No existe ninguna configuración de seguimiento por centro de costo.
- El personal se asigna a proyectos (`personal_proyectos`, un proyecto = un cliente), pero esa
  asignación no limita nada: con sesión, toda persona consulta todos los contratos, centros de
  costo, programas, reportes y equipos (cambio `inicio-sesion-roles`, D1 de sus no-objetivos).

**Comportamiento propuesto:**

- **Centros de costo** (`/catalogo/centros-costo`): lista de todos los centros de costo con sus
  contratos, su plantilla y cuántas personas tienen asignadas; alta y edición de clave, nombre y
  plantilla. Un centro de costo puede existir sin contrato; la lista avisa cuando su plantilla
  exige contrato y aún no tiene uno asociado.
- **Plantillas de seguimiento** (`/catalogo/plantillas`): cada plantilla define si el centro de
  costo lleva contrato (obligatorio, opcional o sin contrato), de dónde salen sus actividades
  (programa anual, captura por mes o ninguna) y la lista de conceptos de los bloques variables
  (contrato, órdenes de compra, programa, documentos por actividad y carpetas), cada uno con su
  tipo y nivel. Varios centros de costo comparten una plantilla; duplicarla permite separarlos.
- **Carga desde un archivo** (`npm run importar:centros`, ensayo por omisión) de plantillas y
  centros de costo, para dar de alta los doce nuevos sin versionar datos del Excel.
- **Personal por centro de costo:** la ficha de personal asigna centros de costo en lugar de
  proyectos.
- **Alcance de los datos:** con el inicio de sesión activado, quien no tiene un rol que abarque
  todo solo ve, captura y ajusta lo de sus centros de costo, en todas las pantallas; un reporte,
  partida, contrato o equipo ajeno responde «No encontrado». El servidor lo comprueba.
- **BREAKING (datos):** desaparece `personal_proyectos`; las asignaciones por proyecto que hubiera
  se convierten en los centros de costo de los contratos de ese proyecto.

Fuera de este cambio: capturar valores de los conceptos (etapas 3 y 4), la carta de finalización,
la cobranza y las atenciones nocturnas (comunes a todos, sin plantilla), el contrato de los centros
nuevos (se registra en el catálogo cuando se conozca) y lo abierto del apartado 5 del plan.

## Capabilities

### New Capabilities

- `centros-costo`: alta, edición y lista de centros de costo, con contrato opcional y plantilla, y
  carga desde un archivo.
- `plantillas-seguimiento`: plantillas con modo de contrato, origen de las actividades y conceptos
  por bloque; compartir y duplicar.
- `alcance-centros-costo`: asignación del personal a centros de costo y filtrado, comprobado en el
  servidor, de lo que cada persona ve y modifica.

### Modified Capabilities

- Ninguna de `openspec/specs/`. Cambia la regla de proyectos de las capacidades `personal` y
  `permisos-por-rol` de los cambios `alcances-personal-esquema-bd` e `inicio-sesion-roles`, aún sin
  archivar; el requisito nuevo queda en `alcance-centros-costo`.

## Impact

- Migración `0023_centros_costo_plantillas.sql` (tablas `plantillas_seguimiento`,
  `plantilla_conceptos` y `personal_centros_costo`, columna `sitios.plantilla_id`, funciones
  `api_*`) y `supabase/esquema_completo.sql` regenerado.
- `src/lib/dominio/` (constantes, esquemas, personal y `seguimiento.ts`), repositorio nuevo
  `RepositorioCentrosCosto`, `src/lib/server/alcance.ts`, `src/hooks.server.ts`.
- Rutas nuevas `/catalogo/centros-costo`, `/catalogo/plantillas` y `/catalogo/plantillas/[id]`;
  filtro por centro de costo en `/`, `/planeacion`, `/cumplimiento`, `/captura`, `/historial`,
  `/catalogo`, `/equipos` y sus detalles; `/personal/[id]` y `/perfil`.
- Script `scripts/importar-centros.ts`; el archivo con los centros reales queda en `insumos/`.
