# Tasks

Rama `feat/centros-costo-alta` desde `main`. Migración `0023_centros_costo_plantillas.sql`.

## 1. Datos

- [x] 1.1 Migración 0023: `plantillas_seguimiento`, `plantilla_conceptos`, `sitios.plantilla_id`,
      `personal_centros_costo` (con la conversión desde `personal_proyectos` y su borrado), RLS,
      `json_personal`, `json_usuario` y `api_guardar_personal` con centros de costo.
- [x] 1.2 Funciones de plantillas (`api_listar_…`, `api_obtener_…`, `api_guardar_…`,
      `api_duplicar_…`, `api_eliminar_plantilla_seguimiento`), de centros de costo
      (`api_listar_centros_costo`, `api_guardar_centro_costo`, `api_importar_centros_costo`) y de
      alcance (`api_contratos_centros`, `api_centros_de_recurso`, filtro `sitioIds` de
      `api_listar_reportes`).
- [x] 1.3 Constantes, esquemas Zod, `src/lib/dominio/seguimiento.ts`, `RepositorioCentrosCosto` y
      pruebas sobre PGlite (validaciones, conceptos estables, duplicar, eliminar en uso,
      importación, conversión y alcance).
- [x] 1.4 Regenerar `supabase/esquema_completo.sql` con `npm run bd:script`.

## 2. Alcance en el servidor

- [x] 2.1 `src/lib/server/alcance.ts` (`centrosVisibles`, filtros, `exigirCentro`) y
      `recursoDeRuta` con pruebas.
- [x] 2.2 Guardia de recursos en `src/hooks.server.ts` con pruebas.
- [x] 2.3 Filtro en `/`, `/planeacion`, `/cumplimiento`, `/captura`, `/historial`, `/catalogo`,
      `/catalogo/contratos/[id]`, `/equipos` y `/equipos/[id]`; `exigirCentro` en las acciones de
      captura y planeación.

## 3. Interfaz

- [x] 3.1 `/catalogo/centros-costo`: lista, alta y edición.
- [x] 3.2 `/catalogo/plantillas` y `/catalogo/plantillas/[id]`: lista, nueva, duplicar, eliminar y
      editor por bloques.
- [x] 3.3 Personal: centros de costo en la ficha, la lista, el filtro y `/perfil`; aviso en «Mi
      trabajo» sin centros de costo.

## 4. Carga

- [x] 4.1 `scripts/importar-centros.ts` (`npm run importar:centros`); la carga se prueba sobre
      PGlite con datos ficticios en `centros-costo.spec.ts`.
- [x] 4.2 Archivo real en `insumos/centros-costo/` con las plantillas del apartado 2.5; ensayo y
      carga en la base local (aplicada el 2026-11-10: 10 plantillas, 12 centros nuevos y 4 con
      plantilla asignada).

## 5. Cierre

- [x] 5.1 `npm run check`, `npm run lint`, `npm run test` y `npm run spec:check`.
- [x] 5.2 Prueba en el navegador con la base de prueba: centros de costo, plantillas, ficha de
      personal y un reporteador limitado.
- [x] 5.3 `HISTORIAL.md`, `docs/CONTEXTO_PROYECTO.md` y `docs/PLAN_SEGUIMIENTO_CENTROS_COSTO.md`.
