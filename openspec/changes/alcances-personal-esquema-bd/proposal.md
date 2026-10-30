# Proposal

## Why

El usuario pidió tres cosas el 2026-10-28: un apartado para dar de alta alcances predeterminados que
se agreguen a las partidas, separados por proyecto; el alta de personal con lo básico (nombre
dividido en nombre, apellido paterno y materno, fecha de nacimiento, proyectos a los que tiene acceso
y rol: líder administrativo, líder operativo, administrador o reporteador, que solo genera reportes);
y un solo script con todo lo necesario para crear la base en Supabase, considerando que las fotos de
los reportes se guardarán en SharePoint y la base solo conservará su URL.

## What Changes

**Comportamiento actual comprobado (2026-10-28, rama `feat/rediseno-interfaz`):**

- Cada partida tiene sus propios alcances (`partida_alcances`), que se escriben a mano en
  `/catalogo/partidas/[id]`. No existe una biblioteca reutilizable: el mismo texto se reescribe en
  cada partida y en cada contrato.
- `/personal` y `/perfil` muestran «Sección en preparación» y no están en el menú. No hay tabla de
  personal; `permisos.ts` solo conoce los roles provisionales `administrador` y `capturista`.
- La base se crea aplicando las 19 migraciones en orden (PGlite lo hace al abrir; en Supabase está
  pendiente la tarea 3.8). Las fotos guardan rutas del almacenamiento local (`ruta_original`,
  `ruta_optimizada`, ambas obligatorias).

**Comportamiento propuesto:**

- **Proyecto = cliente.** Cerritos, Proagro y Virtual son los proyectos; la biblioteca y los accesos
  se ligan al cliente para que sobrevivan a la renovación de contratos.
- **Alcances predeterminados:** nueva página `/catalogo/alcances` con selector de proyecto; alta,
  edición, activación y eliminación de renglones (tipo alcance, nota o norma; grupo opcional; texto).
  En el editor de partida, «Agregar predeterminados» lista los activos del proyecto del contrato y
  agrega los elegidos (se copian como texto; editar la biblioteca no altera partidas existentes).
- **Personal:** `/personal` en el menú con la lista y `/personal/[id]` con el formulario de alta y
  edición; baja lógica (inactivo), sin eliminación. El administrador accede a todos los proyectos;
  los demás roles requieren al menos uno.
- **Fotos en SharePoint:** `reporte_fotos` admite `almacenamiento = 'sharepoint'` con
  `url_original` y `url_optimizada`; las rutas locales dejan de ser obligatorias en ese caso. La
  integración con SharePoint (subida y lectura) queda fuera de este cambio.
- **Script único:** `npm run bd:script` genera `supabase/esquema_completo.sql` con todas las
  migraciones en orden, dentro de una transacción y con la seguridad por filas aplicada al final a
  todas las tablas. Una prueba verifica que el archivo esté al día.

## Capabilities

### New Capabilities

- `alcances-predeterminados`: biblioteca de alcances por proyecto y su uso en las partidas.
- `personal`: alta, edición y baja del personal con rol y proyectos.
- `esquema-base-datos`: script único de creación y fotos con URL de SharePoint.

### Modified Capabilities

Ninguna con spec principal publicada (las specs de los cambios anteriores siguen sin archivar).

## Impact

- Migración `supabase/migrations/0020_alcances_personal_sharepoint.sql`.
- Dominio `src/lib/dominio/esquemas.ts` y `src/lib/dominio/personal.ts`; repositorio
  `src/lib/server/repositorios/catalogo.ts` y nuevo `personal.ts`.
- Rutas `/catalogo/alcances`, `/catalogo/partidas/[id]`, `/personal` y `/personal/[id]`; menú
  lateral y encabezados de `navegacion.ts`.
- `scripts/generar-esquema-bd.ts`, `supabase/esquema_completo.sql` y `package.json`.
- Datos personales: el personal capturado vive solo en la base; nunca en semillas, specs ni historial.
