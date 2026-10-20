# Claude Code

@AGENTS.md
@docs/CONTEXTO_PROYECTO.md

## Particularidades

- Aplicar automáticamente la política adaptativa importada desde AGENTS.md; el usuario no tiene que recordarla en cada petición.
- CodeGraph está en .mcp.json y usa el índice local .codegraph/; herramienta `mcp__codegraph__codegraph_explore` con alcance inicial de 2 a 4 archivos.
- OpenSpec utiliza las habilidades `.claude/skills/openspec-*`. Ejecutar sus comandos de terminal mediante `npm run spec -- <comando>` desde la raíz (`C:\reportes-icsi`).
- Consultar historial y specs solo cuando la tarea lo requiera.
