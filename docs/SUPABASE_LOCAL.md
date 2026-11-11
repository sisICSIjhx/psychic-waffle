# Supabase local en Windows

Con Docker Desktop en ejecución y las dependencias de npm instaladas, ejecutar desde la raíz del
proyecto:

```powershell
npm run bd:iniciar
npm run dev -- --host 127.0.0.1 --port 5177 --strictPort --mode supabase
```

El primer comando inicia el proyecto Docker `reportes-icsi-local`, genera las claves de este entorno
en `.env.supabase.local` y aplica las migraciones pendientes de [supabase/migrations](../supabase/migrations/).
Se puede volver a ejecutar al retomar el trabajo o recibir una migración nueva. PostgreSQL conserva
los datos en el volumen `reportes-icsi-local_db-data`. La aplicación guarda fotos y documentos en
`storage/supabase-local`.

| Servicio   | Dirección local                           |
| ---------- | ----------------------------------------- |
| Aplicación | [127.0.0.1:5177](http://127.0.0.1:5177)   |
| Studio     | [127.0.0.1:55323](http://127.0.0.1:55323) |
| API        | `http://127.0.0.1:55321/rest/v1`          |
| PostgreSQL | `127.0.0.1:55322`                         |

La base inicia con el esquema, sin registros de trabajo. Reportes gestiona sus cuentas en sus tablas
de personal, credenciales y sesiones. Para configurar el primer acceso, dar de alta a una persona
administradora en **Personal** y abrir [Configurar acceso](http://127.0.0.1:5177/acceso/configurar).

Para consultar el estado de los servicios de este proyecto:

```powershell
docker compose --env-file .env.supabase.local -f supabase/compose.local.yml ps
```

Los scripts de Node que usan la base, como `scripts/cuenta.ts`, se pueden ejecutar con
`node --env-file=.env.supabase.local` delante de la ruta del script.
