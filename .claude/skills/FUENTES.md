# Skills de Claude del proyecto

Instaladas el 2026-10-24 desde los repositorios originales, fijadas a los commits
indicados. Se conserva el contenido original, incluidas referencias y scripts.

| Skill | Repositorio | Ruta original | Commit |
| --- | --- | --- | --- |
| interface-design | [Dammyjay93/interface-design](https://github.com/Dammyjay93/interface-design) | `.claude/skills/interface-design` | `2f9be3206855bcb2d1d0af262c8bae25cba6658d` |
| impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `.claude/skills/impeccable` | `936867543ac2576920d663cc9803597f6044f3ac` |
| better-interface | [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | `skills/better-interface` | `90f01412aebb0361671215be1383ca73527e3ed6` |
| vue-best-practices | [vuejs-ai/skills](https://github.com/vuejs-ai/skills) | `skills/vue-best-practices` | `198f0cd8f7f9c0a3d9b566ccc16de6677519ee78` |

`better-interface` requiere las skills hermanas `better-accessibility`,
`better-colors`, `better-layout`, `better-typography`, `better-ui` y `better-writing`.
Se incluyen desde `skills/` de jakubkrehel/skills en el mismo commit.
Las licencias originales están en `_licenses/`.

Uso en Claude: `/interface-design`, `/impeccable audit`, `/impeccable polish`,
`/better-interface` y `/vue-best-practices`. Si no aparecen, iniciar una nueva
sesión de Claude en este proyecto.

La instalación de Vue no cambia el stack SvelteKit del proyecto. Esa skill se
aplica a trabajo con Vue. No se modificaron las skills generadas por OpenSpec.

Impeccable incluye un lanzador para Windows (`scripts/impeccable.cmd`) que puede
descargar su motor en el primer uso. Aquí se instalaron sus archivos sin ejecutar
el motor ni agregar hooks a `.claude/settings.json`. La validación de instalación
es estructural y por SHA-256; no constituye una prueba de ejecución en Claude.
