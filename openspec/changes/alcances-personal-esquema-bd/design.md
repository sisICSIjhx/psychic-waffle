# Design

## Context

La aplicación accede a la base solo mediante funciones `api_*` (jsonb → jsonb) que corren igual en
PGlite y en Supabase. La autenticación (Entra ID o Supabase Auth) y la integración con SharePoint
siguen pendientes; este cambio deja listos los datos y las pantallas de administración.

## Decisions

### D1. Proyecto = cliente

La captura ya se divide por cliente (`?cliente=`) y los contratos se renuevan. Ligar la biblioteca y
los accesos al cliente evita duplicarlos con cada contrato nuevo. En la interfaz se rotula
«Proyecto». Si más adelante un cliente tuviera proyectos distintos, se agregaría una tabla
`proyectos` entre cliente y contrato.

### D2. Biblioteca copiada, no ligada

`alcances_predeterminados (id, cliente_id, tipo, grupo, texto, orden, activo)`. Al agregarlos a una
partida se copian a `partida_alcances` como texto, igual que la partida se copia al reporte. Editar o
borrar un predeterminado no cambia partidas ni reportes. No se repite el mismo texto y tipo dentro
de un proyecto (comparación con `normalizar_clave`).

### D3. Personal con baja lógica

`personal (id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, correo, rol, activo,
usuario_auth_id)` y `personal_proyectos (personal_id, cliente_id)`. Apellido materno opcional (hay
personas con un solo apellido); fecha de nacimiento entre 1900 y hoy; correo opcional y único,
reservado para vincular el inicio de sesión. `usuario_auth_id` queda sin llave foránea porque
`auth.users` no existe en PGlite; el script de Supabase no la agrega todavía. Roles:
`administrador`, `lider_administrativo`, `lider_operativo`, `reporteador`. El administrador tiene
acceso a todos los proyectos y no requiere asignación; los demás, al menos uno. Sin eliminación para
conservar la trazabilidad futura (reportes, bitácora).

### D4. Fotos: almacenamiento y URL

Columnas `almacenamiento` (`local` | `sharepoint`, por omisión `local`), `url_original` y
`url_optimizada`. Restricción: local exige rutas; SharePoint exige URL. `ruta_*` pasan a admitir
nulos. `json_foto` devuelve los campos nuevos; en el código las rutas pasan a `string | null` y la
lectura de una foto de SharePoint falla con un mensaje claro hasta que exista la integración.

### D5. Script único generado

`scripts/generar-esquema-bd.ts` concatena `supabase/migrations/*.sql` en orden dentro de
`begin; … commit;`, crea el registro `interno.migraciones` con los nombres aplicados (compatible con
PGlite) y termina con un bloque idempotente que habilita RLS y la política `servicio_acceso_total`
en todas las tablas públicas y revoca a `anon` y `authenticated`. La fuente sigue siendo la carpeta
de migraciones; el archivo generado no se edita a mano y una prueba compara su contenido.

## Risks / Trade-offs

- La política de acceso por proyecto (RLS por usuario) llega con la autenticación; hoy todo pasa por
  el rol de servicio en el servidor.
- El script es para una base vacía; sobre una base con migraciones aplicadas se usa la CLI de
  Supabase con la carpeta de migraciones.
