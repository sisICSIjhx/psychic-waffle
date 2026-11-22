## 1. Base de datos y dominio

- [x] 1.1 Migración 0028: columnas de `plantilla_conceptos` (indicador, por definir, carpeta), nivel `partida`, asignación de indicadores y conversión del reporte a nivel partida (D1 y D2).
- [x] 1.2 Migración 0028: grupo y manual en actividades, partidas escritas a mano con programa anual y `veces` (D3).
- [x] 1.3 Migración 0028: atenciones de emergencia con horario y personal (D4) y carpeta con recepción y acuse (D5).
- [x] 1.4 Migración 0028: tabla `adicionales`, acciones y `cobradoTotal` (D6 y D7).
- [x] 1.5 Migración 0028: `api_estatus_centros` (D8), RLS y permisos de ejecución; `npm run bd:script` al día.
- [x] 1.6 Repositorios y esquemas Zod de plantillas, seguimiento, contrato y estatus; constantes del dominio.
- [x] 1.7 Dominio `estatus.ts` con sus pruebas (D9).
- [x] 1.8 Complemento de plantillas (`--complementar`) y archivo de la matriz en `insumos/` (D10).
- [x] 1.9 Pruebas de repositorio sobre PGlite: migración con datos previos, permisos y alcance.

## 2. Captura

- [x] 2.1 `/seguimiento`: ficha de estatus, partidas agrupadas, tarjetas en teléfono y partida escrita a mano.
- [x] 2.2 `/seguimiento`: carpeta por pasos con recepción y acuse; atenciones de emergencia.
- [x] 2.3 `/cobranza`: adicionales, cobrado derivado y diseño para teléfono.
- [x] 2.4 Editor de plantillas: nivel por partida, indicador, por definir y carpeta.

## 3. Estatus

- [x] 3.1 Concentrado de `/cumplimiento`: tarjetas de KPI por centro, filtro por estatus, búsqueda y tabla en escritorio.
- [x] 3.2 Carga de `/cumplimiento` y `/seguimiento` con `api_estatus_centros` y `verContrato` en el servidor.

## 4. Revisión e iteración

- [ ] 4.1 Revisión de código: errores, permisos, alcance y pruebas.
- [ ] 4.2 Recorrido del usuario operativo en 375 px y escritorio con las tareas de aceptación.
- [ ] 4.3 Atender hallazgos y repetir hasta calificación 4 o más por tarea.

## 5. Cierre

- [x] 5.1 `npm run check`, `npm run lint` y `npm run test`.
- [x] 5.2 Complementar las plantillas en la base de prueba y comprobar el estatus de cada centro.
- [x] 5.3 Actualizar plan, contexto e historial.
- [x] 5.4 Migrar la base de trabajo con respaldo (requiere autorización del usuario).
