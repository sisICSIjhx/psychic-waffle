# Revisión con Codex — Fase 3 (modelo de datos y repositorios)

Cambio OpenSpec: `reportes-mantenimiento-for-icsi-rmt-01`. Rama: `feat/reportes-rmt-01`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con
`design.md`, `tasks.md` y las specs de catálogo, programa y captura como contexto. En la ronda 1
Codex intentó leer `AGENTS.md` del directorio vacío (falló por el sandbox); en la ronda 2 no
ejecutó comandos. Ninguno tocó `insumos/`, `storage/` ni `.env*`.

## Ronda 1 (commit 2cbf474)

| Severidad | Hallazgo                                                                  | Resolución                                                                         |
| --------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Alta      | Quitar una foto de una revisión podía borrar archivos que usa el original | Corregido: solo se devuelven rutas sin otra foto que las use, con prueba           |
| Media     | Agregar foto sin versión omitía la comprobación optimista                 | Corregido: versión obligatoria en TypeScript y en SQL, con prueba                  |
| Media     | Un reporte aceptaba equipos de otro sitio                                 | Corregido: disparador en `reporte_equipos`, con prueba                             |
| Media     | Con configuración parcial de Supabase se usaba PGlite en silencio         | Corregido: `elegirOrigenDatos` lanza un error claro, con prueba                    |
| Media     | Corregir un TAG en el catálogo cambiaba reportes ya capturados            | Corregido: copia del TAG en `reporte_equipos`, usada por el reporte y el historial |
| Media     | Un realizado manual podía contarse en otro programa superpuesto           | Corregido: realizado por programa y prohibición de periodos superpuestos           |
| Media     | Acortar un periodo dejaba meses programados fuera                         | Corregido: el disparador rechaza el cambio, con prueba                             |
| Media     | Altas concurrentes de firmantes podían traslaparse                        | Corregido: la validación bloquea la fila del contrato                              |

## Ronda 2 (commit cfb434e, última permitida)

| Severidad | Hallazgo                                                              | Resolución                                                             |
| --------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Media     | Acortar un periodo podía ocultar reportes emitidos sin mes programado | Corregido: la validación de 0003 incluye reportes emitidos, con prueba |

## Validación de la fase

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones.
- `npm run test`: todas las pruebas aprobadas, entre ellas 25 de repositorios sobre PGlite
  (unicidad de sitio, partida y TAG; contrato vigente; firmantes; programa de 12 meses; diferencia
  de cantidad anual; realizado con TAG, semanas, manuales y revisiones; conflicto de versión; fotos;
  estados; historial; RLS) y 3 del adaptador de Supabase con `supabase-js` simulado.
- La conexión real con Supabase queda para la tarea 3.8 (el proyecto aún no existe).
