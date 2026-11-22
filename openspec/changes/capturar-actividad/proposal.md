# Proposal

## Why

El usuario pidió que «Nuevo reporte» de la barra superior sea «Capturar», con dos opciones:
«Actividad» y «Reporte». Capturar una actividad es decir si se hizo o no una partida del programa
anual, sin abrir la matriz ni buscar la celda. Quien la captura es personal operativo poco
acostumbrado a las plataformas: la ventana debe pedir solo lo necesario.

Pedido textual resumido (2026-11-21): al elegir «Actividad» se abre una ventana con el centro de
costo, una lista desplegable con búsqueda de las actividades, si se realizó o no, la fecha (si no se
indica, la de hoy) y, opcionalmente, las personas que fueron a realizarla. Esto aplica a los centros
de costo con programa anual; los que no lo tienen van, por ahora, a la vista de seguimiento, hasta que
se carguen sus programas.

## What Changes

**Comportamiento actual comprobado (2026-11-21, rama `feat/kpi-seguimiento-centros`):**

- La barra superior (`HeaderBar.svelte`) tiene el enlace «Nuevo reporte» a `/captura`, solo con la
  capacidad `capturar`.
- «Marcar ejecutado» (cambio `marcar-ejecutado`, 0026 y 0027) solo se ofrece en el panel de la celda
  del programa anual, con la capacidad `ajustarPrograma`. La marca guarda cantidad, fecha y nota; no
  guarda quién hizo el trabajo.
- «Marcar no ejecutado» es un ajuste del programa (0019) con motivo obligatorio.

**Comportamiento propuesto:**

- «Nuevo reporte» pasa a ser el menú «Capturar» con «Actividad» y «Reporte» (`/captura`, como hoy).
- «Actividad» abre la ventana «Capturar actividad»: centro de costo, actividad (partida del programa
  vigente, con búsqueda), «¿Se realizó?» (Sí o No), fecha opcional (hoy si se deja vacía) y, si se
  realizó, las personas que fueron (opcional, con búsqueda).
- «Sí» registra una marca de ejecución (la misma de «Marcar ejecutado», cantidad 1) con las personas.
  «No» registra un ajuste «No ejecutado» de 1 en el mes de la fecha, con motivo «Otro» y una nota
  que indica su origen.
- Un centro de costo sin programa anual muestra en la ventana el enlace a su seguimiento del mes.
- Migración `0029_personal_marca_ejecucion.sql`: tabla `programa_marca_personal` (marca y persona) y
  `api_marcar_ejecutado` acepta `personalIds`.
- Ruta `/actividades` (`+server.ts`): `GET` da los centros de costo visibles, si tienen programa, las
  partidas del centro elegido con lo que falta por mes y el personal activo; `POST` registra.

## Impact

- Datos: `supabase/migrations/0029_personal_marca_ejecucion.sql`, `supabase/esquema_completo.sql`.
- Servidor: `src/lib/server/repositorios/programa.ts`, `src/routes/actividades/+server.ts`,
  `src/lib/server/autenticacion/acceso.ts`.
- Dominio: `src/lib/dominio/actividades.ts` (validación de la captura).
- Interfaz: `src/lib/layout/HeaderBar.svelte`, `src/lib/components/actividades/DialogoActividad.svelte`,
  `src/routes/+layout.svelte`.
- Permisos: registrar una actividad exige `capturar` (lo tienen administrador, líderes y
  reporteador). Hoy marcar ejecutado en la matriz exige `ajustarPrograma`; ese botón no cambia.
- El tablero, el concentrado y «Mi trabajo» leen `v_realizado` y los ajustes: reflejan la captura sin
  cambios propios.
