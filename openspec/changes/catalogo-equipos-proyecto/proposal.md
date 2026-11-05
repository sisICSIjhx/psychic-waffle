# Proposal

## Why

El 2026-11-05 el usuario compartió el Excel «CATÁLOGO DE EQUIPOS» de Cerritos (equipos e
instrumentos con marca, serie, rango, ubicación, estado y calibración) y pidió otro módulo en el
panel izquierdo para manejar algo como ese Excel, uno por proyecto.

## What Changes

**Comportamiento actual comprobado (2026-11-05, `main`):**

- La tabla `equipos` (0001) guarda el TAG por sitio con tipo, marca, modelo, rango y número de
  serie. Solo se da de alta desde la ficha del contrato (`/catalogo/contratos/[id]`) y sirve para
  elegir el TAG de partidas y reportes.
- No hay datos de calibración ni de estado, ni una vista de todos los equipos de un proyecto. El TAG
  es único por sitio, aunque el Excel repite el TAG en el transmisor y en el indicador magnético del
  mismo lazo.

**Comportamiento propuesto:**

- **Módulo «Equipos»** en el menú (`/equipos`): selector de proyecto (cliente), indicadores
  (equipos, en servicio, críticos, calibración vencida y por vencer), búsqueda y filtros por sitio,
  estado y calibración, y una tabla con las columnas del Excel.
- **Ficha del equipo** (`/equipos/[id]`): alta y edición con todos los campos del Excel; eliminar
  solo si no está en partidas ni reportes (si lo está, se marca «Dado de baja»).
- **Importar el Excel** en un sitio del proyecto, con revisión previa (nuevos, actualizados y
  filas omitidas) y **exportar a CSV** con las mismas columnas.
- **Datos:** la tabla `equipos` se amplía (no se crea otra) para que el TAG de partidas y reportes
  siga saliendo del mismo catálogo. El TAG pasa a ser único por sitio y nombre.

## Capabilities

### New Capabilities

- `catalogo-equipos`: catálogo de equipos por proyecto con calibración, importación y exportación.

### Modified Capabilities

- Ninguna fuera de este cambio: el TAG de partidas y reportes no cambia de comportamiento.

## Impact

- Migración `0021_catalogo_equipos.sql` y `supabase/esquema_completo.sql` regenerado.
- `src/lib/dominio/equipos.ts`, `esquemas.ts`, `RepositorioEquipos`, importación
  `src/lib/server/importacion/equipos.ts`, rutas `/equipos` y `/equipos/[id]`, componentes en
  `src/lib/components/equipos/`, menú y encabezados.
- El Excel real no se versiona: la columna «Responsable» contiene nombres de personas.
