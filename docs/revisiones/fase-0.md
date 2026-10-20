# Revisión con Codex — Fase 0 (preparación)

Cambio OpenSpec: `reportes-mantenimiento-for-icsi-rmt-01`. Rama: `feat/reportes-rmt-01`.

## Cómo se ejecutó

- Script: `scripts/revision-codex.ps1 -Sha <sha> -Fase 0` (Codex CLI 0.146.0, modelo `gpt-5.6-sol`,
  sandbox de solo lectura).
- Codex 0.146 no admite `--commit` junto con instrucciones propias. El script envía en el prompt
  las instrucciones fijas, `design.md`, `tasks.md` y el diff del commit; Codex no necesita leer el
  disco. Además se ejecuta en un worktree temporal del commit, que no contiene rutas ignoradas.
- El modelo configurado por defecto (`gpt-6.1-sol`) no está disponible con la cuenta de ChatGPT;
  el script fija un modelo disponible con `-Modelo`.
- El sandbox de Windows de Codex no inicia (`codex-windows-sandbox-setup.exe` no se encuentra y su
  configuración pide cambiar ACL del sistema). No se modificó la configuración de seguridad: con el
  diff en el prompt, la revisión no requiere ejecutar comandos.

## Prueba del script (tarea 0.4, commit 20f235d)

- Comandos ejecutados por Codex: 0. Ninguna mención a `insumos/`, `storage/` ni `.env*`.
- Hallazgos sobre el plan (6) y resolución:

| Severidad | Hallazgo                                                       | Resolución                                                    |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Alta      | La plantilla derivada de un reporte real debe sanearse         | Corregido: tarea 2.1 exige saneamiento y auditoría automática |
| Alta      | El realizado no contemplaba los realizados históricos manuales | Corregido: spec `programa-anual`, diseño D1 y tarea 3.2       |
| Alta      | Revisiones de reportes emitidos podían duplicar el realizado   | Corregido: `revision` y `sustituye_a` en diseño, spec y 3.3   |
| Media     | La exclusión de `.env*` impedía revisar `.env.example`         | Corregido: tarea 0.3 y script revisan `.env.example` aparte   |
| Media     | La captura pedía un solo TAG aunque Cerritos agrupa varios     | Corregido: spec `captura-reportes` con uno o varios TAG       |
| Media     | El pie «Ilustración n.m» contradecía «Ilustración 2.n.m»       | Corregido: spec `generacion-documental`                       |

## Ronda 1 (commit c6877d1)

| Severidad | Hallazgo                                                                   | Resolución                                                       |
| --------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Alta      | El diff enviado podía incluir `insumos/`, `storage/` o `.env*` versionados | Corregido: exclusiones por pathspec, aviso y rechazo de contexto |
| Media     | Faltaba definir el nombre de archivo con varios TAG                        | Corregido: primer TAG más «+N», escenario nuevo y tarea 2.2      |
| Media     | Los realizados manuales no guardaban su fecha de registro                  | Corregido: `registrado_en` en diseño y tarea 3.2                 |

## Validación de la fase

Línea base previa a la fase 1 (errores preexistentes del shell, que corrige la fase 1):

- `npm run check`: 5 errores y 8 advertencias en `+layout.svelte` y la barra lateral.
- `npm run lint`: Prettier marca 8 archivos sin formato previos.
- `npm run test`: 1 prueba aprobada (server) y 1 archivo fallido (client) por la importación rota de
  `DashboardView`. Se instaló el Chromium de Playwright, que faltaba.
