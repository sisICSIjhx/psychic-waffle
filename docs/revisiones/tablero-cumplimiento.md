# Revisión con Codex — tablero de cumplimiento

Cambio OpenSpec: `tablero-cumplimiento`. Rama: `feat/tablero-cumplimiento`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con `-Cambio`
y como contexto la propuesta, el diseño, las tareas, las dos specs del cambio y
`0019_cumplimiento.sql`. Codex no ejecutó comandos ni tocó `insumos/`, `storage/` ni `.env*`.

## Ronda 1 (rango 50c3f82..0f333e2)

| Severidad | Hallazgo                                                                                                                                                                                                    | Resolución                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta      | Las ejecuciones de un ajuste contaban filas de reportes emitidos, no unidades distintas: varios TAG de una ocurrencia daban por cubierta una reprogramación de 2 y una diaria con varios días quedaba corta | Corregido en 3b886c2: `ejecuciones_de_ajuste` usa la unidad de `v_ejecuciones_reportes` (días distintos en las diarias, ocurrencias distintas en las demás), con prueba |
| Media     | Un mes de corte como `2026-13` o `2026-00` pasaba la validación y provocaba un error del servidor                                                                                                           | Corregido en 3b886c2: solo se aceptan meses 01 a 12; otro valor usa el mes en curso, con prueba                                                                         |

## Ronda 2 (rango 0f333e2..3b886c2, última permitida)

| Severidad | Hallazgo                                                                | Resolución                                              |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| Media     | `corte=0000-01` pasaba la validación y PostgreSQL no admite el año cero | Corregido: solo se aceptan años 2000 a 2099, con prueba |

## Validación del cambio

- `npm run check` 0/0, `npm run lint` sin observaciones y `npm run test` con 51 archivos y 391 pruebas.
- Detalle de la validación en la base de desarrollo y en el navegador en la entrada del 2026-10-22 de
  `HISTORIAL.md`.
