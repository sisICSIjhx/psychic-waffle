## 1. Datos

- [x] 1.1 Crear la migración 0029 (`programa_marca_personal` y `personalIds` en `api_marcar_ejecutado`) y regenerar el esquema.
- [x] 1.2 Repositorio: `marcarEjecutado` con personas.

## 2. Servidor

- [x] 2.1 Validación pura de la captura en `dominio/actividades.ts`.
- [x] 2.2 Ruta `/actividades` (`GET` y `POST`) con alcance y la regla de acceso `capturar`.

## 3. Interfaz

- [x] 3.1 Menú «Capturar» en la barra superior con «Actividad» y «Reporte».
- [x] 3.2 Ventana «Capturar actividad» con centro, actividad con búsqueda, Sí/No, fecha y personas; enlace a seguimiento sin programa.

## 4. Validación

- [x] 4.1 Pruebas: dominio, ruta sobre PGlite (Sí, No, sin fecha, nada pendiente, alcance y permisos), barra y ventana.
- [x] 4.2 Comprobar en el navegador con la base de prueba.
- [x] 4.3 Registrar en el historial y el contexto; la 0029 se aplica en la base de trabajo al reiniciar el servidor.
