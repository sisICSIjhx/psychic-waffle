# Spec Delta

## ADDED Requirements

### Requirement: Biblioteca de alcances por proyecto

El catálogo SHALL ofrecer en `/catalogo/alcances` una biblioteca de alcances predeterminados por
proyecto (cliente), con tipo (alcance, nota o norma), grupo opcional, texto y estado activo. SHALL
rechazar un texto vacío y un renglón con el mismo texto y tipo que otro del mismo proyecto.

#### Scenario: Alta de un alcance

- **WHEN** se agrega «Verificar la calibración del manómetro» como alcance del proyecto Cerritos
- **THEN** aparece en la biblioteca de Cerritos, activo y al final de su grupo

#### Scenario: Duplicado

- **WHEN** se agrega en Cerritos un alcance con el mismo texto y tipo que otro existente, aunque cambien los acentos o los espacios
- **THEN** se rechaza con el mensaje «Ya existe ese alcance en el proyecto»

#### Scenario: Desactivar

- **WHEN** se desactiva un alcance predeterminado
- **THEN** sigue en la biblioteca marcado como inactivo y deja de ofrecerse en las partidas

### Requirement: Agregar predeterminados a una partida

El editor de partida SHALL permitir elegir alcances activos del proyecto del contrato y agregarlos
al final de los alcances de la partida como copia de texto, sin repetir los que ya tenga con el mismo
texto y tipo.

#### Scenario: Agregar dos alcances

- **WHEN** en una partida de Cerritos se eligen dos predeterminados y se confirma
- **THEN** ambos se agregan al final de la lista y se guardan al guardar la partida

#### Scenario: Cambio posterior en la biblioteca

- **WHEN** se edita el texto de un predeterminado ya agregado a una partida
- **THEN** la partida conserva el texto que tenía
