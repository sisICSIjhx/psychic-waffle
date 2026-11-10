# Tasks

Rama `feat/inicio-sesion-roles` desde `feat/centro-de-costo`. Migración `0022_autenticacion.sql`.

## 1. Datos

- [x] 1.1 Migración 0022: `sede`, fecha de nacimiento opcional, seis roles, tablas `credenciales` y
      `sesiones` con RLS, `json_personal` con `sede` y `acceso`, y `api_guardar_personal` sin exigir
      proyectos y con las guardas del último administrador y del correo. Se comprueba con las
      pruebas de repositorio sobre PGlite.
- [x] 1.2 Funciones `api_contexto_acceso`, `api_credencial_de_correo`,
      `api_registrar_acceso_fallido`, `api_abrir_sesion`, `api_cerrar_sesion`,
      `api_establecer_contrasena`, `api_quitar_acceso` y `api_importar_personal`. Se comprueba con
      las pruebas de 1.3.
- [x] 1.3 Esquemas Zod, `RepositorioAutenticacion`, `RepositorioPersonal.importar` y pruebas sobre
      PGlite: primera cuenta solo de administrador, bloqueo, caducidad, revocación, último
      administrador e importación.
- [x] 1.4 Regenerar `supabase/esquema_completo.sql` con `npm run bd:script`; su prueba pasa.

## 2. Servidor

- [x] 2.1 `src/lib/server/autenticacion/contrasenas.ts` (scrypt, regla y contraseña temporal) y
      `sesiones.ts` (identificador, resumen y cookie), con pruebas.
- [x] 2.2 `src/lib/dominio/permisos.ts` con la matriz de capacidades y `src/lib/server/permisos.ts`
      apoyado en ella; pruebas de la matriz completa.
- [x] 2.3 `src/lib/server/autenticacion/acceso.ts`: política pura (permitir, redirigir, 401, 403)
      con pruebas de cada rama.
- [x] 2.4 `src/lib/server/autenticacion/servicio.ts`: iniciar sesión (mensaje uniforme, bloqueo,
      límite por dirección), cerrar, cambiar contraseña y generar temporal, con pruebas.
- [x] 2.5 `src/hooks.server.ts`: sesión en `locals`, guardia y caché; prueba de `handle` con y sin
      activación.

## 3. Interfaz

- [x] 3.1 `/acceso` (entrar y salir) y `/acceso/configurar` (activación), fuera del armazón;
      pruebas de las acciones.
- [x] 3.2 `/perfil`: datos de la cuenta y cambio de contraseña, con el aviso de contraseña
      temporal.
- [x] 3.3 `/personal`: sede, fecha opcional, seis roles, columna de acceso, y en la ficha «Acceso
      al sistema» con generar contraseña temporal y quitar acceso.
- [x] 3.4 `+layout.server.ts`, barra lateral y cabecera: persona y rol, «Mi perfil», «Cerrar
      sesión», destinos según el rol y aviso de activación; pruebas de la barra lateral.
- [x] 3.5 Editor de reportes y programa en solo lectura para quien no puede capturar o ajustar.

## 4. Personal

- [x] 4.1 `dividirNombre` en `src/lib/dominio/personal.ts` con pruebas de nombres ficticios.
- [x] 4.2 `scripts/importar-personal.ts` (`npm run importar:personal`) con ensayo por omisión y
      `scripts/cuenta.ts` (`npm run cuenta`).
- [x] 4.3 Ensayo y carga de la lista entregada en la base local; se comprueba en `/personal`.

## 5. Cierre

- [x] 5.1 `npm run check`, `npm run lint`, `npm run test` y `npm run spec:check`.
- [x] 5.2 Prueba en el navegador: activación, entrada, contraseña temporal, cambio, cierre, un rol
      sin captura y un intento sin sesión.
- [x] 5.3 `HISTORIAL.md`, `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_SEGUIMIENTO_CENTROS_COSTO.md` y
      `.env.example` si hiciera falta.
