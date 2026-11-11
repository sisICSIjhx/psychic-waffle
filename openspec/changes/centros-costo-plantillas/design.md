# Design

## Context

Ver `proposal.md` para el motivo. Restricciones:

- El centro de costo ya existe en los datos: es la tabla `sitios` (`clave`, `nombre`), unida a los
  contratos por `contrato_sitios`; partidas, programas, reportes y equipos llevan `sitio_id`. La
  etapa 0 solo cambió los textos de la interfaz.
- El servidor es el único cliente de la base y todo pasa por funciones `api_*` (jsonb → jsonb),
  iguales en PGlite y en Supabase. Las pruebas de repositorio corren sobre PGlite.
- La sesión (`api_contexto_acceso`) se consulta una vez por petición en `src/hooks.server.ts`, con
  una caché de 10 segundos; `locals.usuario` llega a cargas y acciones.
- Nada del Excel ni del contrato real (números, montos) se versiona.
- Las etapas 3 y 4 guardarán valores por concepto: el modelo debe darles un identificador estable
  por concepto y saber, sin código por centro de costo, qué bloques aplica cada uno.

## Goals / Non-Goals

**Goals:**

- Registrar los doce centros de costo nuevos y la plantilla de cada uno (apartado 2.5 del plan) sin
  tocar código por centro de costo.
- Que cada persona vea y modifique solo lo de sus centros de costo, comprobado en el servidor.

**Non-Goals:**

- Capturar valores de los conceptos, órdenes de compra, montos, carpetas o cobranza (etapas 3 y 4).
- Registrar el contrato real de los centros nuevos: se hace en el catálogo cuando se conozca.
- Cambiar el DOCX ni la relación contrato–cliente (el cliente sigue siendo la razón social).

## Decisions

**D1. El centro de costo sigue siendo `sitios`.** Se añade `sitios.plantilla_id` (opcional) y se
listan los centros de costo por sí mismos (`api_listar_centros_costo`), con o sin contrato. Una
tabla nueva duplicaría la que ya usan partidas, programas, reportes y equipos. Un centro de costo
sin contrato no puede tener partidas (la llave de `partidas` exige el par contrato–sitio), lo que es
correcto: sin contrato no hay programa.

**D2. Plantilla compartida, no copiada.** `plantillas_seguimiento` (nombre único, descripción,
`modo_contrato` ∈ obligatorio | opcional | sin_contrato y `origen_actividades` ∈ programa_anual |
mensual | ninguno) y `plantilla_conceptos` (bloque, etiqueta, tipo, nivel, orden). Los centros de
costo apuntan a una plantilla; «igual que OMA EDOMEX» es elegir la misma, y si uno se aparta se
duplica. Así un ajuste a los documentos de tres centros se hace una vez.

**D3. Solo los bloques variables van en la plantilla.** Bloques: `contrato` (A),
`ordenes_compra` (B), `programa` (D), `documentos` (E) y `carpetas` (F). La carta de finalización
(C), la cobranza (G) y las atenciones nocturnas aplican a todos con los mismos datos (apartado 2.5)
y las fijará el código de las etapas 3 y 4. Un bloque aplica a un centro de costo si su plantilla
tiene al menos un concepto de ese bloque.

**D4. Tipos y niveles cerrados.** Tipos: casilla (hecho), estado (pendiente, en proceso, hecho),
cantidad, monto, enlace, fecha, texto y carpeta (una entrega con quién entrega, quién recibe,
fecha y enlace o archivo). Niveles: contrato, orden de compra, periodo y actividad. El nivel lo fija
el bloque (contrato → contrato, órdenes → orden de compra, documentos → actividad, carpetas →
periodo) salvo en programa, que admite periodo o actividad. Las carpetas solo admiten el tipo
carpeta. La base lo valida (`api_guardar_plantilla_seguimiento`); la interfaz solo ofrece las
combinaciones válidas (`src/lib/dominio/seguimiento.ts`).

**D5. Identificadores estables.** Guardar una plantilla recibe la lista completa de conceptos:
los que traen `id` se actualizan, los nuevos se insertan y los que faltan se borran; el orden es el
de la lista dentro de cada bloque. Las etapas 3 y 4 referenciarán `plantilla_conceptos.id` con
`on delete restrict`, y entonces borrar un concepto con valores fallará con un mensaje.

**D6. Asignación por centro de costo.** `personal_centros_costo (personal_id, sitio_id)` sustituye a
`personal_proyectos`. La migración convierte cada proyecto asignado en los centros de costo de los
contratos de ese cliente y borra la tabla anterior. `rol_sin_proyectos` se conserva con su nombre
(administrador, mesa directiva y contabilidad abarcan todos los centros de costo y no guardan
asignaciones).

**D7. El alcance viaja con la sesión.** `json_usuario` añade `centrosCosto`: null si el rol abarca
todos, o la lista de ids de sus centros de costo. `src/lib/server/alcance.ts` ofrece
`centrosVisibles(locals)` (null = todos; sin inicio de sesión activado, todos como hoy), filtros de
listas y `exigirCentro`. La caché de 10 segundos de la sesión ya se vacía al guardar personal, así
que un cambio de asignación se aplica en la siguiente petición del mismo proceso.

**D8. Dónde se filtra.**

- Listas pequeñas (clientes, contratos, centros de costo, programas, filas de cumplimiento,
  equipos): en TypeScript sobre lo que ya devuelven los repositorios, con el mapa contrato → centros
  de costo de `api_contratos_centros`. Evita reescribir media docena de funciones SQL.
- Listas paginadas (historial de reportes): en SQL, con el filtro nuevo `sitioIds` de
  `api_listar_reportes`, para que el total y las páginas sean correctos.
- Detalles por id (`/reportes/[id]` con documento y fotos, `/catalogo/contratos/[id]`,
  `/catalogo/partidas/[id]`, `/equipos/[id]`): en la guardia de `src/hooks.server.ts`, que extrae
  el recurso de la ruta (`recursoDeRuta`, función pura) y pregunta sus centros de costo a
  `api_centros_de_recurso`. Fuera del alcance responde 404 «No encontrado», sin revelar que existe;
  así cubre de una vez la carga, las acciones, el documento y cada foto.
- Acciones que reciben ids en el formulario (crear reporte en `/captura`, ajustar el programa en
  `/planeacion`): `exigirCentro` con el centro de costo de la partida o del programa.

**D9. Carga desde un archivo.** `npm run importar:centros -- <archivo.json> [--aplicar]` lee
plantillas y centros de costo y llama a `api_importar_centros_costo`, que en una transacción da de
alta las plantillas que no existen por nombre y los centros que no existen por clave, y asigna la
plantilla a los centros existentes que no tienen una. No modifica plantillas existentes ni cambia la
plantilla ya asignada. Con ensayo (por omisión) informa sin guardar. El archivo real queda en
`insumos/centros-costo/` (no versionado); `scripts/datos-prueba/` lleva uno ficticio para las
pruebas.

**D10. Pantallas en el catálogo.** `/catalogo/centros-costo` (lista con contrato, plantilla y
personas; alta y edición en diálogo) y `/catalogo/plantillas` (lista, nueva, duplicar, eliminar si
ningún centro la usa) con `/catalogo/plantillas/[id]` (editor por bloques). Consultar la lista de
centros de costo es de todos (filtrada por alcance); las plantillas y toda edición son de
`editarCatalogo`, que la guardia ya exige a los POST bajo `/catalogo`.

## Risks / Trade-offs

- [Filtrar en TypeScript deja una consulta sin filtrar en el servidor] → las listas son pequeñas
  (decenas de filas) y no salen al navegador antes de filtrarse; lo paginado se filtra en SQL.
- [Un reporteador sin centros de costo no ve nada al activar el inicio de sesión] → es lo que pide
  el plan; «Mi trabajo» y la ficha de personal lo explican, y el administrador asigna antes de dar
  la contraseña.
- [Borrar `personal_proyectos` es irreversible] → la migración convierte primero las asignaciones;
  en la base local no hay ninguna (comprobado el 2026-11-10).
- [Una consulta más por foto en la guardia] → índice por llave primaria; la misma petición ya lee la
  foto de la base.

## Migration Plan

1. La 0023 se aplica sola al abrir PGlite; en Supabase, con su CLI o con el script completo.
2. Dar de alta las plantillas y los centros con `npm run importar:centros` (ensayo, luego
   `--aplicar`) con el servidor detenido.
3. Asignar centros de costo al personal en `/personal` antes de activar las cuentas de quien no es
   administrador, mesa directiva o contabilidad.
4. Vuelta atrás: quitar `plantilla_id` a los centros no rompe nada; las asignaciones por proyecto no
   se recuperan (no había).

## Open Questions

- Lo abierto del apartado 5 del plan (forma del reporte de EM-30017 y EM-30043, programa de OMA
  EDOMEX) no cambia este diseño: sus plantillas pueden ajustarse después.
