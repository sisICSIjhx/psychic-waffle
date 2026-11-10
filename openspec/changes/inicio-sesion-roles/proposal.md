# Proposal

## Why

El seguimiento por centro de costo (`docs/PLAN_SEGUIMIENTO_CENTROS_COSTO.md`) va a guardar contratos,
montos y cobranza que solo deben ver ciertos roles, y hoy el sistema no tiene inicio de sesión:
cualquiera con acceso de red ve y edita todo (riesgo 1 de
`docs/OPTIMIZACION_SEGURIDAD_Y_PROPUESTAS.md`). El 2026-11-10 el usuario decidió que el inicio de
sesión entra en la fase 1 con cuentas propias de correo y contraseña, sin esperar al proyecto de
Supabase ni al registro en Microsoft, y entregó la lista del personal para darlo de alta.

## What Changes

**Comportamiento actual comprobado (2026-11-10, rama `feat/centro-de-costo`):**

- `src/hooks.server.ts` solo agrega encabezados de seguridad; `locals.autenticacion` y
  `locals.usuario` nunca se llenan, así que `puedeEditarCatalogo` y `puedeAdministrarPersonal`
  (`src/lib/server/permisos.ts`) siempre permiten.
- `personal` (migración 0020) guarda nombre, fecha de nacimiento obligatoria, correo opcional y
  único, uno de cuatro roles y sus proyectos; todo rol que no sea administrador exige al menos un
  proyecto. `usuario_auth_id` existe y no se usa. No hay contraseñas ni sesiones.
- `/perfil` es un texto «Sección en preparación» y no está en el menú.

**Comportamiento propuesto:**

- **Inicio de sesión propio** en `/acceso` con correo y contraseña. La cuenta es de una persona del
  módulo Personal; el administrador le genera una contraseña temporal, que la persona cambia al
  entrar por primera vez.
- **Activación.** Mientras no exista ninguna cuenta, la aplicación sigue abierta como hoy y ofrece
  activar el inicio de sesión creando la cuenta de un administrador. Desde ese momento todo exige
  sesión.
- **Sesiones** guardadas en la base (funcionan igual con PGlite y con Supabase): cookie segura,
  caducidad, cierre de sesión y revocación al cambiar la contraseña o dar de baja a la persona.
- **Dos roles nuevos:** mesa directiva (consulta todo, no edita) y contabilidad (la cobranza, que
  llega en la etapa 4). Una matriz define lo que puede hacer cada rol y el servidor la comprueba en
  cada petición; el menú solo muestra lo que el rol puede usar.
- **Mi perfil** (`/perfil`) entra al menú: datos de la cuenta y cambio de contraseña.
- **Personal:** sede opcional, fecha de nacimiento opcional, personas sin proyectos asignados y
  carga desde un archivo (`npm run importar:personal`, con ensayo por omisión).
- **BREAKING (datos):** los roles que usan proyectos ya no exigen al menos uno.

Fuera de este cambio: el alcance de los datos por proyecto o centro de costo (se define en la etapa
2, cuando la unidad de asignación pase a ser el centro de costo), el inicio de sesión con Microsoft,
la recuperación de contraseña por correo y los permisos de contrato y cobranza (etapa 4).

## Capabilities

### New Capabilities

- `autenticacion`: inicio de sesión con correo y contraseña, activación, sesiones, cuentas y
  cambio de contraseña.
- `permisos-por-rol`: roles del personal y lo que cada uno puede consultar y modificar.
- `personal`: sede, fecha de nacimiento opcional, personas sin proyectos y carga desde un archivo
  (la capacidad nació en el cambio `alcances-personal-esquema-bd`, aún sin archivar).

### Modified Capabilities

- Ninguna de `openspec/specs/`.

## Impact

- Migración `0022_autenticacion.sql` (tablas `credenciales` y `sesiones`, funciones `api_*`,
  roles, sede) y `supabase/esquema_completo.sql` regenerado.
- `src/hooks.server.ts`, `src/app.d.ts`, `src/lib/server/permisos.ts`, nuevo
  `src/lib/server/autenticacion/`, `src/lib/dominio/permisos.ts`, `RepositorioAutenticacion`.
- Rutas nuevas `/acceso` y `/acceso/configurar`; `/perfil` y `/personal/[id]` con acciones nuevas;
  `+layout.server.ts`, barra lateral y cabecera.
- Scripts `scripts/importar-personal.ts` y `scripts/cuenta.ts`.
- Sin dependencias nuevas: `node:crypto` (scrypt) para las contraseñas.
- La lista real del personal no se versiona: queda en `insumos/` y en la base local.
