# Spec Delta

## ADDED Requirements

### Requirement: Script único de creación

El proyecto SHALL generar con `npm run bd:script` el archivo `supabase/esquema_completo.sql`, que
crea en una base vacía todo el esquema (tablas, funciones, seguridad por filas y registro de
migraciones) en una sola transacción. SHALL existir una prueba que falle si el archivo no corresponde
a las migraciones actuales.

#### Scenario: Base vacía

- **WHEN** se ejecuta `supabase/esquema_completo.sql` en una base PostgreSQL vacía
- **THEN** quedan creadas todas las tablas y funciones `api_*`, con RLS habilitado en cada tabla

#### Scenario: Migración nueva sin regenerar

- **WHEN** se agrega una migración y no se vuelve a generar el script
- **THEN** la prueba del script falla e indica ejecutar `npm run bd:script`

### Requirement: Fotos con URL de SharePoint

Cada foto SHALL indicar su almacenamiento (`local` o `sharepoint`). Las de SharePoint SHALL guardar
solo la URL del original y de la versión optimizada; las locales, sus rutas.

#### Scenario: Foto en SharePoint

- **WHEN** se registra una foto con almacenamiento `sharepoint` y sus dos URL, sin rutas locales
- **THEN** se acepta y el reporte la devuelve con sus URL

#### Scenario: Foto de SharePoint sin URL

- **WHEN** se registra una foto con almacenamiento `sharepoint` sin URL
- **THEN** se rechaza
