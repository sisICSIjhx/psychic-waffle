# Tasks

Rama `claude/gracious-fermi-mipx0k` desde `main`. Migración `0021_catalogo_equipos.sql`.

## 1. Datos

- [x] 1.1 Ampliar `equipos` con calibración, estado y datos del Excel; unicidad por sitio, TAG y
      nombre; `json_equipo`, `api_guardar_equipo` (parcial), `api_listar_equipos_proyecto`,
      `api_eliminar_equipo` y `api_importar_equipos` (con ensayo).
- [x] 1.2 Esquemas Zod, `RepositorioEquipos` y pruebas sobre PGlite.
- [x] 1.3 Regenerar `supabase/esquema_completo.sql`.

## 2. Dominio e importación

- [x] 2.1 `src/lib/dominio/equipos.ts`: estados, intervalos, próxima calibración, estado de
      calibración, filtros, indicadores y CSV, con pruebas.
- [x] 2.2 `src/lib/server/importacion/equipos.ts`: lectura del Excel por encabezados, con pruebas
      sobre un libro sintético.

## 3. Interfaz

- [x] 3.1 «Equipos» en el menú y encabezados.
- [x] 3.2 `/equipos` con proyecto, indicadores, filtros, tabla, importación y exportación.
- [x] 3.3 `/equipos/[id]` alta, edición y eliminación.

## 4. Cierre

- [x] 4.1 `npm run check`, `npm run lint`, `npm run test`, `npm run spec:check` y prueba en el
      navegador; historial y contexto.
