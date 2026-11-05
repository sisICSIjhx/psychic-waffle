# Tasks

Rama `feat/alcances-personal-bd`, apilada sobre `feat/rediseno-interfaz`. Migración única
`supabase/migrations/0020_alcances_personal_sharepoint.sql`. Antes de abrir la base de desarrollo con
la migración nueva, detener el servidor y respaldar `storage/pglite`.

## 1. Datos

- [x] 1.1 Crear en `0020` las tablas `alcances_predeterminados`, `personal` y `personal_proyectos`
      con restricciones, disparadores y RLS, y las columnas de almacenamiento de `reporte_fotos`.
- [x] 1.2 Funciones `api_listar_alcances_predeterminados`, `api_guardar_alcance_predeterminado`,
      `api_eliminar_alcance_predeterminado`, `api_listar_personal`, `api_obtener_personal`,
      `api_guardar_personal`; `api_agregar_foto`, `json_foto` y la copia de fotos de las revisiones
      con el almacenamiento y las URL.
- [x] 1.3 Esquemas Zod, repositorios y pruebas sobre PGlite (duplicados, proyectos obligatorios,
      administrador, fecha fuera de rango, foto de SharePoint con y sin URL).

## 2. Alcances predeterminados

- [x] 2.1 Página `/catalogo/alcances` con selector de proyecto, alta, edición, activación y
      eliminación; acceso desde el catálogo y encabezado propio.
- [x] 2.2 «Agregar predeterminados» en el editor de partida.

## 3. Personal

- [x] 3.1 `/personal` (lista) y `/personal/[id]` (alta y edición, baja lógica); entrada en el menú.
- [x] 3.2 Roles nuevos en `permisos.ts` y `app.d.ts`.

## 4. Script único

- [x] 4.1 `scripts/generar-esquema-bd.ts`, `npm run bd:script`, `supabase/esquema_completo.sql` y
      prueba de que está al día.
- [x] 4.2 Ejecutar el script completo sobre un PGlite vacío en una prueba.

## 5. Cierre

- [x] 5.1 `npm run check`, `npm run lint`, `npm run test` y revisión visual de las páginas nuevas.
- [x] 5.2 HISTORIAL.md y CONTEXTO_PROYECTO.md.
