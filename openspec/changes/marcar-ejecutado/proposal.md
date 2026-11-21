# Proposal

## Why

El usuario quiere registrar en el programa anual que una partida ya se ejecutó aunque su reporte
todavía no exista: ejecutar y documentar son dos cosas distintas. Hoy el estado «Ejecutado» solo se
alcanza con un reporte emitido o con «Registrar realizado externo», un formulario al final de la
página pensado para trabajos documentados fuera del sistema (Word). Además, si se registrara un
realizado y después se emitiera el reporte de ese mismo mes, el mes contaría la ejecución dos veces.

Ejemplo real: la partida 2 de Cerritos es diaria (30 o 31 por mes) y se documenta con un solo reporte
al final del mes, cuyos días de ejecución cubren el mes. Durante el mes el programa debe poder mostrar
«Ejecutado» con el reporte pendiente.

## What Changes

**Comportamiento actual comprobado (2026-11-19, rama `feat/concentrado-centros`):**

- `programa_realizados_manuales` guarda los realizados sin reporte con `origen` `manual` o
  `importacion` (0002, 0008). `v_realizado` (0003) suma las ejecuciones de reportes emitidos y esos
  realizados; `api_obtener_programa` lo expone como `realizado` y `realizadoSinReporte`.
- El panel de la celda solo ofrece «Registrar realizado externo», que abre el formulario general.
  No hay forma de quitar un realizado manual.
- La tarjeta de la celda pinta «Ejecutado» en verde tenga o no reporte; la segunda fila solo cambia
  el texto a «Sin reporte».

**Comportamiento propuesto:**

- «Marcar ejecutado» en el panel de la celda (mes en curso o terminado, con algo por ejecutar), con
  cantidad (hasta lo que falta), fecha de ejecución obligatoria dentro del mes y nota opcional.
  «Desmarcar ejecutado» quita la marca más reciente del mes. Al marcar, la notificación ofrece
  «Deshacer».
- Una marca es un realizado con `origen = 'marca'` y fecha de ejecución obligatoria (0027). Los reportes emitidos del mismo
  mes la absorben: cuenta solo lo que los reportes no cubren, de modo que no hay doble conteo.
- La tarjeta de un mes ejecutado sin reporte completo usa un tono propio («Ejecutado sin reporte»,
  verde lima con borde discontinuo) en sus dos filas, y la leyenda lo explica.
- Migración `0026_marcar_ejecutado.sql`: origen `marca`, columna `fecha_ejecucion`, `v_realizado`
  con la absorción, y las funciones `api_marcar_ejecutado`, `api_desmarcar_ejecutado` y
  `api_listar_marcas_ejecucion`. Sin cambios en otras tablas. Ajuste del 2026-11-19
  (`0027_fecha_ejecucion_obligatoria.sql`): la fecha de ejecución pasa a ser obligatoria, con una
  restricción `NOT VALID` que respeta las marcas anteriores sin fecha.

## Impact

- Datos: `supabase/migrations/0026_marcar_ejecutado.sql`, `supabase/esquema_completo.sql`.
- Servidor: `src/lib/server/repositorios/programa.ts`, `src/routes/planeacion/+page.server.ts`.
- Interfaz: `src/lib/components/views/PlaneacionView.svelte`,
  `src/lib/components/planeacion/DialogoEjecutado.svelte`, `programa.css` y `programa-nuevo.css`.
- El tablero, el concentrado y «Mi trabajo» leen el mismo `v_realizado`, así que heredan la
  absorción sin cambios propios. Los realizados importados y los externos no cambian.
