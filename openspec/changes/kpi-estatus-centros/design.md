## Contexto

Parte de `docs/PLAN_KPI_CENTROS_COSTO.md` (matriz, brechas B1 a B10 y pendientes). El modelo actual:
`plantilla_conceptos` (bloque, tipo, nivel), `seguimiento_meses`, `seguimiento_actividades`,
`seguimiento_valores`, `seguimiento_nocturnas`, `seguimiento_carpetas` (0024) y
`seguimiento_centros`, `contrato_valores`, `ordenes_compra`, `cobranza_meses` (0025).

## Decisiones

### D1. Indicador, por definir y carpeta del concepto

`plantilla_conceptos` gana tres columnas:

- `indicador text` (nulo = sin significado), único por plantilla. Valores y dónde son válidos:

  | Indicador           | Bloque   | Tipo     | Nivel     |
  | ------------------- | -------- | -------- | --------- |
  | `monto_contrato`    | contrato | monto    | contrato  |
  | `monto_cobrado`     | contrato | monto    | contrato  |
  | `monto_facturado`   | contrato | monto    | contrato  |
  | `periodicidad`      | contrato | texto    | contrato  |
  | `em_programadas`    | programa | cantidad | periodo   |
  | `em_realizadas`     | programa | cantidad | periodo   |
  | `em_cobradas`       | programa | cantidad | periodo   |
  | `actividad_cobrada` | programa | casilla  | actividad |

  La migración lo asigna a los conceptos existentes por su etiqueta normalizada («Monto», «Monto
  total» y «Monto pactado» → `monto_contrato`; «Monto cobrado»; «Monto facturado»; «Periodicidad»;
  «EM programadas»; «EM realizadas» y «EM ejecutadas» → `em_realizadas`; «EM con cobro» →
  `em_cobradas`; «Cobrada» → `actividad_cobrada`), solo cuando el bloque, tipo y nivel coinciden y
  la plantilla aún no tiene ese indicador.

- `por_definir boolean not null default false`: el concepto se muestra con la insignia «Por
  definir», admite captura y no cuenta en ningún KPI ni en «qué falta».
- `carpeta_id uuid` (nulo): un concepto del bloque `documentos` puede pertenecer a un concepto del
  bloque `carpetas` de la misma plantilla (se valida con disparador; `on delete set null`). Una
  carpeta muestra el avance de sus documentos; si no tiene ninguno asignado, muestra los documentos
  de la plantilla que no pertenecen a ninguna carpeta.

`json_plantilla_seguimiento`, `api_guardar_plantilla_seguimiento` y
`api_duplicar_plantilla_seguimiento` llevan los tres campos. Como quedó:

- Salida de cada concepto: `indicador`, `porDefinir` y `carpetaId`. También los llevan los conceptos
  de `api_obtener_seguimiento_operativo` (los tres, con el nivel `partida`) y los de
  `api_obtener_contrato_cobranza` (`indicador` y `porDefinir`).
- Entrada de cada concepto: `indicador`, `porDefinir` y la carpeta por `carpetaId` o por `carpeta`
  (la etiqueta de un concepto de carpeta de la misma lista; sirve para una carpeta nueva). **Un
  concepto que no trae esas llaves conserva lo que tenía**, de modo que un editor anterior no borra
  nada. Enviar `null` lo quita.
- Errores (IC422) que nombran el concepto: indicador que no corresponde
  (`El indicador de «X» no corresponde a su bloque, tipo y nivel.`), indicador repetido
  (`«A» y «B» tienen el mismo indicador.`) y carpeta inexistente o en un concepto que no es
  documento.
- En el dominio: `INDICADORES_CONCEPTO` (constantes), `ETIQUETA_INDICADOR` e
  `indicadoresDeConcepto(bloque, tipo, nivel)` (`dominio/seguimiento.ts`).

### D2. Nivel «partida»

`nivel` admite `partida` en los bloques `documentos` y `programa`. Un concepto por partida se
captura una vez por grupo de actividades en el mes y su valor se guarda en `seguimiento_valores`
con la clave de la **primera actividad del grupo** (la de menor ordinal). El servidor rechaza
(IC422) un valor de nivel partida dirigido a otra actividad. «Marcar fila» y «Marcar mes» marcan
los conceptos por partida solo en la primera actividad de cada grupo.

La migración convierte a `partida` los conceptos del bloque `documentos` cuya etiqueta normalizada
empieza con «REPORTE» (la matriz dice que el reporte es por partida) y fusiona sus valores: si
alguna actividad del grupo lo tenía marcado, queda marcado en la primera; los demás se eliminan.
El disparador `concepto_con_seguimiento` se desactiva solo durante esa conversión.

Como quedó:

- La «primera actividad» se calcula sobre la lista del mes (programa anual más guardadas), con la
  función `primeras_de_partida`. En el navegador, `partidasDelMes(actividades)` de
  `dominio/seguimiento-operativo.ts` agrupa por partida y da su `primera` con la misma regla.
- La lectura es tolerante: si la primera actividad cambia (el programa agrega o quita ejecuciones),
  el valor de la partida se entrega igualmente en la primera actual; al guardar se retira lo que
  hubiera en las demás actividades de la partida.
- Un concepto con indicador (hoy, «Cobrada») no se marca con «Marcar fila» ni «Marcar mes»: no es un
  documento. Los demás conceptos de casilla o estado sí, incluidos los «por definir».

### D3. Actividades con grupo y partidas escritas a mano

`actividades_seguimiento` y la respuesta de `api_obtener_seguimiento_operativo` añaden a cada
actividad:

- `grupo text`: la partida. Programa anual: `a:<programa>:<partida>`; escrita a mano: su clave base.
- `partida text`: nombre de la partida, sin el ordinal.
- `manual boolean`: la escribió una persona (antes se deducía de `ordinal is null`).

Las actividades escritas a mano se permiten con origen `mensual` **y** `programa_anual` (en este
último se muestran «Fuera del programa»); siguen prohibidas con origen `ninguno`.
`nuevaActividad` admite `veces` (1 a 31, por omisión 1): crea ese número de actividades del mismo
grupo, con ordinal 1…n cuando n > 1. Editar o quitar una partida escrita a mano actúa sobre el
grupo; quitar exige que ninguna actividad del grupo tenga ejecución ni valores. `seguimiento_actividades`
gana `grupo text not null` y `manual boolean not null default false` (se llenan en la migración: las
filas con `ordinal is null` son manuales y su grupo es su clave).

Como quedó:

- Claves de una partida escrita a mano: `m:<id>` con una sola actividad (ordinal nulo, como antes) o
  `m:<id>:1` … `m:<id>:n` con varias; el grupo siempre es `m:<id>`. Repetir el alta con el mismo `id`
  no hace nada.
- `fecha` en `nuevaActividad` es la de la primera actividad. `editarActividad` recibe la clave de una
  actividad: el `nombre` cambia en toda la partida y la `fecha` solo en esa actividad.
  `quitarActividad` quita la partida entera (IC409 si alguna actividad tiene ejecución o valores).
- `programada` es verdadero en las del programa y en las escritas a mano; falso solo en una
  actividad guardada que el programa ya no trae.
- No se pueden cambiar las `veces` de una partida ya creada (se quita y se vuelve a escribir, o se
  agrega otra).

### D4. Atenciones de emergencia

Cambia el nombre en la interfaz; las tablas conservan el suyo. `seguimiento_nocturnas` gana
`hora_inicio time` y `hora_fin time` (opcionales; si están las dos, fin puede ser menor que inicio
porque la atención cruza la medianoche) y `descripcion` pasa a ser opcional (nula o de 1 a 1000
caracteres). Tabla nueva `seguimiento_nocturna_personal (mes_id, nocturna_id, personal_id)` con
llave foránea a la atención (`on delete cascade`) y a `personal` (`on delete restrict`). La
respuesta lleva `horaInicio`, `horaFin` y `asistentes: [{ id, nombre }]`; `nuevaNocturna` recibe
`horaInicio`, `horaFin`, `asistentes: uuid[]` (personas activas) y `descripcion`. El directorio
`personal` de la respuesta se entrega siempre que se pueda editar (ya no depende de tener carpetas).
Las horas van como `HH:MM`. No hay edición de una atención: se quita y se registra de nuevo.
`textoHorario(horaInicio, horaFin)` (`dominio/seguimiento-operativo.ts`) escribe el horario.

### D5. Carpeta: entrega, recepción y acuse

Estados de `seguimiento_carpetas.estado`: `pendiente`, `en_proceso`, `entregada`,
`recibida_comentarios`, `recibida`. Columnas nuevas: `fecha_recepcion date`, `comentarios text`
(hasta 1000), `acuse_enlace text`, `acuse_archivo_nombre text`, `acuse_archivo bytea` (hasta 8 MiB;
enlace y archivo de acuse son excluyentes). Reglas:

| Estado                 | Exige                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- |
| `entregada`            | quién entrega (personal) y fecha de entrega                                  |
| `recibida_comentarios` | lo de entregada, quién recibe, fecha de recepción y comentarios              |
| `recibida`             | lo de entregada, quién recibe, fecha de recepción y acuse (enlace o archivo) |

El enlace o archivo de la carpeta (los que ya existían) pasa a ser opcional en todos los estados.
Las entregas ya guardadas siguen siendo válidas. La descarga del acuse usa la misma ruta con
`?adjunto=acuse`. La respuesta de cada carpeta añade `fechaRecepcion`, `comentarios`,
`acuseEnlace` y `acuseArchivoNombre`.

Como quedó:

- El comando `carpeta` solo exige `conceptoId`, `estado` y `version`. **Un dato que no viene conserva
  lo guardado**, así cada paso (preparar, entregar, recibir) envía solo lo suyo. Campos: `entregaId`,
  `fecha` (de entrega), `recibe`, `fechaRecepcion`, `comentarios`, `enlace`, `archivo` (base64) con
  `archivoNombre`, `quitarArchivo`, `acuseEnlace`, `acuseArchivo` (base64) con `acuseArchivoNombre` y
  `quitarAcuse`. En el formulario de `/seguimiento` llevan esos mismos nombres (`archivo` y
  `acuseArchivo` son los campos de tipo archivo).
- Al volver de `recibida_comentarios` a `entregada` (entregar de nuevo) se conservan los
  comentarios y la recepción anteriores; los comentarios se borran al llegar a `recibida`, salvo
  que el comando los envíe.
- La fecha de recepción no puede ser anterior a la de entrega (solo se exige al recibir).
- Los mensajes dicen qué falta: «Para entregar la carpeta, indique quién la entrega y la fecha de
  entrega.», «Para registrar la recepción, indique quién recibe y la fecha de recepción.», «Escriba
  los comentarios con los que se recibió la carpeta.» y «Para cerrar la carpeta, agregue el acuse de
  recibido: un enlace o un archivo.»
- Constantes y etiquetas: `ESTADOS_ENTREGA_CARPETA` y el tipo `EstadoCarpeta` (constantes);
  `ESTADOS_CARPETA`, `carpetaEntregada` y `carpetaCerrada` (`dominio/seguimiento-operativo.ts`).

### D6. Adicionales

Tabla `adicionales`: `id uuid`, `sitio_id`, `orden_compra text` (obligatoria, hasta 100),
`descripcion text` (opcional, hasta 500), `fecha_solicitud date`, `periodo_inicio date`,
`periodo_fin date` (fin ≥ inicio), `monto_pactado numeric(14,2)`, `monto_cobrado numeric(14,2)`,
`creado_en`. El contrato madre es el del centro y no se guarda. `api_obtener_contrato_cobranza`
los entrega en `contrato.adicionales` (solo con `verContrato`), y `api_guardar_contrato_cobranza`
admite `nuevoAdicional`, `editarAdicional`, `quitarAdicional` (capacidad `editarContrato`; no
tocan `monto_cobrado`) y `cobroAdicional` (capacidad `editarCobranza`; solo `monto_cobrado`). La
ruta comprueba la capacidad de cada acción.

Como quedó: cada adicional sale como `{ id, ordenCompra, descripcion, fechaSolicitud, periodoInicio,
periodoFin, montoPactado, montoCobrado }`. `nuevoAdicional` y `editarAdicional` reciben esos campos
menos `montoCobrado` (el `id` lo genera quien llama, como en las órdenes); `quitarAdicional`, el
`id`; `cobroAdicional`, `id` y `montoCobrado` (null lo borra). Un adicional con cobro registrado no
se puede quitar (IC409): primero contabilidad borra el cobro. `/cobranza` ya asigna la capacidad de
las cuatro acciones y lee del formulario los campos con esos nombres.

### D7. Monto cobrado derivado

`api_obtener_contrato_cobranza` añade `contrato.cobradoTotal`: la suma de `cobranza_meses.monto_cobrado`
de todos los años (0 si no hay). Es solo la cobranza mensual, igual que `finanzas.cobrado` del
resumen de estatus; lo cobrado de los adicionales va aparte (`finanzas.adicionales.cobrado`). El concepto con indicador `monto_cobrado` deja de capturarse: la pantalla
muestra `cobradoTotal` como dato de solo lectura («Lo llena contabilidad en la cobranza mensual»).
Si no hay cobranza mensual y el concepto tiene un valor anterior, se muestra ese valor con la nota
«Captura anterior». El guardado del contrato conserva el valor almacenado de ese concepto e ignora el que le envíen. La
pantalla reconoce el concepto por `indicador = 'monto_cobrado'` y encuentra la captura anterior en
`contrato.valores`.

### D8. Resumen de estatus

`api_estatus_centros(p)` con `{ sitioIds: uuid[] | null, mes, hoy, verContrato }` devuelve una fila
por centro de costo:

```ts
interface ResumenCentro {
	sitioId: string;
	plantillaId: string | null;
	origen: 'programa_anual' | 'mensual' | 'ninguno';
	/** El mes consultado ya terminó (según `hoy`): lo que falte ejecutar ya es atraso. */
	mesTerminado: boolean;
	/** Actividades del mes (programa anual + escritas a mano). */
	actividades: { programadas: number; ejecutadas: number; cobradas: number | null };
	/** null si la plantilla no tiene los indicadores de EM. */
	em: { programadas: number | null; realizadas: number | null; cobradas: number | null } | null;
	/** Casillas y estados esperados contra hechos, sin conceptos por definir ni con indicador. */
	documentos: {
		esperados: number;
		hechos: number;
		faltantes: {
			conceptoId: string;
			etiqueta: string;
			nivel: 'actividad' | 'partida' | 'periodo';
			faltan: number;
		}[];
	};
	carpetas: { conceptoId: string; etiqueta: string; estado: EstadoCarpeta; porDefinir: boolean }[];
	emergencias: number;
	/** Solo con verContrato; ausente en otro caso. */
	finanzas?: {
		montoContrato: number | null;
		/** Solo la cobranza mensual, de todos los años. */
		cobrado: number;
		facturado: number | null;
		mes: { estimacion: boolean; prefactura: boolean; factura: boolean; cobrado: boolean };
		adicionales: { cantidad: number; pactado: number; cobrado: number };
		contratoVencido: boolean;
		cartaFaltante: boolean;
		datosContrato: { esperados: number; capturados: number };
	};
}
```

Documentos esperados: por cada actividad ejecutada, sus conceptos de nivel actividad de tipo casilla
o estado; por cada grupo con alguna actividad ejecutada, los de nivel partida; y los de nivel
periodo (bloque `programa`, casilla o estado) una vez por mes. Un estado cuenta como hecho solo en
`hecho`. `actividades.cobradas` es null si la plantilla no tiene `actividad_cobrada`.

Como quedó:

- La interfaz vive en `src/lib/dominio/estatus.ts`. Se consulta con
  `repos.estatus.obtener({ sitioIds, mes: 'AAAA-MM', hoy, verContrato })` (una fila por centro, por
  clave; `sitioIds: null` = todos, `[]` = ninguno) o con
  `repos.estatus.deCentro(sitioId, { mes, hoy, verContrato })` (una fila o null).
- Un concepto con indicador no cuenta como documento (se mide por su indicador), y uno «por definir»
  no cuenta en nada. Una carpeta por definir sí sale en `carpetas`, con `porDefinir: true`.
- `actividades.programadas` y `ejecutadas` cuentan las actividades programadas (programa y escritas
  a mano); `cobradas`, las ejecutadas con «Cobrada». Los documentos se esperan de toda actividad
  ejecutada, también de una que el programa ya no trae.
- `datosContrato.esperados` cuenta los conceptos del bloque contrato de una plantilla con contrato
  obligatorio (0 en las demás), sin los montos cobrado y facturado ni los por definir.
- `contratoVencido` y `cartaFaltante` usan la mayor vigencia de los contratos del centro contra
  `hoy`, igual que `/cobranza`.

### D9. Dominio `estatus.ts`

Funciones puras (sin Zod) que reciben un `ResumenCentro` y, si el centro tiene programa anual, su
avance acumulado al corte (`{ planeado, ejecutado, avance }`, los mismos campos de una fila de
`dominio/concentrado.ts`):

- `kpisDeCentro(resumen, avance = null)`: lista de
  `{ clave, etiqueta, valor, total, porcentaje, semaforo, detalle, alcance?, esMonto? }` para
  `ejecucion`, `em`, `documentos`, `carpetas`, `cobranza`, `cobro` (de EM o de actividades) y
  `contrato`; solo los que aplican, en ese orden.
  - Ejecución lleva `alcance`: `'ciclo'` con el avance del programa anual (umbrales de
    `UMBRALES.cumplimiento`) o `'mes'` con las actividades del mes. En el mes en curso lo que falta
    no es atraso (verde si está completo, amarillo si no); con `mesTerminado` aplican los umbrales.
    EM sigue la misma regla del mes.
  - Documentos y carpetas: verde si están completos y amarillo si no; nunca rojo. El semáforo de
    carpetas sale del conteo por estado (todas «recibida»), no de un umbral; el KPI trae el
    porcentaje solo para dibujar la barra.
  - Cobranza (`esMonto`, cobrado contra el monto del contrato, con el paso del mes en `detalle`) y
    cobro son informativos: `semaforo: null` y no cambian el estatus.
  - Contrato: rojo si falta la carta de finalización, amarillo si faltan datos, verde si no.
- `estatusDeCentro(kpis, resumen)`: `atrasado` (algún KPI en rojo o carta de finalización faltante),
  `sin_datos` (ningún KPI operativo —ejecución, EM, documentos, carpetas— con denominador),
  `con_pendientes` (algún amarillo o algo en «qué falta») o `al_corriente` (la lista de pendientes
  está vacía). Etiquetas en `ETIQUETA_ESTATUS`; orden del tablero en `ESTATUS_CENTRO`.
- `queFalta(resumen, maximo = 5)`: pendientes
  `{ texto, destino: 'seguimiento' | 'cobranza', ancla?, conceptoId? }` ordenados por urgencia,
  máximo cinco y un último «y N más» (destino `seguimiento`, sin ancla).
  `pendientesDeCentro(resumen)` da la lista completa. Anclas: `actividades`, `carpetas`, `carta`,
  `contrato` y `cobranza` (`emergencias` y `adicionales` están en el tipo, pero ningún pendiente las
  usa todavía). `conceptoId` va en documentos y carpetas. Orden y frases: carta («Falta la carta de
  finalización»), actividades («Faltan 3 actividades por ejecutar»), EM («Faltan las EM programadas
  del mes» o «Falta 1 EM por realizar»), carpetas con comentarios («Carpeta de seguridad con
  comentarios: falta corregirla y entregarla de nuevo»), documentos de más a menos faltantes
  («Faltan 3 reportes», «Falta 1 ODT», o «Faltan bitácoras en 2 actividades» cuando la etiqueta ya
  está en plural), carpetas sin entregar («Carpeta de seguridad sin entregar»), carpetas entregadas
  («Carpeta de seguridad entregada: falta que la reciban»), siguiente paso de una cobranza ya
  empezada («Falta la factura del mes») y datos del contrato («Faltan 2 datos del contrato»).
- `resumirCentro(resumen, avance)` devuelve `{ estatus, kpis, falta }` de una vez.

### D10. Complemento de plantillas

`npm run importar:centros -- --complementar` (ensayo por omisión, `--aplicar` para escribir) lee el
archivo de `insumos/centros-costo/` y, por plantilla existente: agrega los conceptos que falten
(por bloque y etiqueta normalizada) y actualiza `indicador`, `por_definir` y `carpeta` de los
existentes. Nunca cambia tipo, bloque ni nivel de un concepto, ni elimina conceptos. El archivo
nuevo de la matriz queda en `insumos/` (no versionado).

Como quedó: función `api_complementar_plantillas` y
`repos.centrosCosto.complementar(carga, ensayo)`. Cada concepto del archivo admite `indicador`,
`porDefinir` y `carpeta` (etiqueta); solo se aplican las llaves presentes. El archivo es el objetivo:
si asigna un indicador a un concepto, lo quita del que lo tuviera en esa plantilla. Una diferencia
de tipo o nivel, un indicador que no corresponde o una carpeta inexistente se informan como aviso y
no cambian nada. Una plantilla que no existe se informa como «ausente» (se da de alta con la carga
normal). El archivo es `insumos/centros-costo/centros-costo-2026-11-20.json`.

### D11. Pantallas

- **Concentrado (`/cumplimiento`)**: tarjetas por centro de costo (estatus general, KPI con barra y
  «qué falta») ordenadas del más atrasado al más al corriente, con filtro por estatus y búsqueda;
  en escritorio se conserva además la tabla. Montos solo con `verContrato`.
- **Seguimiento (`/seguimiento`)**: arriba, la ficha de estatus del centro en el mes. Actividades
  agrupadas por partida; en teléfono cada partida es una tarjeta con sus actividades y casillas
  grandes. Carpeta como pasos (preparar → entregar → recibir). Atenciones de emergencia con el
  formulario nuevo. Las acciones siguen siendo formularios de SvelteKit con `enhance`.
- **Contrato y cobranza (`/cobranza`)**: sección «Adicionales», cobrado derivado y diseño usable
  en teléfono.
- **Editor de plantillas (`/catalogo/plantillas/[id]`)**: nivel «Por partida», indicador, «Por
  definir» y carpeta del documento.
- La carga de `/cumplimiento` y de `/seguimiento` pasa `verContrato` al repositorio; la respuesta
  no lleva `finanzas` si el rol no lo permite.

## Riesgos

- **Conversión a nivel partida**: fusiona valores existentes. Se prueba con datos en varias
  actividades del mismo grupo y se respalda la base antes de aplicar.
- **Base de trabajo**: una base con la 0028 no sirve con el código anterior (niveles y estados
  nuevos). Volver atrás exige restaurar el respaldo además de cambiar de rama; por eso la base de
  trabajo solo se migra con autorización.
- **Rendimiento del concentrado**: `api_estatus_centros` resuelve todos los centros en una
  consulta; sustituye la consulta por centro que hacía la carga de `/cumplimiento`.
