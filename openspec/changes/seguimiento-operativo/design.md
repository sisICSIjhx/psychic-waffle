## Diseño

- `/seguimiento` selecciona centro y mes. Usa la zona de negocio para el mes inicial y conserva
  ambos filtros en la URL.
- Una actividad anual se identifica por programa, partida y ordinal en el mes. Cada cantidad
  programada positiva se desglosa en unidades, incluyendo una fila por la fracción restante.
  Las filas sin captura se consultan desde el programa. Si deja de existir una fila con captura,
  se conserva con la indicación de que salió del programa. Los cambios del programa y del reporte
  no escriben marcas de seguimiento.
- Al primer guardado se conserva la plantilla y el origen del mes. Los datos por concepto se
  vinculan a identificadores de la plantilla. Un concepto con datos admite cambios de etiqueta
  y orden. Su eliminación o reinterpretación requiere atender primero esos datos.
- El guardado en bloque calcula en SQL los destinos del centro y mes y escribe en una transacción.
  El marcado individual fija un valor, sin invertir el valor que encuentre en la base.
- Los enlaces de carpeta se guardan como HTTPS de SharePoint. El archivo se guarda junto con la
  entrega en la base, con un máximo de 8 MiB. La consulta del mes solo devuelve su nombre. La
  descarga autenticada usa una respuesta privada como adjunto. La versión de la entrega detecta
  actualizaciones concurrentes de sus datos o archivo.
- La guardia controla la capacidad de escritura y la ruta verifica el centro solicitado en cada
  lectura, acción y descarga. La selección de quien entrega usa el directorio activo con id y
  nombre, y la consulta de entregas conserva el nombre de quien figure aunque ya esté inactivo.
- OMA EDOMEX y las plantillas mensuales usan captura manual. EM-30017 y EM-30043 conservan el
  control mensual de reporte con estados pendiente, en proceso y hecho.
