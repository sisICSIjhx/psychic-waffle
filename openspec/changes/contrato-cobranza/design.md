## Diseño

- **D1. Ruta propia.** `/cobranza` selecciona centro de costo y año y conserva ambos en la URL. Va
  aparte de `/seguimiento` porque la guardia asigna una capacidad por prefijo y contabilidad no
  edita el seguimiento operativo. La guardia solo exige sesión a sus modificaciones; cada operación
  comprueba su capacidad en la acción.
- **D2. Capacidades.** `verContrato` (administrador, líder administrativo, mesa directiva y
  contabilidad): contrato, montos, órdenes, carta y cobranza. `editarContrato` (administrador y
  líder administrativo): contrato, órdenes, carta y enlace del programa. `verEnlacePrograma`
  (administrador, ambos líderes y mesa directiva). `editarCobranza` (administrador y contabilidad).
  El alcance por centro de costo de la etapa 2 se aplica igual: un centro ajeno responde 404.
- **D3. Exigen sesión.** Estas cuatro capacidades no se conceden mientras el inicio de sesión no
  esté activado (`CAPACIDADES_CON_SESION`): a diferencia del resto de la aplicación, contrato y
  cobranza nunca quedan abiertos.
- **D4. Lo no visible no se consulta.** `api_obtener_contrato_cobranza` recibe del servidor qué
  puede ver quien consulta y omite del resultado el enlace del programa o todo lo del contrato. La
  página no recibe datos que luego oculte.
- **D5. Contrato y órdenes siguen la plantilla.** Los valores se guardan por concepto
  (`contrato_valores` por centro; `ordenes_compra` con `orden_compra_valores`), con los tipos de la
  etapa 2. «Adicional», fecha de solicitud y montos de una orden son conceptos de la plantilla, no
  columnas. Los datos del contrato van por centro de costo y no por contrato del catálogo, porque
  hay centros sin contrato que llevan periodicidad y montos. Un concepto con valores no puede
  cambiar de tipo, bloque ni nivel.
- **D6. Enlaces.** Contrato, programa anual y carta se guardan solo como enlace HTTPS de
  SharePoint, validado en el servidor y en la base. No se admiten archivos.
- **D7. Montos.** Números no negativos con dos decimales (`numeric(14,2)` en la cobranza). El total
  cobrado del año se calcula al mostrarlo; el «monto cobrado» del contrato sigue siendo captura
  manual hasta la etapa 6.
- **D8. Carta de finalización.** Fecha y enlace por centro; el enlace requiere la fecha. Falta
  cuando la mayor vigencia final de los contratos del centro en el catálogo es anterior a hoy (zona
  de negocio) y no hay fecha de carta. Un centro sin contrato en el catálogo no genera aviso.
- **D9. Cobranza.** Una fila por centro y mes con cuatro casillas y el monto cobrado. La tabla del
  año se guarda en una operación; un mes sin datos no deja fila.
