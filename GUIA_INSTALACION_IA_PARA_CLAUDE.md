# Guía para Claude: OpenSpec, CodeGraph y memoria del proyecto

Fecha: 2026-10-19. Destinatario: **Claude Code**, con acceso a los archivos y terminal del proyecto que se desea configurar.

Este documento permite reproducir la configuración de herramientas y memoria utilizada en VACACIONES en otro proyecto. Contiene instrucciones y plantillas completas; no requiere copiar el código, las reglas de vacaciones ni el historial de ese proyecto.

## 1. Mensaje para entregar a Claude

Adjunta este archivo o colócalo dentro del proyecto de destino y envía:

```text
Configura este proyecto siguiendo la guía adjunta GUIA_INSTALACION_IA_PARA_CLAUDE.md.

Instala o reutiliza OpenSpec y CodeGraph localmente. Configura el MCP para Claude Code, los archivos de memoria y la política adaptativa de OpenSpec.

Esta solicitud autoriza la configuración local de estas herramientas. Conserva los cambios existentes, combina las configuraciones y adapta el contexto al código real de este proyecto. Usa las versiones de referencia de la guía salvo incompatibilidad comprobada; no actualices paquetes de la aplicación para instalar estas herramientas.

Completa la instalación y la validación que puedas ejecutar. Al terminar, informa versiones, archivos creados/modificados, resultado real de la consulta MCP y de OpenSpec, y cualquier activación pendiente en mi sesión. Registra la entrega en HISTORIAL.md.
```

La configuración descrita es por proyecto. No instala coordinadores, no comunica automáticamente a Claude con Codex ni requiere una API de pago adicional para estas herramientas locales.

## 2. Inspección mínima antes de modificar

1. Identifica la raíz del proyecto y lee sus instrucciones existentes, si las hay: `CLAUDE.md`, `AGENTS.md` y contexto breve.
2. Si hay Git, revisa `git status --short`. Si no hay, guarda copia de los archivos que vayas a editar.
3. Examina el gestor de paquetes, sus manifiestos y solo las rutas necesarias para identificar arquitectura y comandos reales.
4. Revisa si ya existen OpenSpec, CodeGraph, `.mcp.json`, `.claude/settings.json`, specs o habilidades. Conserva los servidores, permisos y contenido ajenos a esta instalación.
5. Distingue dependencias de herramientas de las aplicaciones. En un monorepo, conserva los paquetes independientes. En un proyecto con pnpm/yarn, adapta los comandos al gestor existente y conserva su lockfile.

Los ejemplos siguientes usan **npm y PowerShell en Windows**, como la instalación de referencia. Ejecuta los comandos desde la raíz identificada; no desde el directorio personal ni un directorio del sistema.

## 3. Instalar las herramientas localmente

Versiones fijadas en la instalación de referencia:

| Herramienta | Paquete oficial | Versión |
| --- | --- | --- |
| OpenSpec | `@fission-ai/openspec` | `1.14.2` |
| CodeGraph | `@colbymchenry/codegraph` | `1.6.2` |

Son versiones reproducibles de esta configuración, no una afirmación de que sean las más recientes. Verifica que el runtime cumpla los requisitos de los paquetes y del proyecto. OpenSpec requiere Node.js >=20.19.0; en VACACIONES el frontend exige >=22.13.0. No traslades ese requisito de frontend a otro proyecto sin comprobarlo.

```powershell
node --version
npm --version
$env:OPENSPEC_TELEMETRY = '0'
$env:CODEGRAPH_TELEMETRY = '0'
$env:DO_NOT_TRACK = '1'
```

**Si restauras este mismo proyecto y ya tienes su package.json y lockfile completos:** ejecuta `npm ci` en la raíz. Eso instala las versiones registradas. No hace falta reinicializar OpenSpec ni reemplazar sus documentos. El índice de CodeGraph se reconstruye si falta.

**Si configuras otro proyecto:** combina estas dependencias de desarrollo con su manifiesto existente. Si la raíz no tiene manifiesto npm y se decide usarla para herramientas, crea uno privado mínimo primero; no reemplaces un manifiesto existente.

```powershell
npm install --save-dev --save-exact @fission-ai/openspec@1.14.2 @colbymchenry/codegraph@1.6.2 --ignore-scripts
```

El uso de `--ignore-scripts` corresponde a estos paquetes fijados. No lo conviertas en una regla general para instalar todas las dependencias de cualquier aplicación.

Agrega o combina estas entradas dentro de `scripts` del `package.json`; el bloque **no reemplaza el archivo completo**:

```json
{
  "graph": "codegraph",
  "graph:status": "codegraph status",
  "graph:sync": "codegraph sync",
  "spec": "openspec",
  "spec:check": "openspec validate --all --strict",
  "spec:list": "openspec list --specs"
}
```

Si alguno de esos nombres ya corresponde a otra herramienta, conserva su función y usa un nombre alternativo coherente en los documentos.

```powershell
npm run spec -- --version
npm run graph -- --version
```

Conserva el lockfile generado. Si una herramienta ya está configurada con otra versión compatible, revisa la diferencia antes de reemplazarla; no mezcles ejemplos de versiones distintas sin comprobar `--help`.

## 4. Inicializar OpenSpec para Claude

En un proyecto todavía sin OpenSpec:

```powershell
npm run spec -- init --tools claude --profile core --language Spanish --no-animation
```

Si también se utilizará Codex, selecciona ambos en la misma inicialización:

```powershell
npm run spec -- init --tools claude,codex --profile core --language Spanish --no-animation
```

En un proyecto existente, conserva todos los asistentes ya configurados al añadir otro. Revisa el diff del resultado: el inicializador puede adaptar perfiles compartidos de OpenSpec. No uses `--force` por rutina.

El resultado esperado para Claude es `openspec/config.yaml`, los directorios `openspec/specs/`, `openspec/changes/` y habilidades en `.claude/skills/openspec-*`. Codex utiliza `.agents/skills/` cuando se selecciona. No edites a mano las habilidades generadas.

Combina este contexto y estas reglas con la configuración existente de `openspec/config.yaml`, adaptando el producto y stack a hechos comprobados:

```yaml
schema: spec-driven
context: |
  Language: Spanish
  All artifacts must be written in Spanish.
  Keep OpenSpec structural headings and SHALL/MUST keywords in English.
  Producto y stack: consultar docs/CONTEXTO_PROYECTO.md.
  Política adaptativa en AGENTS.md: menores directos; moderados con plan breve y OpenSpec según riesgo; mayores/críticos con OpenSpec salvo indicación explícita del usuario.
  Leer solo los módulos, specs e historial pertinentes. Preservar los cambios existentes.
rules:
  proposal:
    - Explicar brevemente el problema, el alcance y las capacidades afectadas.
    - Distinguir el comportamiento actual comprobado del propuesto.
  specs:
    - Usar requisitos SHALL y escenarios WHEN/THEN; mantener el contenido en español y los encabezados estructurales en inglés.
    - Cubrir errores, límites y permisos cuando corresponda.
  design:
    - Referenciar rutas reales y registrar las decisiones sin duplicar código.
  tasks:
    - Separar implementación y validación con tareas comprobables.
    - Incluir la actualización del historial y del contexto cuando corresponda.
operations:
  apply:
    guidance:
      - Aprovechar la autorización existente. OpenSpec no añade por sí mismo otra aprobación.
      - Ejecutar las comprobaciones pertinentes al cambio, sin declarar resultados no comprobados.
  archive:
    guidance:
      - Sincronizar specs y registrar resultados reales y pendientes en HISTORIAL.md.
```

La convención de idioma debe añadirse también manualmente si el inicializador encuentra un config existente: no asumir que `--language` lo reescribe.

## 5. Configurar y construir el índice de CodeGraph

Combina estas exclusiones genéricas en `codegraph.json`; agrega las copias descargadas y artefactos concretos del proyecto de destino:

```json
{
  "exclude": [
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".cache/**",
    "**/.env*"
  ]
}
```

CodeGraph ya excluye dependencias y builds comunes. Si el repositorio contiene SDK, bundles o directorios generados versionados, exclúyelos explícitamente. Evita excluir directorios que sí contienen el código que necesitas consultar.

Añade a `.gitignore` las rutas generadas pertinentes, sin reemplazar sus reglas:

```gitignore
/node_modules/
/.cache/
/.codegraph/
/.claude/settings.local.json
```

```powershell
npm run graph -- init --yes
npm run graph:status
```

En un índice ya existente, usa `npm run graph:sync` cuando corresponda. Comprueba los lenguajes y rutas detectados; no asumas cobertura total. En la instalación base de VACACIONES no se indexaron SQL ni Markdown: se consultan directamente con búsquedas acotadas.

## 6. Conectar CodeGraph con Claude mediante MCP

Combina esta entrada bajo `mcpServers` de `.mcp.json`. Este es el ejemplo para **Windows nativo**:

```json
{
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/d", "/c", "node_modules\\.bin\\codegraph.cmd", "serve", "--mcp", "--path", "."],
      "env": {
        "CODEGRAPH_TELEMETRY": "0",
        "DO_NOT_TRACK": "1",
        "CODEGRAPH_NO_DOWNLOAD": "1"
      }
    }
  }
}
```

Abre Claude Code en la raíz de destino: el ejemplo usa rutas relativas a ese directorio. Si el cliente inicia procesos en otro lugar, configura rutas absolutas a esa raíz usando las opciones documentadas del cliente y vuelve a validar la conexión.

En macOS/Linux, sustituye el ejecutable y los argumentos por la instalación local correspondiente (`node_modules/.bin/codegraph`, con argumentos `serve`, `--mcp`, `--path`, `.`). WSL es un entorno separado: instala sus dependencias allí y no compartas el índice binario de Windows; revisa las instrucciones de CodeGraph para WSL.

Los permisos siguientes son opcionales para evitar preguntas repetidas en consultas rutinarias. Combina únicamente estas entradas con `permissions.allow` de `.claude/settings.json`, conservando las reglas existentes:

```json
{
  "permissions": {
    "allow": [
      "mcp__codegraph__codegraph_explore",
      "Bash(npm run graph:status)",
      "Bash(npm run spec:check)",
      "Bash(npm run spec:list)"
    ]
  }
}
```

No se necesita un permiso general para todos los comandos o todos los servidores MCP. La aprobación del servidor del proyecto y el permiso para ejecutar una herramienta son mecanismos distintos. Claude puede pedir aceptar `codegraph` desde `/mcp`; registra como pendiente cualquier paso de interfaz que todavía deba realizar el usuario. No afirmes que está conectado solo porque `.mcp.json` existe.

## 7. Crear los Markdown del proyecto

Crea estos archivos si faltan. Si existen, incorpora solo las partes necesarias y conserva el contenido aceptado. Sustituye los marcadores por información comprobada; si falta evidencia, indica «pendiente de verificar».

### 7.1. AGENTS.md: instrucciones compartidas y política adaptativa

```markdown
# Instrucciones del proyecto

- Trabajar en español, revisar el estado del repositorio y preservar cambios existentes.
- Al iniciar una tarea, leer docs/CONTEXTO_PROYECTO.md. Recuperar el resto por tema; no cargar todo el historial, todas las specs ni archivos generados.
- Para símbolos y dependencias, usar codegraph_explore con una consulta concreta y maxFiles de 2 a 4 inicialmente. Ampliar solo si falta contexto. No releer fuentes ya devueltas salvo cambios, truncamiento o dudas.
- Para archivos fuera del índice, usar búsqueda y lectura directas. Si falla MCP, comprobar graph:status, sincronizar si corresponde y continuar con la fuente pertinente.
- Registrar cada cambio significativo en HISTORIAL.md: fecha local, motivo, alcance, archivos, validación real y pendientes. No transcribir conversaciones ni documentar cada pregunta.
- Mantener CONTEXTO_PROYECTO breve y vigente; actualizarlo solo al cambiar arquitectura, rutas importantes o estado. El detalle va en specs e historial.
- El código actual prevalece sobre documentación antigua; resolver discrepancias dentro del alcance solicitado.
- Ejecutar pruebas proporcionales con los comandos reales del módulo. Distinguir revisión estructural, ejecución de pruebas y validación visual. Para documentación, revisar enlaces y formato sin suites de aplicación rutinarias.
- Mantener credenciales y datos personales fuera de memoria, historial y specs. Conservar las responsabilidades de seguridad y permisos existentes.
- Herramientas locales: npm run spec -- <comando>, npm run spec:check, npm run spec:list; npm run graph -- <comando>, npm run graph:status y npm run graph:sync.
- Activar solo las habilidades pertinentes; conservar sin ediciones manuales las generadas por OpenSpec.

## Política adaptativa de OpenSpec

Clasificar internamente por impacto, riesgo, dependencias e incertidumbre antes de implementar. Aplicar el nivel más alto que corresponda, no el número de archivos o líneas. Explicar la clasificación solo cuando afecte una decisión o el alcance.

| Nivel | Criterio | Acción |
| --- | --- | --- |
| 1 — Menor | Textos, iconos, estilos, bugs locales conocidos o refactorización pequeña sin cambio de comportamiento; bajo riesgo. | Implementar y validar directamente, sin propuesta, specs ni planificación documental innecesaria. |
| 2 — Moderado | Función acotada, componentes relacionados o lógica limitada, con contratos estables y sin riesgo crítico. | Plan interno breve y criterios de aceptación; OpenSpec si la ambigüedad, dependencias o riesgo requieren conservar requisitos. |
| 3 — Mayor o crítico | Migraciones, estructura de datos, contratos, autenticación, autorización, seguridad, módulos completos, arquitectura o impacto significativo entre capas. | Usar OpenSpec: propuesta, requisitos/escenarios, tareas y diseño cuando corresponda; implementar y verificar dentro del alcance autorizado. |

- No activar OpenSpec por estar instalado. Respetar las instrucciones explícitas del usuario sobre el proceso, conservando validación y autorizaciones necesarias.
- Reutilizar specs pertinentes y evitar documentos duplicados. Los criterios de un cambio directo no necesitan un expediente de OpenSpec.
- Reevaluar si aumenta el alcance o riesgo. Preparar los artefactos necesarios antes de la parte afectada y continuar el trabajo independiente autorizado.
- Aprovechar las autorizaciones existentes. Solicitar solo la decisión que falte ante una acción destructiva, irreversible, crítica en servicios externos o una ampliación material del alcance; preparar antes un resultado revisable.
- Clasificar y usar OpenSpec no introduce por sí mismo otra aprobación. Mantener las pruebas proporcionales en todos los niveles.
```

Añade únicamente las convenciones reales del nuevo proyecto: pruebas, nomenclatura, límites de seguridad y reglas de negocio esenciales. No copies las reglas del calendario o de PostgreSQL de VACACIONES a un proyecto ajeno.

### 7.2. CLAUDE.md: importar las instrucciones compartidas

```markdown
# Claude Code

@AGENTS.md
@docs/CONTEXTO_PROYECTO.md

## Particularidades

- Aplicar automáticamente la política adaptativa importada desde AGENTS.md; el usuario no tiene que recordarla en cada petición.
- CodeGraph está en .mcp.json y usa el índice local .codegraph/; herramienta mcp__codegraph__codegraph_explore con alcance inicial de 2 a 4 archivos.
- OpenSpec utiliza las habilidades .claude/skills/openspec-*. Ejecutar sus comandos de terminal mediante npm run spec -- <comando> desde la raíz.
- Consultar historial y specs solo cuando la tarea lo requiera.
```

Este patrón reproduce la configuración compartida del proyecto base. Comprueba en `/context` o `/memory` qué instrucciones se cargan en tu versión. Los archivos importados también consumen contexto; mantener AGENTS y CONTEXTO breves es parte del ahorro. No importes automáticamente HISTORIAL ni esta guía extensa.

### 7.3. HISTORIAL.md: decisiones y entregas verificables

```markdown
# Historial del proyecto

Registro de cambios y decisiones significativas. Zona horaria: [zona del proyecto; por ejemplo America/Mexico_City].
Consultar por tema. El estado vigente está en docs/CONTEXTO_PROYECTO.md.

## AAAA-MM-DD — Configuración de herramientas y memoria

- Motivo: conservar contexto entre sesiones y recuperar código pertinente.
- Resultado: [herramientas, versiones y archivos efectivamente configurados].
- Decisiones: memoria breve, CodeGraph como índice de código y OpenSpec según impacto/riesgo.
- Validación: [comandos ejecutados, resultados y consulta MCP comprobada].
- Pendientes: [activación de sesión, errores o verificaciones faltantes].

## Formato para nuevas entradas

Agregar entradas recientes arriba, sin borrar decisiones anteriores:
- Fecha y título concreto.
- Motivo, resultado y alcance.
- Archivos, spec o commit si existe.
- Validación ejecutada y resultado real.
- Pendientes y limitaciones.

No inventar historia previa. Si se incorporan referencias de Git, indicar commit y asunto sin atribuirles pruebas no verificadas.
Archivar años cerrados en docs/historial/ cuando el archivo crezca, conservando enlaces aquí.
```

Rellena la entrada de instalación **después** de validar. No copies las entregas ni los resultados de VACACIONES.

### 7.4. docs/CONTEXTO_PROYECTO.md: mapa breve y estado vigente

```markdown
# Contexto breve del proyecto

Verificado el AAAA-MM-DD contra los archivos locales.

## Producto y arquitectura

- Producto: [objetivo comprobado].
- Stack y runtime: [versiones verificadas en manifiestos].
- Módulos y entradas: [ruta y función de cada módulo principal].
- Persistencia e integraciones: [responsabilidades; sin credenciales].

## Reglas que deben conservarse

- [Reglas esenciales verificadas; distinguir decisiones de propuestas].
- Preservar cambios manuales y límites de permisos existentes.

## Mapa para recuperar contexto

| Tema | Entrada real |
| --- | --- |
| Interfaz o módulo principal | [ruta comprobada] |
| Datos y contratos | [ruta comprobada] |
| Validación | [comandos reales y directorio] |
| Decisiones anteriores | Buscar por tema en HISTORIAL.md |
| Requisitos | openspec/specs/<capacidad>/spec.md |
| Uso de memoria y herramientas | docs/MEMORIA_Y_ESPECIFICACIONES.md |

## Estado vigente

- OpenSpec y CodeGraph: [versiones y resultado de instalación].
- MCP: [configuración y estado real de conexión].
- Cobertura del índice: [lenguajes/rutas detectados y exclusiones].
- Proceso adaptativo en AGENTS.md, importado por CLAUDE.md.
- Pendientes: [lo que falta comprobar; no inferir despliegues por presencia de archivos].
```

Mantén este documento idealmente en unas 40–70 líneas; el tamaño es una orientación, no una razón para ocultar información necesaria.

### 7.5. docs/MEMORIA_Y_ESPECIFICACIONES.md: guía de uso cotidiana

```markdown
# Memoria del proyecto y especificaciones

Objetivo: conservar decisiones y recuperar únicamente el contexto pertinente.

## Qué se lee y cuándo

| Archivo | Uso |
| --- | --- |
| AGENTS.md | Instrucciones comunes y política adaptativa |
| CLAUDE.md | Importación y particularidades de Claude |
| docs/CONTEXTO_PROYECTO.md | Mapa breve al iniciar una tarea |
| HISTORIAL.md | Buscar decisiones y entregas por tema |
| openspec/specs/ | Requisitos de la capacidad afectada |
| openspec/changes/ | Propuesta y tareas del cambio pertinente |
| Git | Comprobar versiones y cambios exactos |

## Rutina de trabajo

1. Leer contexto breve y localizar el área afectada.
2. Usar CodeGraph para dependencias y fuentes relevantes con maxFiles de 2 a 4; consultar directamente los archivos que el índice no cubra.
3. Aplicar la política de AGENTS: menor directo, moderado con plan breve, mayor/crítico con OpenSpec, respetando el proceso solicitado por el usuario.
4. Validar proporcionalmente, registrar resultados reales en el historial y actualizar el contexto solo si cambia el estado vigente.
5. Para otro chat, recuperar el resumen vigente y los pendientes necesarios; no pegar toda la conversación anterior.

## Herramientas

- OpenSpec: npm run spec -- <comando>, npm run spec:list, npm run spec:check.
- CodeGraph: npm run graph:status, npm run graph:sync, npm run graph -- explore "consulta" --max-files 3.
- La conexión MCP de Claude está en .mcp.json. Su índice .codegraph/ es generado y se reconstruye en cada equipo.
- Con el MCP ejecutándose, CodeGraph observa cambios. Ante avisos de desactualización, comprobar la fuente y sincronizar cuando corresponda.
- Usar las habilidades de OpenSpec presentes en .claude/skills/. No editarlas a mano; actualizar con el CLI cuando se decida renovar la integración.

## Límites

Guardar archivos no garantiza ahorrar tokens: el contenido cuenta cuando se carga o se consulta. Los imports de CLAUDE también se cargan.
La política adaptativa guía al asistente; no es un clasificador determinista.
Validar specs comprueba estructura, no demuestra que el código cumpla los escenarios.
No registrar credenciales ni datos personales. No atribuir al índice una cobertura que no se haya comprobado.
No hay un porcentaje de ahorro garantizado; compararlo con tareas equivalentes si se requiere medirlo.
```

## 8. Crear una primera spec pequeña y comprobable

Si no existen specs, no documentes todo el producto. Crea una capacidad real acotada o usa esta base de proceso en `openspec/specs/memoria-proyecto/spec.md`:

```markdown
# Memoria del proyecto

## Purpose

Conservar decisiones entre sesiones y recuperar contexto pertinente con un proceso proporcional al riesgo.

## Requirements

### Requirement: Contexto acotado

El asistente SHALL usar las instrucciones compartidas y el contexto breve, consultando historial y specs solo cuando sean pertinentes.

#### Scenario: Iniciar una corrección visual

- **WHEN** se solicita una corrección de estilo localizada y de bajo riesgo
- **THEN** se consulta el área afectada sin cargar todo el historial ni todas las specs.

### Requirement: Proceso adaptativo

El asistente SHALL aplicar la política de AGENTS.md por impacto y riesgo, respetando las instrucciones explícitas del usuario y las autorizaciones existentes.

#### Scenario: Descubrir una migración

- **WHEN** una tarea inicialmente menor requiere un cambio estructural de datos
- **THEN** se reevalúa el nivel y se preparan los artefactos necesarios antes de esa parte.

### Requirement: Registro verificable

El historial SHALL registrar cambios significativos con resultados y validaciones reales, sin secretos ni datos personales.

#### Scenario: Terminar la configuración

- **WHEN** se cierra la instalación de herramientas
- **THEN** se registran versiones, pruebas ejecutadas y activaciones pendientes sin inventar éxitos.
```

Para futuros cambios importantes, utilizar las habilidades instaladas de explorar/proponer/aplicar/sincronizar/archivar cuando correspondan. En Claude Code, comprobar los comandos disponibles en `/`; con la entrega habitual se presentan como `/opsx:...`. Las habilidades y los comandos de chat no se ejecutan pegándolos en PowerShell.

## 9. Validación de la entrega

### Terminal

```powershell
npm run spec -- --version
npm run graph -- --version
npm run spec:check
npm run spec:list
npm run graph:status
npm run graph -- explore "SIMBOLO_REAL_DEL_PROYECTO" --max-files 2
```

Sustituye `SIMBOLO_REAL_DEL_PROYECTO` por una función o clase encontrada en el código de destino. En VACACIONES se utilizó `diasVacaciones festivoEnFecha`; no uses esos nombres para validar otro proyecto.

### Dentro de Claude Code

1. Reinicia la sesión si se añadieron MCP o habilidades, entra al proyecto y revisa `/mcp`.
2. Comprueba la carga de AGENTS/CLAUDE y contexto con `/context` o `/memory`.
3. Ejecuta **la herramienta MCP** `codegraph_explore` sobre un símbolo real y con `maxFiles: 2`. Comprueba que devuelve código y ubicaciones pertinentes. Una consulta CLI correcta no demuestra por sí sola que Claude esté conectado.
4. Revisa permisos y pasos de interfaz pendientes. Si solo pudiste probar `initialize`, `tools/list` y `tools/call` desde un cliente de diagnóstico, indica esa distinción.
5. Revisa que las habilidades de OpenSpec estén disponibles. No actives un flujo completo para una corrección menor solo para demostrar su presencia.

### Documentación y conservación

- Revisar enlaces locales, JSON y YAML de los ejemplos aplicados; en Git, ejecutar `git diff --check`.
- Confirmar que no cambiaron código funcional, credenciales ni configuraciones ajenas a la instalación.
- Registrar comandos y resultados en HISTORIAL. Actualizar el contexto con el estado final.
- Si algo no pudo comprobarse por restricciones del entorno, describir la limitación; no desactivar controles de seguridad para aparentar éxito.

No ejecutar suites completas de la aplicación por una entrega exclusivamente documental. La validación del formato de instrucciones no garantiza que el asistente siempre clasifique bien las tareas.

## 10. Resultado que Claude debe entregar

Un resumen breve con versiones y archivos, conexión MCP real o pendiente, estado de specs e índice y cualquier acción necesaria para activar la sesión. Los archivos esperados son:

```text
proyecto/
├── package.json y lockfile del gestor utilizado
├── AGENTS.md
├── CLAUDE.md
├── HISTORIAL.md
├── codegraph.json
├── .mcp.json
├── .claude/
│   ├── settings.json             (si se acordaron permisos rutinarios)
│   └── skills/openspec-*/        (generadas por el CLI)
├── docs/
│   ├── CONTEXTO_PROYECTO.md
│   └── MEMORIA_Y_ESPECIFICACIONES.md
├── openspec/
│   ├── config.yaml
│   ├── specs/
│   └── changes/
└── .codegraph/                   (generado; ignorado por Git)
```

Si el proyecto también usa Codex, conservar sus instrucciones e integración existentes; OpenSpec puede generar sus habilidades seleccionando ambos asistentes. La configuración MCP de Codex en `.codex/config.toml` es independiente de la de Claude: no copiar rutas absolutas de otra computadora.

## 11. Mantenimiento

- Otra computadora con el mismo proyecto: instalar desde el lockfile, reconstruir el índice y comprobar conexión.
- Cambio significativo: registrar resultado y validación; mantener breve el contexto.
- Renovación de herramientas: decisión explícita de versión, revisión del diff del lockfile y de habilidades generadas, y nueva validación. Esta guía no programa actualizaciones automáticas.
- Instrucciones que se contradigan: resolverlas en la fuente compartida; no acumular excepciones repetidas en cada asistente.

## Fuentes

Comandos contrastados con la ayuda de las versiones locales indicadas. Documentación oficial consultada el 2026-10-19:

- [Claude Code: memoria, archivos de instrucciones e imports](https://code.claude.com/docs/en/memory).
- [Claude Code: servidores MCP y alcance de proyecto](https://code.claude.com/docs/en/mcp).
- [OpenSpec: CLI](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md).
- [OpenSpec: personalización](https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md).
- [CodeGraph: instalación, exclusiones, consultas y telemetría](https://github.com/colbymchenry/codegraph).
