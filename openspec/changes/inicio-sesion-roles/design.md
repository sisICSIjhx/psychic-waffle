# Design

## Context

Ver `proposal.md` para el motivo. Restricciones que dan forma al diseño:

- El servidor es el único cliente de la base: todo pasa por funciones `api_*` (jsonb → jsonb) que
  se llaman igual en PGlite y en Supabase con la clave de servicio (`src/lib/server/bd/`). Las
  tablas solo las toca el rol de servicio (política de la 0004), así que RLS no distingue usuarios.
- Hoy se trabaja en local con PGlite; el proyecto de Supabase sigue pendiente. Lo que se construya
  debe funcionar idéntico en ambos.
- `src/lib/server/permisos.ts` y `App.Locals` ya esperan `locals.autenticacion` y `locals.usuario`;
  sin autenticación todo se permite, y varias pruebas llaman a `load` sin `locals`.
- Datos personales fuera de lo versionable; pruebas con nombres ficticios.

## Goals / Non-Goals

**Goals:**

- Saber quién es cada persona y limitar por rol lo que modifica, comprobado en el servidor.
- No dejar a nadie fuera al activar: la base local actual no tiene cuentas.
- No cerrar el camino a Microsoft ni al alcance por centro de costo.

**Non-Goals:**

- Filtrar los datos por proyecto o centro de costo. La unidad de asignación cambia en la etapa 2
  (de proyecto a centro de costo); filtrar ahora por proyecto sería rehacerlo.
- Inicio de sesión con Microsoft, recuperación por correo y segundo factor.
- Permisos de contrato, montos y cobranza: llegan con sus pantallas (etapa 4). Aquí solo existen
  los roles que los usarán.

## Decisions

**D1. Cuentas propias, no Supabase Auth.** La identidad es el correo de `personal` y una contraseña
guardada por el sistema. Supabase Auth exigiría el proyecto de Supabase y no podría probarse con
PGlite; Microsoft exige un registro en Entra ID que aún no existe. Como el servidor ya es el único
cliente de la base, una sesión propia no pierde nada frente a los JWT de Supabase.

**D2. Tablas.** `credenciales` (1:1 con `personal`: resumen de la contraseña, `debe_cambiar`,
intentos fallidos, `bloqueada_hasta`, último acceso) y `sesiones` (resumen del identificador,
persona, creada, último uso, caduca, revocada). Borrar a la persona borra ambas en cascada.
`personal.usuario_auth_id` se conserva sin uso, reservado para vincular la cuenta de Microsoft.

**D3. Resumen de la contraseña con scrypt en Node** (`node:crypto`, N = 32768, r = 8, p = 3, sal de
16 bytes, 64 bytes de salida), guardado en un texto que incluye sus parámetros
(`scrypt$N$r$p$sal$resumen`) para poder endurecerlos sin migrar. Se descartó `pgcrypto` porque
PGlite no lo garantiza y porque la contraseña viajaría a la base. La comparación usa
`timingSafeEqual`. Sin dependencias nuevas.

**D4. Identificador de sesión opaco.** 32 bytes aleatorios en base64url en la cookie `icsi_sesion`
(`HttpOnly`, `SameSite=Lax`, `Secure` sobre HTTPS, `Path=/`); la base guarda su SHA-256. Se
descartó un JWT firmado: no permite cerrar sesión ni revocar al dar de baja sin consultar la base
de todos modos.

**D5. Caducidad.** 7 días desde el inicio y 12 horas de inactividad. `ultimo_uso_en` se actualiza
como mucho una vez cada 5 minutos para no escribir en cada petición.

**D6. Activación «cerrada por omisión».** El inicio de sesión está activado cuando existe al menos
una credencial (`api_contexto_acceso` lo informa). Se eligió «existe una credencial» y no «existe un
administrador activo con credencial» para que un error nunca reabra la aplicación: si faltara el
administrador, se sigue exigiendo sesión y se recupera con `npm run cuenta`. Para que ese estado no
se alcance por la interfaz: la primera credencial solo puede ser de un administrador activo, y
`api_guardar_personal` y `api_quitar_acceso` rechazan dejar sin cuenta al último administrador
activo. La activación vive en `/acceso/configurar` y deja de existir cuando hay una credencial.

**D7. Guardia central en `src/hooks.server.ts`.** Por petición: una llamada a `api_contexto_acceso`
con el resumen de la cookie devuelve si está activado y el usuario; se llenan `locals.autenticacion`
y `locals.usuario`, y una función pura (`src/lib/server/autenticacion/acceso.ts`) decide permitir,
redirigir a `/acceso?destino=…` o responder 401/403. Una caché en memoria de 10 segundos por
resumen de sesión evita una consulta por cada miniatura de foto; se vacía al cerrar sesión, al
cambiar contraseñas y al guardar personal. El costo es que una sesión revocada desde otro proceso
puede valer hasta 10 segundos más.

**D8. Capacidades declaradas una vez.** `src/lib/dominio/permisos.ts` tiene la matriz rol →
capacidades, sin dependencias de servidor, para que la usen el servidor y el menú.
`src/lib/server/permisos.ts` conserva sus funciones (`puedeEditarCatalogo`…) apoyadas en la matriz.
La guardia aplica además una tabla prefijo de ruta → capacidad a toda petición que no sea GET o
HEAD (`/reportes` y `/captura` → capturar; `/planeacion` → ajustar el programa; `/catalogo` y
`/equipos` → editar el catálogo; `/personal` → administrar el personal; `/perfil` y `/acceso` →
cualquiera con sesión). Lo no declarado se permite solo al administrador. Las comprobaciones que ya
hay en cada acción se conservan como segunda barrera.

**D9. Intentos repetidos.** Por cuenta, en la base: 5 fallos seguidos bloquean 15 minutos. Por
dirección de red, en memoria: 20 intentos en 10 minutos. El mensaje es el mismo para correo
desconocido, contraseña incorrecta, baja y persona sin cuenta, y con correo desconocido se calcula
un resumen ficticio para que el tiempo de respuesta no delate si el correo existe. El límite por
dirección no sobrevive a un reinicio ni se comparte entre instancias; el del proxy inverso
(propuesta 3 de `docs/OPTIMIZACION_SEGURIDAD_Y_PROPUESTAS.md`) lo complementará al desplegar.

**D10. Contraseña temporal.** 12 caracteres de un alfabeto sin signos ambiguos, en tres grupos,
generada en el servidor y mostrada una sola vez en la respuesta de la acción; `debe_cambiar` obliga
al cambio. Regla de contraseñas: de 10 a 128 caracteres, distinta del correo y de la actual, sin
reglas de composición (criterio de NIST 800-63B).

**D11. `/acceso` fuera del armazón.** `+layout.svelte` no pinta menú ni cabecera en las rutas
`/acceso`. Un grupo de rutas obligaría a mover todas las carpetas de `src/routes`.

**D12. Personal.** `sede` (texto opcional), `fecha_nacimiento` deja de ser obligatoria (la lista
entregada no la trae) y los roles con proyectos admiten no tener ninguno: de las personas de la
lista, la mayoría trabaja en centros de costo que aún no existen en el sistema, y obligar a elegir
un proyecto impediría hasta corregir un nombre. Esto cambia la regla «al menos un proyecto» del
cambio `alcances-personal-esquema-bd` (D3), aún sin archivar. `api_importar_personal` carga en
bloque con ensayo, igual que `api_importar_equipos`; la división del nombre es una función pura de
`src/lib/dominio/personal.ts`.

**D13. Microsoft después.** Verificar la identidad con Microsoft sería otra forma de llegar a
«esta persona es este correo»; las sesiones, la guardia y los permisos no cambian.

## Risks / Trade-offs

- [Mientras no se active, la aplicación sigue abierta y cualquiera en la red puede activarla] →
  es la exposición que ya existe hoy; el menú lo avisa y `npm run cuenta` permite activarla desde
  el servidor sin pasar por la interfaz.
- [Sin correo saliente, quien olvida su contraseña depende de un administrador] → aceptado para la
  fase 1; el administrador genera otra temporal, y el último administrador usa `npm run cuenta`.
- [El alcance por proyecto no se aplica: un reporteador con sesión ve los reportes de todos los
  proyectos] → mejora lo actual (sin sesión, todos ven todo); se cierra en la etapa 2 y la ficha de
  personal lo dice.
- [Con PGlite, `npm run cuenta` y `npm run importar:personal` exigen detener el servidor] → igual
  que los demás scripts; está en la ayuda de cada uno.
- [Caché de sesión de 10 segundos] → acotado y solo entre procesos; en el mismo proceso se vacía.

## Migration Plan

1. La migración 0022 se aplica sola al abrir PGlite; en Supabase, con su CLI o con
   `supabase/esquema_completo.sql` en una base vacía.
2. Tras aplicarla nada cambia para quien usa la aplicación hasta que alguien active el inicio de
   sesión.
3. Activar: registrar en Personal a un administrador con correo, abrir «Activar inicio de sesión» y
   crear su contraseña; después, generar las contraseñas temporales de los demás.
4. Vuelta atrás: borrar las filas de `credenciales` deja la aplicación abierta como antes.

## Open Questions

- Rol y proyectos de cada persona de la lista: no cambian el diseño; se asignan en Personal.
