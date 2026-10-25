# Revisión con Codex — UX, fase A (fundamentos y arreglos rápidos)

Plan: `docs/PLAN_DISENO_UX.md` (hallazgos H3 a H7 y H13 a H16; nivel 1, sin OpenSpec). Rama:
`feat/ux-fase-a`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con el plan
como contexto y `-Cambio` describiendo la fase. La ronda 1 revisó el rango completo de la fase con
`-Base` (12 commits). Codex no ejecutó comandos. Ninguna ronda tocó `insumos/`, `storage/` ni `.env*`.

## Ronda 1 (rango dfbc60f..fa0a96d)

Codex no informó hallazgos. La autorrevisión posterior del mismo diff encontró uno:

| Severidad | Hallazgo                                                                                                                                                                                                                         | Resolución                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta      | Con el menú contraído guardado, a 375 px `.layout.is-collapsed` (más específica) ganaba a la regla de móvil: dos columnas y el contenido en 80 px. El defecto existía al contraer dentro del menú móvil; recordarlo lo agravaba. | Corregido en 1140203: en móvil se ignora el estado contraído y se oculta el botón de contraer; se retira la regla sin uso `#btn-collapse`. Comprobado en Chromium a 375 → 1366 → 375 px (375/1286) |

## Ronda 2 (commit 1140203, última permitida)

Codex no informó hallazgos: la preferencia de menú contraído queda limitada al escritorio, el punto de
quiebre de 768 px coincide en CSS y en el layout y el control que no aplica se oculta en móvil.

## Validación de la fase

- `npm run check`: 0 errores y 0 advertencias. `npx eslint .`: sin observaciones.
  `npx prettier --check --end-of-line auto .`: sin observaciones (ver la nota sobre CRLF en
  `HISTORIAL.md`).
- `npm run test`: 24 archivos y 150 pruebas aprobadas. Pruebas nuevas o ampliadas: insignia de estado
  (texto e icono distintos por estado), símbolos y leyenda de la matriz de planeación, ancho de la
  lista de fotos en un contenedor de 280 px (falla sin el arreglo: 923 px), `aria-current` y menú sin
  «Personal» ni «Mi Perfil», nombre y `aria-expanded` del botón del menú móvil, aviso «Sin conexión»
  con los eventos de red, preferencias de tema (con la clave del script de `app.html`), título del
  editor, plurales y meses.
- Auditoría en Chromium (Playwright) contra el servidor de desarrollo con PGlite: panel, captura,
  editor, planeación, historial y catálogo a 1366 × 800 y 375 × 812, en tema claro y oscuro (24
  combinaciones), con capturas antes y después fuera del repositorio (muestran datos de los reportes).

  | Medición                                              |       Antes |    Después |
  | ----------------------------------------------------- | ----------: | ---------: |
  | Textos bajo 4.5:1 (3:1 si es grande)                  |         482 |          0 |
  | Bordes de campo bajo 3:1                              |         168 |          0 |
  | Objetivos bajo 24 px (sin enlaces dentro de un texto) |         102 |          0 |
  | Vistas con desborde horizontal                        |           6 |          0 |
  | Alto de la barra fija del editor, escritorio / móvil  | 81 / 161 px | 62 / 96 px |

- Comprobaciones puntuales: tema aplicado antes de pintar con el sistema claro u oscuro y con
  preferencia guardada (fondo correcto en los cuatro casos; tema y menú recordados al recargar);
  «Saltar al contenido» visible con Tab y foco en el primer filtro tras activarlo; aviso «Sin
  conexión» al cortar y restablecer la red; con `prefers-reduced-motion` las animaciones duran
  0,01 ms; con el menú móvil cerrado, Tab pasa del botón del menú al contenido.
