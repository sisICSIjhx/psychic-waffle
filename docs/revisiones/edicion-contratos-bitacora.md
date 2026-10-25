# Revisión con Codex — edición de contratos con bitácora

Cambio OpenSpec: `edicion-contratos-bitacora`. Rama: `feat/edicion-contratos`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con `-Cambio`
y como contexto la propuesta, el diseño, las tareas, las dos specs del cambio y
`0018_bitacora_catalogo.sql`. Codex no ejecutó comandos ni tocó `insumos/`, `storage/` ni `.env*`.

## Ronda 1 (rango 6814451..3d7c34a)

| Severidad | Hallazgo                                                                                                                                            | Resolución                                                                                                                                                                                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Media     | `fuera_de_vigencia` solo revisaba los meses del periodo de cada programa, no los meses programados ni los realizados manuales que pide el requisito | Corregido en 8602f8e: la consulta agrega `programa_meses` (con cantidad) y `programa_realizados_manuales`, el detalle del rechazo los nombra («Meses programados de…», «Realizados registrados de…») y la prueba lo comprueba. Hoy el disparador de 0002 ya los limita al periodo del programa, así que era una defensa de más |

## Ronda 2 (rango 3d7c34a..8602f8e, última permitida)

Sin hallazgos: Codex confirmó que la vigencia ya revisa los meses programados y los realizados
manuales y que la presentación y las pruebas son coherentes.

## Validación del cambio

- `npm run check` 0/0, `npm run lint` sin observaciones y `npm run test` con 47 archivos y 349 pruebas.
- Detalle de la validación en la base de desarrollo y en el navegador en la entrada del 2026-10-22 de
  `HISTORIAL.md`.
