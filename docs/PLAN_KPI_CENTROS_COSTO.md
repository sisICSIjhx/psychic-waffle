# Estatus y KPI por centro de costo: matriz, brechas y prompt

Redactado el 2026-11-20 a partir de la matriz «PARA LA PLATAFORMA DE REPORTES.xlsx» (fuera del
repositorio) y del estado del sistema en la rama `feat/kpi-seguimiento-centros`. Continúa
[el plan de seguimiento por centro de costo](PLAN_SEGUIMIENTO_CENTROS_COSTO.md) (etapas 0 a 5 ya
hechas). Las personas se nombran por rol.

## 1. Qué pide la matriz

Una fila por concepto y una columna por centro de costo (1 = aplica, 0 = no aplica). Todo lo que se
captura debe traducirse en **indicadores (KPI) para ver el estatus de cada centro de costo**. Quien
captura es personal operativo poco familiarizado con plataformas: la pantalla debe entenderse sin
manual y usarse bien en el teléfono.

### 1.1 Conceptos

| Bloque      | Concepto                                                                                                                                                            | Aplica a                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Contrato    | Contrato                                                                                                                                                            | Todos menos Vitromex 1, Vitromex 2 y Tremec                                       |
| Contrato    | Orden de compra (número o código)                                                                                                                                   | EM-30167, EM-30017, EM-30043, OMA MINA, OMA MINA MEDICIÓN                         |
| Contrato    | Periodicidad, monto del contrato, monto cobrado (lo llena contabilidad)                                                                                             | Todos                                                                             |
| Contrato    | Carta de finalización (obligatoria solo si el contrato terminó; después, alerta por correo), fecha de firma y enlace de SharePoint                                  | Todos                                                                             |
| Adicionales | Contrato madre, orden de compra, periodicidad (cuándo se solicitó y periodo de ejecución), monto pactado y monto cobrado                                            | Todos                                                                             |
| Adicionales | Atenciones de emergencia: fecha (obligatoria), personal que asistió (opcional) y horario                                                                            | Todos                                                                             |
| Programa    | Partidas (las del programa anual; donde no lo hay, se escriben) y actividades (veces que se ejecuta la partida en el mes)                                           | EM-30167, OMA MINA, EM-30184, EM-30185                                            |
| Programa    | EM programadas, EM realizadas y en cuáles se cobra; actividades programadas, ejecutadas y cobradas                                                                  | OMA MINA, OMA EDOMEX, OMA SALAMANCA, SCADA QUERÉTARO                              |
| Carpetas    | Carpeta de producción y carpeta de mantenimiento: cada una con su sección de reportes, ODT, AST, PT y su estado                                                     | EM-30167, Vipro, Yazbek                                                           |
| Carpetas    | Carpeta de seguridad                                                                                                                                                | OMA MINA, EM-30184, EM-30185                                                      |
| Carpetas    | Reporte **por partida** (no por actividad)                                                                                                                          | EM-30167, EM-30017, EM-30043, OMA MINA, OMA MINA MEDICIÓN, Proagro, Vipro, Yazbek |
| Carpetas    | Permisos                                                                                                                                                            | OMA MINA MEDICIÓN                                                                 |
| Carpetas    | ODM (orden de mantenimiento)                                                                                                                                        | OMA MINA, OMA EDOMEX, OMA SALAMANCA, SCADA QUERÉTARO                              |
| Carpetas    | ODT                                                                                                                                                                 | EM-30167, OMA MINA MEDICIÓN                                                       |
| Carpetas    | AST y PT                                                                                                                                                            | EM-30167, EM-30184, EM-30185                                                      |
| Carpetas    | Estado de la carpeta: **entregada** (quién la entregó, del personal) y **recibida** (con comentarios, o correctamente con el enlace o el acuse de recibido adjunto) | EM-30167, EM-30017, EM-30043, OMA MINA (representativo en las demás)              |
| Ingresos    | Estimación, prefactura, factura y cobrado                                                                                                                           | Todos                                                                             |

### 1.2 Notas por centro de costo

- **EM-30017 y EM-30043:** no tienen carpeta de producción ni de mantenimiento; solo reportes y
  carpeta. Falta definir cómo es la carpeta.
- **OMA MINA:** los reportes de mantenimiento llevan (no todos) generadores de obra, reporte
  fotográfico, carta de mantenimiento, histórico de mantenimiento, dictamen técnico, gráfica de la
  prueba y bitácora de mantenimiento.
- **OMA MINA MEDICIÓN:** cuántas EM se recolectan en Coatzacoalcos, Minatitlán e Impacto; reportes
  de medición y de mantenimiento.
- **EM-30179:** hojas de campo, bitácoras y una sola carpeta.
- **OMA EDOMEX, OMA SALAMANCA y SCADA QUERÉTARO:** reportes de mantenimiento, lista de asistencia y
  una sola carpeta. Falta confirmar con el responsable de OMA si hay programa anual o mensual.
- **EM-30184 y EM-30185:** hojas de verificación, reporte fotográfico, bitácoras; carpeta de
  seguridad y carpeta de reportes.
- **Vitromex 1 y 2:** reporte de mantenimiento y de medición. **Tremec:** reporte de medición.
- **Vipro y Yazbek:** una sola carpeta.

## 2. Brechas contra lo que ya existe

Ya existen: plantillas por centro (`plantillas_seguimiento`, `plantilla_conceptos`), seguimiento
mensual (`/seguimiento`), contrato, órdenes de compra, carta y cobranza (`/cobranza`) y el
concentrado con el avance ejecutado contra planeado (`/cumplimiento`). Falta:

| #   | Brecha                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **KPI de estatus.** El concentrado solo mide ejecución. Faltan documentos, carpetas, cobranza, contrato y emergencias, y un estatus general con «qué falta».                |
| B2  | **Conceptos sin significado.** Un concepto es solo una etiqueta: el sistema no sabe cuál es «monto del contrato» o «EM programadas». Sin eso no hay KPI.                    |
| B3  | **Adicionales.** Hoy son una casilla dentro de las órdenes de compra y solo en una plantilla; deben existir en todos los centros con sus cinco datos.                       |
| B4  | **Atenciones de emergencia.** Hoy «atenciones nocturnas» con fecha y descripción; faltan el horario y el personal que asistió.                                              |
| B5  | **Reporte por partida.** Hoy todos los documentos se marcan por actividad (cada ejecución).                                                                                 |
| B6  | **Estado de la carpeta.** Hoy pendiente, en preparación y entregada; faltan «recibida con comentarios» y «recibida correctamente» con acuse, y el contenido de la carpeta.  |
| B7  | **Partidas fuera del programa.** En centros con programa anual no se puede escribir una partida que el programa no trae.                                                    |
| B8  | **Plantillas incompletas** frente a la matriz (EM programadas y cobradas en OMA y SCADA, periodicidad, carpetas por definir…), y la carga en bloque no actualiza.           |
| B9  | **Móvil y claridad.** `/seguimiento` es una tabla ancha con formularios por celda; `/cobranza` y el concentrado tampoco están pensados para teléfono ni para alguien nuevo. |
| B10 | **Monto cobrado.** La matriz lo asigna a contabilidad; hoy es un campo del contrato que llena administración, aparte de la cobranza mensual.                                |

## 3. Decisiones de diseño

Detalle y requisitos en el cambio OpenSpec `kpi-estatus-centros`. En resumen:

1. **Indicador del concepto (B2).** `plantilla_conceptos.indicador` (opcional) dice qué mide el
   concepto: `monto_contrato`, `monto_cobrado`, `monto_facturado`, `periodicidad`,
   `em_programadas`, `em_realizadas`, `em_cobradas`, `actividad_cobrada`. La migración lo llena en
   las plantillas existentes por la etiqueta, y el editor de plantillas lo deja elegir.
2. **Por definir.** `plantilla_conceptos.por_definir`: el concepto se muestra con la insignia «Por
   definir», se puede llenar, y no cuenta en los KPI. Así se anexa de forma representativa lo que
   todavía no se sabe.
3. **Reporte por partida (B5).** Nuevo nivel `partida`: el concepto se captura una vez por partida
   en el mes y se guarda en la primera actividad de la partida. Las actividades viajan con su
   `grupo` (la partida) para que la pantalla las agrupe.
4. **Carpetas (B6).** Estados: pendiente → en preparación → entregada (quién entrega y fecha) →
   recibida con comentarios (comentarios) o recibida correctamente (quién recibe, fecha y acuse por
   enlace o archivo). Un documento puede pertenecer a una carpeta (`carpeta_id`); la carpeta muestra
   el avance de sus documentos en el mes.
5. **Adicionales (B3).** Tabla propia por centro de costo, igual para todos: orden de compra,
   descripción, fecha de solicitud, periodo de ejecución, monto pactado y monto cobrado. El contrato
   madre es el del centro. Administración llena el pactado; contabilidad, el cobrado.
6. **Atenciones de emergencia (B4).** Se renombra en la interfaz; lleva fecha, horario (inicio y
   fin, opcionales), personal que asistió (opcional, del directorio) y descripción opcional.
7. **Partidas escritas a mano (B7)** también en centros con programa anual, marcadas «Fuera del
   programa».
8. **Monto cobrado (B10).** Es la suma de la cobranza mensual, que llena contabilidad; lo cobrado
   de los adicionales se muestra aparte. El concepto «Monto cobrado» del contrato deja de
   capturarse a mano.
9. **KPI (B1).** Reglas puras en `src/lib/dominio/estatus.ts` sobre un resumen por centro y mes que
   entrega una sola función SQL. Montos solo con la capacidad `verContrato`, comprobada en el
   servidor.
10. **Plantillas (B8).** `npm run importar:centros -- --complementar` agrega los conceptos que
    falten y sus indicadores sin tocar los datos capturados; ensayo por omisión.

### 3.1 Indicadores del centro de costo

| KPI         | Cálculo (mes de corte, salvo que se indique)                                                        | Aplica si                           |
| ----------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Ejecución   | Actividades ejecutadas ÷ programadas (programa anual: acumulado del ciclo, como hoy)                | Hay actividades programadas         |
| EM          | EM realizadas ÷ EM programadas                                                                      | La plantilla tiene esos indicadores |
| Documentos  | Casillas marcadas ÷ esperadas (por actividad ejecutada, por partida con ejecución y por mes)        | Hay conceptos de documentos         |
| Carpetas    | Carpetas recibidas correctamente ÷ carpetas del mes; se muestran también las entregadas             | Hay carpetas                        |
| Cobranza    | Paso del mes (estimación → prefactura → factura → cobrado) y cobrado acumulado ÷ monto del contrato | Con `verContrato`                   |
| Cobro de EM | EM o actividades cobradas ÷ realizadas                                                              | La plantilla tiene esos indicadores |
| Contrato    | Datos obligatorios capturados; contrato vencido; carta de finalización faltante                     | Con `verContrato`                   |
| Emergencias | Número de atenciones del mes (informativo)                                                          | Siempre                             |

Estatus general: **Al corriente**, **Con pendientes**, **Atrasado** o **Sin datos**, con la lista
«Qué falta» en palabras del usuario («Faltan 3 reportes», «Carpeta de seguridad sin entregar»).

## 4. Pendientes que se anexan de forma representativa

| Pendiente                                                                                    | Cómo queda en el sistema                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Carpeta de EM-30017 y EM-30043: falta definir cómo es                                        | Concepto «Carpeta» por definir                                      |
| OMA EDOMEX, OMA SALAMANCA y SCADA: programa anual o mensual                                  | Captura mensual; EM programadas, realizadas y con cobro             |
| EM-30167: qué actividades van a producción y cuáles a mantenimiento                          | Las dos carpetas muestran los mismos documentos                     |
| Vipro: la matriz dice EM-11046 y el sistema tiene EM-13046                                   | No se cambia la clave; se pregunta al usuario                       |
| Yazbek y Vipro: carpetas de producción y mantenimiento, pero la nota dice «una sola carpeta» | Una carpeta; las otras dos, por definir                             |
| Alerta por correo de la carta de finalización                                                | Aviso en pantalla y en el estatus; el correo queda para la fase 2   |
| Montos, órdenes de compra y contratos reales                                                 | Los captura cada rol; no se cargan datos de ejemplo en la base real |

## 5. Prompt

Para una sesión que orquesta subagentes. Cada subagente recibe este documento y el expediente
`openspec/changes/kpi-estatus-centros/` como contexto.

```text
Vas a completar el seguimiento por centro de costo de ICSI Reportes para que cada centro tenga un
estatus con indicadores (KPI). Lee primero docs/PLAN_KPI_CENTROS_COSTO.md (matriz, brechas,
decisiones y pendientes) y openspec/changes/kpi-estatus-centros/ (propuesta, diseño, requisitos y
tareas); después AGENTS.md y docs/CONTEXTO_PROYECTO.md. Trabaja en la rama
feat/kpi-seguimiento-centros y no cambies de rama ni hagas push.

Para qué sirve: dirección quiere abrir la plataforma y saber, por centro de costo, si el trabajo
va al corriente: lo ejecutado contra lo programado, los documentos de cada partida, las carpetas
entregadas y recibidas, lo cobrado contra lo contratado, y qué falta. Quien lo alimenta es
personal operativo en campo, con el teléfono y sin costumbre de usar plataformas. Si una decisión
obliga a elegir entre mostrar más y que se entienda a la primera, gana que se entienda: una acción
principal por pantalla, palabras del oficio («Marcar ejecutada», «Entregar carpeta»), nada de
jerga del sistema, y siempre visible qué falta y qué sigue.

Cómo se reparte el trabajo:
- Base de datos y dominio: migración 0028 (con RLS, funciones api_* y supabase/esquema_completo.sql
  al día), repositorios, src/lib/dominio/estatus.ts y sus pruebas. Entrega primero, porque fija el
  contrato de datos de las pantallas.
- Interfaz de captura: /seguimiento y /cobranza. Agrupar por partida, tarjetas en teléfono, carpeta
  como pasos, atenciones de emergencia y adicionales.
- Interfaz de estatus: concentrado de /cumplimiento como tablero de KPI por centro y la ficha de
  estatus del centro.
- Revisión de código: correcciones de errores, seguridad (permisos y alcance por centro en el
  servidor) y pruebas.
- Usuario operativo: usa la aplicación en el navegador, en 375 px y en escritorio, sin leer el
  código ni la documentación, e intenta las tareas de la lista de aceptación. Reporta dónde dudó,
  qué no entendió y qué tardó; califica de 1 a 5 qué tan fácil es saber qué hacer sin manual.
- Mejora: atiende los hallazgos del revisor y del usuario operativo. Se repite el ciclo hasta que
  el usuario operativo califique 4 o más en cada tarea y no queden errores graves.

Reglas que no se negocian:
- El sistema de diseño es «Panel claro» (src/app.css: tokens semánticos, paneles de 14 px,
  insignias en píldora, Nunito Sans y Manrope). Usa sus tokens y componentes de
  src/lib/components/ui/; no inventes colores, sombras ni tipografías. Ambos temas, contraste AA.
- Svelte con la sintaxis heredada del archivo que edites; textos en español; formato Prettier del
  proyecto. Los formularios deben funcionar sin JavaScript (acciones de SvelteKit con enhance).
- Teléfono: desde 360 px sin desplazamiento horizontal de la página, objetivos táctiles de 44 px,
  tablas anchas convertidas en tarjetas, y la acción principal al alcance del pulgar.
- Permisos y alcance por centro se comprueban en el servidor. Montos, contrato y cobranza solo con
  la capacidad verContrato; lo que el rol no puede ver no viaja al navegador.
- La base de trabajo (storage/pglite) no se toca: prueba con «dev-prueba» de .claude/launch.json
  (puerto 5176, base aislada). PGlite no admite dos procesos sobre la misma base.
- Nada de nombres de personas, montos reales ni datos de la matriz en código, semillas, specs,
  historial ni commits; usa roles y datos de ejemplo.
- Lo que todavía no se sabe se anexa como «Por definir» (apartado 4), no se inventa.
- Valida con npm run check, npm run lint y npm run test lo que toques, y di qué ejecutaste de
  verdad y qué no. No hagas commit; el orquestador integra.

Tareas de aceptación del usuario operativo (rol reporteador o líder operativo, en teléfono):
1. Encontrar mi centro de costo y saber en diez segundos si va al corriente y qué falta.
2. Marcar como ejecutada una actividad de hoy y sus documentos.
3. Marcar el reporte de una partida.
4. Escribir una partida que no está en el programa y marcarla.
5. Registrar una atención de emergencia con fecha, horario y quién asistió.
6. Entregar una carpeta y, después, registrarla como recibida con comentarios y como recibida
   correctamente con su acuse.
Con rol de administración o contabilidad, en escritorio:
7. Registrar un adicional con su orden de compra y, como contabilidad, lo cobrado.
8. Llenar la cobranza de un mes y ver cómo cambia el estatus del centro.
9. Ver el tablero de todos los centros y abrir el que esté más atrasado.
```
