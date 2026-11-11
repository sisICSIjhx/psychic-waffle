# Seguimiento por centro de costo: solicitud, plan y prompt

Redactado el 2026-11-10 a partir de la solicitud de dirección, del Excel de seguimiento anterior
(«00 admon.xlsx», fuera del repositorio) y del estado actual del sistema. Las personas se nombran
por rol; la asignación de cada rol se hace en `/personal`.

## 1. Decisiones ya tomadas

| Tema            | Decisión                                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centro de costo | Se fusionan los niveles: la interfaz deja de mostrar «Cliente» y «Sitio»; quedan **Contrato** y **Centro de costo** (el sitio actual).                                                                                                                    |
| Accesos         | El inicio de sesión con roles entra en la fase 1, antes de cargar contratos y montos. Es propio del sistema: correo y contraseña; el administrador da de alta a la persona en Personal y le genera una contraseña temporal. Microsoft queda para después. |
| Detalle         | El seguimiento documental se marca **por actividad** (cada ejecución de una partida lleva sus casillas). La cobranza va **por mes**.                                                                                                                      |
| Histórico       | No se importa el Excel: se captura desde cero a partir del mes en curso. El Excel solo sirve de referencia para saber qué conceptos existían.                                                                                                             |
| Fases           | Fase 1: todo es llenado manual o marcar «hecho». Fase 2: lo que el sistema ya sabe (reportes emitidos, ejecuciones) se marca solo.                                                                                                                        |

## 2. Solicitud redactada

### 2.1 Objetivo

Sustituir el Excel de seguimiento por un módulo del sistema donde, para cada centro de costo, se vea
y se llene en un solo lugar: los datos del contrato y de sus órdenes de compra, lo programado contra
lo ejecutado, los documentos de cada actividad, el estado de las carpetas y la cobranza. La fase 1
debe quedar en uso lo antes posible, aunque todo sea captura manual.

### 2.2 Cambios generales

1. **Nombre.** Donde la interfaz dice «Cliente» o «Sitio» debe decir «Centro de costo». Filtros,
   tablas, catálogo, captura, historial, equipos y personal usan solo Contrato y Centro de costo.
2. **Tabla de cumplimiento.** La tabla «Por contrato y sitio» pasa a llamarse «Por contrato y centro
   de costo» y separa la columna única en dos: **Contrato** y **Centro de costo**. Cuando un
   contrato tiene varios centros de costo, la celda del contrato se combina (una sola celda que
   abarca sus filas) en lugar de repetirse.
3. **Centros de costo nuevos.** Dar de alta, además de los que ya existen (EM-30167 Cerritos,
   EM-30184 y EM-30185 Proagro):

   | Clave             | Nombre               | Se configura como                             |
   | ----------------- | -------------------- | --------------------------------------------- |
   | EM-30179          | Virtual Pipelines    | Propio (ya existe cliente)                    |
   | OMA MINA          | OMA Mina             | Propio                                        |
   | OMA MINA MEDICIÓN | OMA Mina Medición    | Propio                                        |
   | EM-30017          | —                    | Propio: por ahora solo la casilla del reporte |
   | EM-30043          | —                    | Igual que EM-30017                            |
   | OMA EDOMEX        | OMA Estado de México | Propio                                        |
   | OMA SALAMANCA     | OMA Salamanca        | Igual que OMA EDOMEX                          |
   | SCADA QUERÉTARO   | SCADA Querétaro      | Igual que OMA EDOMEX                          |
   | EM-11027          | Vitromex 1           | Propio                                        |
   | EM-11035          | Vitromex 2           | Igual que Vitromex 1                          |
   | EM-11025          | Yazbek               | Igual que Vitromex 1                          |
   | EM-22018          | Tremec               | Propio                                        |
   | EM-13046          | Vipro                | Propio                                        |

   Las hojas «30106», «Las Matas» y «OMA Mina Impacto» del Excel no se dan de alta.

4. **Concentrado de centros de costo.** Una lista de todos los centros de costo con el porcentaje de
   lo ejecutado contra lo planeado, como entrada al detalle de cada uno.
5. **Captura fácil.** Marcar si una actividad se ejecutó, y sus documentos, debe tomar un clic por
   casilla, con acciones para marcar una fila o un mes completo.
6. **Atenciones nocturnas (de emergencia).** Se registran en todos los centros de costo.

### 2.3 Accesos

| Información                             | Quién la ve                                                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato (enlace al documento) y montos | Administrador, líder administrativo (el «semiadministrador»), mesa directiva y contabilidad.                                                              |
| Programa anual (enlace de SharePoint)   | Líderes del centro de costo, administrador, líder administrativo y mesa directiva.                                                                        |
| Cobranza (estimación a cobrado)         | La llena contabilidad, y es lo único que llena: estimación, prefactura, factura, si se cobró y el monto cobrado. La ven los mismos roles que el contrato. |
| Seguimiento operativo y concentrado     | Todos los roles con acceso al centro de costo.                                                                                                            |

El contrato y el programa anual se guardan como **enlace** (SharePoint), no como archivo. La carpeta
admite el enlace de SharePoint o el archivo subido.

Roles: a los cuatro que ya existen (administrador, líder administrativo, líder operativo y
reporteador) se suman **mesa directiva** (consulta todo, no edita) y **contabilidad** (cobranza de
todos los centros de costo). Ninguno de los dos necesita proyectos asignados.

### 2.4 Bloques de información

Cada centro de costo activa solo los bloques y conceptos que le aplican (apartado 2.5).

- **A. Contrato.** Número y enlace del contrato (si existe), periodicidad, monto del contrato
  (total o pactado) y monto cobrado.
- **B. Órdenes de compra.** Número, periodo en que se ejecuta, monto. Una orden puede ser
  **adicional**: cuelga del mismo contrato y lleva además la fecha en que se solicitó, el periodo
  de ejecución, el monto pactado y el cobrado.
- **C. Carta de finalización.** Fecha y enlace. No es obligatoria con el contrato vigente; cuando
  el contrato termina y falta la carta, el sistema muestra una alerta.
- **D. Programa y actividades.** Partidas (lo que dicta el programa) y actividades (las veces que
  se ejecuta una partida en el mes): programadas, ejecutadas y, donde aplique, cobradas.
- **E. Documentos por actividad.** Casillas de «hecho» por cada ejecución: ODT u ODM, AST, PT o
  permisos, hojas de verificación o de campo, lista de asistencia, reportes y bitácoras, según el
  centro de costo.
- **F. Carpetas.** Una o varias por periodo (producción, mantenimiento, seguridad, reportes). De
  cada una se registra la entrega: quién entrega (se elige del personal), el nombre de quien
  recibe, la fecha de entrega y el enlace de SharePoint o el archivo.
- **G. Cobranza.** Estimación, prefactura, factura, si se cobró y el monto cobrado, por mes.

### 2.5 Qué aplica a cada centro de costo

| Centro de costo                            | A. Contrato                                                                    | B. Órdenes de compra              | D. Programa                                                                                                                                 | E. Documentos por actividad                                                                                                                                                              | F. Carpetas                            |
| ------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| EM-30167 Cerritos                          | Contrato, monto total, cobrado                                                 | Sí, con periodicidad; adicionales | Partidas y actividades del programa anual                                                                                                   | Reporte, ODT, AST, PT                                                                                                                                                                    | Producción y mantenimiento, con estado |
| EM-30017 y EM-30043                        | Contrato, monto, cobrado                                                       | Opcional                          | —                                                                                                                                           | Reporte: una casilla con «en proceso» y «hecho» (aún no se define cómo se hace el reporte)                                                                                               | No hay                                 |
| OMA MINA                                   | Contrato, periodicidad, monto, cobrado                                         | Sí, con periodo de ejecución      | EM programadas, realizadas y con cobro; actividades programadas, ejecutadas y cobradas                                                      | ODM; reportes de mantenimiento, generadores de obra, fotográfico, carta de mantenimiento, histórico de mantenimiento, dictamen técnico y gráfica de la prueba; bitácora de mantenimiento | Seguridad                              |
| OMA MINA MEDICIÓN                          | Contrato, periodicidad, monto, cobrado                                         | Sí, con periodo de ejecución      | EM recolectadas por lado: Coatza, Mina e Impacto                                                                                            | ODT, permisos, reportes de mantenimiento                                                                                                                                                 | —                                      |
| EM-30179 Virtual                           | Contrato, periodicidad, monto, cobrado                                         | No                                | Como Cerritos                                                                                                                               | Hojas de campo, bitácoras                                                                                                                                                                | Una sola                               |
| OMA EDOMEX, OMA SALAMANCA, SCADA QUERÉTARO | Contrato, periodicidad, monto pactado, cobrado                                 | No                                | EM que se ejecutan; actividades programadas por mes (pueden cambiar) y ejecutadas. Aún no se sabe si hay programa anual: se captura por mes | ODM, lista de asistencia, reportes de mantenimiento                                                                                                                                      | Una sola                               |
| EM-30184 y EM-30185 Proagro                | Contrato, periodicidad, monto, cobrado                                         | No hay                            | Actividades programadas y ejecutadas (programa anual)                                                                                       | AST, PT, hojas de verificación; reportes técnico y fotográfico; bitácoras                                                                                                                | Seguridad y reportes                   |
| EM-11027, EM-11035 y EM-11025              | Contrato opcional (parece que no tienen); periodicidad, monto pactado, cobrado | No                                | —                                                                                                                                           | Reporte de mantenimiento y de medición                                                                                                                                                   | Sí                                     |
| EM-22018 Tremec                            | Sin contrato; periodicidad, monto, cobrado                                     | No hay                            | —                                                                                                                                           | Reporte de medición                                                                                                                                                                      | —                                      |
| EM-13046 Vipro                             | Contrato, periodicidad, monto, **facturado**                                   | No                                | —                                                                                                                                           | Reporte                                                                                                                                                                                  | Sí                                     |

La carta de finalización (C), la cobranza (G) y las atenciones nocturnas aplican a todos.

### 2.6 Fase 2 (después)

- Un reporte emitido en el sistema marca solo su casilla de «Reporte» en la actividad.
- Las ejecuciones registradas en la planeación alimentan «programadas» y «ejecutadas».
- Alertas automáticas (carta de finalización, carpetas sin entregar, estimaciones sin cobrar).
- Enlaces resueltos contra SharePoint en lugar de pegarse a mano.

## 3. Plan de ejecución

Cada etapa es un cambio propio (rama y, donde se indica, expediente OpenSpec) y deja el sistema
utilizable. El orden atiende a que los montos no deben cargarse antes de tener accesos.

| Etapa | Qué entrega                                                                                                                                                                                                                                                        | Nivel | Depende de |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------- |
| 0     | **Nombres y tabla.** «Centro de costo» en toda la interfaz (filtros, catálogo, captura, historial, equipos, personal); tabla de cumplimiento con columnas separadas y contrato combinado. Sin cambio de datos.                                                     | 1–2   | —          |
| 1     | **Inicio de sesión y roles.** Cuentas propias con correo y contraseña, sesiones en la base (funciona con PGlite y con Supabase), roles actuales más «mesa directiva» y «contabilidad», permisos por rol y por proyecto, carga del personal y `/perfil` en el menú. | 3     | —          |
| 2     | **Alta de centros de costo.** Los doce nuevos con su contrato (o «sin contrato»), y la plantilla de seguimiento de cada uno (qué bloques y conceptos le aplican, apartado 2.5).                                                                                    | 3     | 0          |
| 3     | **Seguimiento operativo.** Actividades del mes por centro de costo (del programa anual donde existe; capturadas por mes donde no), casillas por actividad, marcado por fila y por mes, atenciones nocturnas y carpetas con estado.                                 | 3     | 2          |
| 4     | **Contrato y cobranza.** Enlaces del contrato y del programa, órdenes de compra y adicionales, montos, carta de finalización con alerta, estimación a cobrado. Visible solo para los roles autorizados.                                                            | 3     | 1 y 2      |
| 5     | **Concentrado.** Lista de centros de costo con porcentaje ejecutado contra planeado y accesos al detalle; integra el tablero de cumplimiento actual.                                                                                                               | 2     | 3          |
| 6     | **Fase 2.** Automatizaciones del apartado 2.6.                                                                                                                                                                                                                     | 3     | 3 y 4      |

Estado al 2026-11-11: etapas 0 a 5 implementadas. La etapa 3 está en la rama
`codex/seguimiento-operativo`, con la pantalla `/seguimiento` y la migración 0024 aplicada en la
base local de trabajo. La etapa 4 (cambio `contrato-cobranza`, migración 0025, rama
`feat/contrato-cobranza`) dejó la pantalla `/cobranza` con contrato, órdenes de compra, carta de
finalización, enlace del programa anual y cobranza mensual, con la 0025 aplicada en la base local
de trabajo. La etapa 5 (cambio directo, rama `feat/concentrado-centros`) puso el concentrado de
centros de costo al inicio de `/cumplimiento`. Sigue la etapa 6, las automatizaciones de la fase 2.
La etapa 1 (cambio OpenSpec `inicio-sesion-roles`)
dejó el inicio de sesión y los permisos por rol. La etapa 2 (cambio `centros-costo-plantillas`,
migración 0023) dejó las plantillas de seguimiento, los centros de costo sin contrato, el personal
asignado por centro de costo y el filtrado de los datos por centro de costo; los doce centros
nuevos y sus diez plantillas ya están cargados en la base de trabajo (archivo en
`insumos/centros-costo/`). En las plantillas cargadas, los centros sin programa (EM-30017, EM-30043,
Vitromex, Yazbek, Tremec y Vipro) llevan sus casillas por mes en el bloque «programa», porque sin
actividades no hay dónde marcar documentos por actividad.

Notas de diseño para las etapas 2 a 4:

- La etapa 2 permite asignar al personal sus centros de costo. El seguimiento y la descarga de
  carpetas usan ese mismo alcance.
- La fusión Cliente/Sitio es de interfaz. En los datos, el cliente sigue siendo la razón social del
  contrato (el DOCX la usa); no se elimina la tabla.
- La plantilla de seguimiento es **configuración por centro de costo**, no código por centro: una
  lista de conceptos con su bloque, tipo (casilla, cantidad, monto, enlace, fecha) y nivel
  (contrato, orden de compra, periodo o actividad). Así «igual que OMA EDOMEX» es copiar una
  plantilla.
- Ninguna etapa depende ya del proyecto de Supabase: la autenticación es propia y sus tablas viajan
  en las migraciones.
- Migraciones nuevas a partir de la 0022, con RLS y funciones `api_*`; `npm run bd:script` al día.

## 4. Prompt

Para pegar en una sesión nueva. Cubre la fase 1; la etapa 0 puede pedirse sola con el primer
bloque.

```text
Vamos a sustituir el Excel de seguimiento administrativo por un módulo de «Seguimiento por centro
de costo» en ICSI Reportes. Lee docs/PLAN_SEGUIMIENTO_CENTROS_COSTO.md completo antes de empezar:
ahí están las decisiones tomadas, los bloques de información, qué aplica a cada centro de costo y
el orden de las etapas. Lo que sigue es el contexto que el documento no puede darte y lo que espero
de cada etapa.

Por qué se hace: dirección lleva hoy el control de cada centro de costo en un Excel con una hoja
por centro y una columna por mes. Quieren dejar de usarlo cuanto antes, así que la fase 1 es solo
captura manual y casillas de «hecho»; la automatización es la fase 2 y no debe adelantarse. Si una
decisión de diseño obliga a elegir entre salir antes y dejar algo más automático, gana salir antes,
siempre que el modelo de datos no cierre el camino a la fase 2.

Trabaja por etapas, una rama y un cambio por etapa, en este orden: 0 (nombres y tabla de
cumplimiento), 1 (inicio de sesión y roles), 2 (alta de centros de costo y plantillas), 3
(seguimiento operativo), 4 (contrato y cobranza) y 5 (concentrado). La etapa 0 es un cambio directo;
de la 1 a la 4 usa OpenSpec con propuesta, requisitos y tareas. Al terminar cada etapa detente y
enséñame el resultado antes de empezar la siguiente.

Etapa 0. En toda la interfaz, «Cliente» y «Sitio» pasan a ser «Centro de costo» y los filtros
quedan en Contrato y Centro de costo; es un cambio de interfaz, los datos conservan al cliente como
razón social del contrato porque el DOCX la usa. En /cumplimiento, la tabla «Por contrato y sitio»
se titula «Por contrato y centro de costo», con dos columnas separadas y la celda del contrato
combinada cuando tiene varios centros de costo (hoy es una sola columna en
src/lib/components/cumplimiento/TablaCumplimiento.svelte). Conserva subtotales, total y el enlace a
la planeación.

Etapa 1. El sistema no tiene autenticación y sin ella no se pueden cargar contratos ni montos. Las
cuentas son propias: correo y contraseña, con la persona dada de alta en Personal y una contraseña
temporal que genera el administrador; no uses Supabase Auth ni Microsoft, pero no cierres el camino
a añadir Microsoft después. Los roles actuales están en el módulo de personal y los permisos en
src/lib/server/permisos.ts; hacen falta dos roles nuevos, mesa directiva (consulta todo) y
contabilidad (solo cobranza). Los accesos que deben cumplirse están en el apartado 2.3 del
documento. Todo debe funcionar igual con PGlite y con Supabase.

Etapas 2 y 3. Lo importante es que el seguimiento sea configuración y no código por centro de
costo: cada centro tiene una plantilla con los conceptos que le aplican, y varios comparten
plantilla. El detalle es por actividad: cada ejecución de una partida lleva sus casillas (ODT, AST,
PT, reporte…). Donde ya hay programa anual en el sistema (Cerritos, Proagro) las actividades salen
de ahí; donde no lo hay, se capturan las programadas de cada mes. Como marcar actividad por
actividad es mucha captura, la pantalla debe permitir marcar una fila completa y un mes completo
con una sola acción, y un clic por casilla. No se importa nada del Excel: se empieza desde el mes
en curso.

Etapa 4. Contrato y programa anual se guardan como enlace de SharePoint, nunca como archivo (la
carpeta de la etapa 3 sí admite enlace o archivo). La cobranza va por mes y solo la llena
contabilidad. La
carta de finalización solo es obligatoria cuando el contrato ya terminó; en ese caso, si falta,
muestra una alerta. Nada de esta etapa debe ser visible sin sesión ni para roles no autorizados, y
eso se comprueba en el servidor, no ocultando elementos.

Etapa 5. El concentrado lista los centros de costo con su porcentaje ejecutado contra planeado y
reutiliza el cálculo de src/lib/dominio/cumplimiento.ts en lugar de duplicarlo.

Lo que sigue abierto está en el apartado 5 del documento (la forma del reporte de EM-30017 y
EM-30043 y el programa de OMA EDOMEX): no lo resuelvas por tu cuenta, pregúntame al llegar a ese
punto y mientras tanto avanza con lo demás.

No escribas nombres de personas, montos reales ni datos del Excel en código, semillas, specs,
historial ni commits; usa roles y datos de ejemplo. Valida cada etapa con npm run check, npm run
lint y npm run test, y comprueba en el navegador las pantallas que cambies. Al cerrar cada etapa
dime qué quedó hecho, qué verificaste y cómo, y qué queda pendiente.
```

## 5. Respuestas y lo que sigue abierto

Respondido el 2026-11-10:

1. **EM-13046 Vipro** se da de alta; lleva «monto facturado».
2. **30106, Las Matas y OMA Mina Impacto** no se añaden.
3. **EM-30017 y EM-30043:** por ahora solo una casilla para marcar que el reporte se está haciendo
   o ya se hizo.
4. **Carpeta:** quien entrega se elige del personal; de quien recibe se escribe el nombre; lleva
   la fecha de entrega y el enlace de SharePoint o el archivo subido.
5. **Cobranza:** va por mes.
6. **Roles:** el «semiadministrador» es el líder administrativo. Contabilidad es un rol aparte que
   solo llena estimación, prefactura, factura, si se cobró y el monto cobrado.
7. **Vitromex 1, Vitromex 2 y Yazbek:** llevan el apartado del contrato, sin que sea obligatorio.
8. **Personal:** el usuario entregó la lista (nombre, sede y correo). Se carga en `/personal` con
   `npm run importar:personal`; el archivo queda en `insumos/`, fuera de lo versionable.
9. **Etapa 3:** confirmado que OMA EDOMEX sigue con captura mensual y EM-30017 y EM-30043
   mantienen el estado de reporte por mes.

Decidido al implementar la etapa 4, por confirmar:

1. **Quién llena el contrato:** administrador y líder administrativo llenan contrato, órdenes de
   compra, carta de finalización y enlace del programa anual. Mesa directiva solo consulta.
2. **Cobranza:** estimación, prefactura y factura son casillas de «hecho»; el monto cobrado es el
   único importe del mes.
3. **Carta de finalización:** falta cuando el contrato del catálogo ya terminó y no tiene fecha de
   carta; un centro sin contrato en el catálogo no genera aviso.

Sigue abierto:

1. **OMA EDOMEX:** falta saber si existe un programa anual. Se usa la captura por mes.
2. **EM-30017 y EM-30043:** queda por definir la elaboración de su reporte. El seguimiento
   registra su estado mensual.
3. **Rol y proyectos de cada persona:** la lista no los trae; se asignan en `/personal` antes de
   generar cada contraseña.
