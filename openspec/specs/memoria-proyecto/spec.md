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
