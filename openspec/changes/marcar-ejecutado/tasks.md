## 1. Datos

- [x] 1.1 Crear la migración 0026 (origen `marca`, fecha, absorción en `v_realizado` y funciones) y regenerar el esquema.
- [x] 1.2 Conectar el repositorio y las acciones `marcarEjecutado` y `desmarcarEjecutado`.

## 2. Interfaz

- [x] 2.1 Diálogo «Marcar ejecutado» y botón «Desmarcar ejecutado» en el panel de la celda.
- [x] 2.2 Tono «Ejecutado sin reporte» en las dos filas de la tarjeta y en la leyenda (ambos diseños y temas).

## 3. Validación

- [x] 3.1 Pruebas sobre PGlite: absorción, límite de cantidad, fecha fuera del mes y desmarcar (el mes futuro lo rechaza la acción y se comprobó en el navegador).
- [x] 3.2 Comprobar la pantalla en el navegador con la base de prueba.
- [x] 3.3 Registrar en el historial; la 0026 se aplica sola en la base de trabajo al reiniciar el servidor.

## 4. Ajuste

- [x] 4.1 Fecha de ejecución obligatoria en el diálogo, la acción y la base (migración 0027).
