# Memoria del proyecto y especificaciones

Objetivo: conservar decisiones y recuperar únicamente el contexto pertinente.

## Qué se lee y cuándo

| Archivo                   | Uso                                                            |
| ------------------------- | -------------------------------------------------------------- |
| AGENTS.md                 | Instrucciones comunes y política adaptativa                    |
| CLAUDE.md                 | Importación y particularidades de Claude                       |
| docs/CONTEXTO_PROYECTO.md | Mapa breve al iniciar una tarea                                |
| HISTORIAL.md              | Buscar decisiones y entregas por tema                          |
| openspec/specs/           | Requisitos de la capacidad afectada                            |
| openspec/changes/         | Propuesta y tareas del cambio pertinente                       |
| Git                       | Aún no inicializado; mientras tanto, respaldar antes de editar |

## Rutina de trabajo

1. Leer contexto breve y localizar el área afectada.
2. Usar CodeGraph para dependencias y fuentes relevantes con maxFiles de 2 a 4; consultar directamente los archivos que el índice no cubra.
3. Aplicar la política de AGENTS: menor directo, moderado con plan breve, mayor/crítico con OpenSpec, respetando el proceso solicitado por el usuario.
4. Validar proporcionalmente, registrar resultados reales en el historial y actualizar el contexto solo si cambia el estado vigente.
5. Para otro chat, recuperar el resumen vigente y los pendientes necesarios; no pegar toda la conversación anterior.

## Herramientas

- OpenSpec: npm run spec -- <comando>, npm run spec:list, npm run spec:check.
- CodeGraph: npm run graph:status, npm run graph:sync, npm run graph -- explore "consulta" --max-files 3.
- La conexión MCP de Claude está en .mcp.json. Su índice .codegraph/ es generado y se reconstruye en cada equipo (npm run graph -- init --yes).
- Con el MCP ejecutándose, CodeGraph observa cambios. Ante avisos de desactualización, comprobar la fuente y sincronizar cuando corresponda.
- Usar las habilidades de OpenSpec presentes en .claude/skills/. No editarlas a mano; actualizar con el CLI cuando se decida renovar la integración.

## Límites

Guardar archivos no garantiza ahorrar tokens: el contenido cuenta cuando se carga o se consulta. Los imports de CLAUDE también se cargan.
La política adaptativa guía al asistente; no es un clasificador determinista.
Validar specs comprueba estructura, no demuestra que el código cumpla los escenarios.
No registrar credenciales ni datos personales. No atribuir al índice una cobertura que no se haya comprobado (CSS y Markdown no se indexan).
No hay un porcentaje de ahorro garantizado; compararlo con tareas equivalentes si se requiere medirlo.
