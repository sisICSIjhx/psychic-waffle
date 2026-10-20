# Instrucciones del proyecto

- Trabajar en español, revisar el estado del proyecto y preservar cambios existentes. El proyecto no usa Git todavía: antes de editar, respaldar los archivos afectados fuera del repositorio.
- Al iniciar una tarea, leer docs/CONTEXTO_PROYECTO.md. Recuperar el resto por tema; no cargar todo el historial, todas las specs ni archivos generados (.svelte-kit/, .codegraph/, node_modules/).
- Para símbolos y dependencias, usar codegraph_explore con una consulta concreta y maxFiles de 2 a 4 inicialmente. Ampliar solo si falta contexto. No releer fuentes ya devueltas salvo cambios, truncamiento o dudas.
- Para archivos fuera del índice (CSS, Markdown, specs), usar búsqueda y lectura directas. Si falla MCP, comprobar graph:status, sincronizar si corresponde y continuar con la fuente pertinente.
- Registrar cada cambio significativo en HISTORIAL.md: fecha local, motivo, alcance, archivos, validación real y pendientes. No transcribir conversaciones ni documentar cada pregunta.
- Mantener CONTEXTO_PROYECTO breve y vigente; actualizarlo solo al cambiar arquitectura, rutas importantes o estado. El detalle va en specs e historial.
- El código actual prevalece sobre documentación antigua; resolver discrepancias dentro del alcance solicitado.
- Ejecutar pruebas proporcionales con los comandos reales: npm run check (svelte-check), npm run lint (Prettier + ESLint), npm run test (Vitest: proyecto client en navegador con Playwright para `*.svelte.spec.ts` y proyecto server para `*.spec.ts`). Distinguir revisión estructural, ejecución de pruebas y validación visual. Para documentación, revisar enlaces y formato sin suites de aplicación rutinarias.
- Mantener credenciales y datos personales (personal, usuarios, reportes capturados) fuera de memoria, historial y specs. Los .env están ignorados; no versionarlos.
- Herramientas locales: npm run spec -- <comando>, npm run spec:check, npm run spec:list; npm run graph -- <comando>, npm run graph:status y npm run graph:sync.
- Activar solo las habilidades pertinentes; conservar sin ediciones manuales las generadas por OpenSpec.

## Convenciones del código

- SvelteKit 2 con TypeScript; importar desde src/lib mediante el alias $lib.
- Formato según .prettierrc: tabulaciones, comillas simples, sin coma final, ancho 100, plugins de Svelte y Tailwind. No reformatear archivos ajenos a la tarea.
- Svelte 5 está instalado, pero los componentes actuales usan sintaxis heredada (export let, $:, on:, createEventDispatcher). Mantener la sintaxis del archivo que se edita; migrar a runes solo como decisión explícita.
- Textos de interfaz en español. Estilos globales y variables de tema en src/app.css (data-theme dark/light); Tailwind 4 se configura en src/routes/layout.css.

## Política adaptativa de OpenSpec

Clasificar internamente por impacto, riesgo, dependencias e incertidumbre antes de implementar. Aplicar el nivel más alto que corresponda, no el número de archivos o líneas. Explicar la clasificación solo cuando afecte una decisión o el alcance.

| Nivel               | Criterio                                                                                                                                                  | Acción                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Menor           | Textos, iconos, estilos, bugs locales conocidos o refactorización pequeña sin cambio de comportamiento; bajo riesgo.                                      | Implementar y validar directamente, sin propuesta, specs ni planificación documental innecesaria.                                           |
| 2 — Moderado        | Función acotada, componentes relacionados o lógica limitada, con contratos estables y sin riesgo crítico.                                                 | Plan interno breve y criterios de aceptación; OpenSpec si la ambigüedad, dependencias o riesgo requieren conservar requisitos.              |
| 3 — Mayor o crítico | Migraciones, estructura de datos, contratos, autenticación, autorización, seguridad, módulos completos, arquitectura o impacto significativo entre capas. | Usar OpenSpec: propuesta, requisitos/escenarios, tareas y diseño cuando corresponda; implementar y verificar dentro del alcance autorizado. |

- No activar OpenSpec por estar instalado. Respetar las instrucciones explícitas del usuario sobre el proceso, conservando validación y autorizaciones necesarias.
- Reutilizar specs pertinentes y evitar documentos duplicados. Los criterios de un cambio directo no necesitan un expediente de OpenSpec.
- Reevaluar si aumenta el alcance o riesgo. Preparar los artefactos necesarios antes de la parte afectada y continuar el trabajo independiente autorizado.
- Aprovechar las autorizaciones existentes. Solicitar solo la decisión que falte ante una acción destructiva, irreversible, crítica en servicios externos o una ampliación material del alcance; preparar antes un resultado revisable.
- Clasificar y usar OpenSpec no introduce por sí mismo otra aprobación. Mantener las pruebas proporcionales en todos los niveles.
