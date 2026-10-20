# Propuesta tecnológica y pendientes de ICSI Reportes

Fecha: 2026-10-19. Zona horaria: America/Mexico_City.

Estado: recomendación técnica para orientar el desarrollo. Las tecnologías propuestas y los
comportamientos descritos como pendientes todavía no están implementados ni validados en producción.

## Propósito y condiciones de uso

ICSI Reportes busca centralizar la información y automatizar la elaboración de reportes técnicos,
reduciendo el tiempo aproximado de 60 a 30 minutos por reporte, o menos, conservando calidad,
uniformidad y seguridad. Con 50 reportes mensuales, alcanzar esa reducción representaría 25 horas de
trabajo ahorradas al mes; este beneficio todavía debe medirse con el proceso real.

Condiciones consideradas:

- Uso en oficina con Internet estable.
- Alrededor de 40 usuarios. Para dimensionar, distinguir usuarios registrados de sesiones simultáneas;
  utilizar inicialmente 40 sesiones activas como escenario conservador de prueba.
- Fotografías y archivos documentales almacenados automáticamente en SharePoint.
- Reportes existentes en Word que sirven como referencia de formato.
- Entrega de DOCX editables y PDF relacionados con la misma revisión.
- Edición local: el usuario descarga el DOCX, lo modifica en Word en su computadora y vuelve a cargarlo
  al sistema si desea incorporar los cambios al expediente.

La base recomendada es una aplicación web con SvelteKit y TypeScript, PostgreSQL administrado por
Supabase, archivos en SharePoint y generación documental a partir de plantillas Word.

## Estado observado del proyecto

La revisión de `package.json`, `svelte.config.js` y el inventario de `src/` muestra una estructura
inicial de interfaz y herramientas de desarrollo. Las vistas principales están vacías. Todavía no hay
endpoints de negocio, persistencia, autenticación, integración con SharePoint ni generación documental.

Svelte, SvelteKit, TypeScript, Tailwind CSS, Vitest y Playwright están instalados. La configuración de
despliegue utiliza `adapter-auto`; el alojamiento definitivo está pendiente. Tener una dependencia
instalada no significa que la funcionalidad correspondiente esté desarrollada o probada.

La plantilla imprimible de la versión anterior descrita por el usuario no se encontró en esta copia.
Debe recuperarse como referencia visual junto con los Word originales y sus PDF aceptados.

El contexto del código y sus observaciones están en [CONTEXTO_PROYECTO.md](CONTEXTO_PROYECTO.md).

## Selección tecnológica propuesta

| Parte                     | Tecnología propuesta                                                            | Estado actual                                                                 |
| ------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Interfaz                  | Svelte, SvelteKit y TypeScript                                                  | Base instalada; falta desarrollar las pantallas funcionales.                  |
| Presentación              | HTML, CSS y Tailwind CSS                                                        | Instalados; falta completar la integración y los formularios.                 |
| Backend                   | Endpoints y funciones de SvelteKit sobre Node.js                                | Pendiente. Usar una versión LTS compatible de Node.js.                        |
| Base de datos             | PostgreSQL administrado por Supabase                                            | Pendiente.                                                                    |
| Conexión con Supabase     | `@supabase/supabase-js` y `@supabase/ssr`                                       | Pendiente.                                                                    |
| Autenticación             | Supabase Auth; preferentemente conectado con Microsoft Entra ID                 | Pendiente. Confirmar disponibilidad de cuentas corporativas para el personal. |
| Autorización              | Roles y permisos por proyecto, aplicados en servidor y mediante RLS             | Pendiente. Son mecanismos de autorización, no una biblioteca adicional.       |
| Validación de datos       | Zod                                                                             | Pendiente.                                                                    |
| Fotografías               | Sharp para orientación, tamaños y miniaturas                                    | Pendiente. Conservar los originales.                                          |
| Almacenamiento documental | SharePoint mediante Microsoft Graph; MSAL Node para autenticar la aplicación    | Pendiente.                                                                    |
| Generación del Word       | Plantillas DOCX existentes y `docx-templates`                                   | Candidato pendiente de implementar y probar con los formatos originales.      |
| Conversión a PDF          | LibreOffice en modo headless                                                    | Primer candidato; falta comprobar fidelidad visual.                           |
| Tareas en segundo plano   | Supabase Queues y un proceso de trabajo en Node.js                              | Pendiente. La cola almacena tareas; el proceso ejecuta el trabajo.            |
| Caché                     | Caché HTTP y caché limitada en servidor, con invalidación y control de permisos | Pendiente.                                                                    |
| Pruebas                   | Vitest y Playwright; añadir k6 para carga                                       | Las primeras herramientas están instaladas; falta cobertura real del sistema. |
| Despliegue                | Servidor Node.js, `adapter-node`, HTTPS y Docker recomendado                    | Pendiente de elegir alojamiento y configurar.                                 |

SvelteKit puede cubrir la interfaz y el backend del mismo proyecto. Next.js y Electron quedan fuera de
la propuesta inicial. Playwright se conserva principalmente como herramienta de pruebas; el PDF
principal se obtendría del DOCX aprobado.

Supabase alojaría los datos y la autenticación. La aplicación Node.js y el proceso de conversión
documental requieren un alojamiento adicional compatible con sus dependencias.

## Generación de DOCX y PDF

Las plantillas Word existentes deben ser el origen del editable y del PDF. Se conservarían sus
encabezados, tablas, logotipos, estilos y distribución, agregando marcadores para insertar datos y
repetir las actividades o fotografías necesarias. El DOCX debe contener texto y tablas nativos de
Word para permitir su edición.

`docx-templates` permite completar documentos con datos, imágenes y bloques repetidos. LibreOffice
permite convertirlos a PDF de forma automatizada, sin abrir una interfaz. Ambos son candidatos que
deben probarse con los formatos reales de ICSI antes de considerar definitiva la elección.

La prueba documental debe revisar fuentes, tablas extensas, fotografías verticales y horizontales,
encabezados, pies y saltos de página. Si LibreOffice no alcanza la fidelidad necesaria, se evaluará
otro motor de conversión. Cambiar ese componente no obliga a sustituir el frontend, la base de datos
ni la integración con SharePoint.

Flujo propuesto:

1. Capturar y guardar la información del reporte en el sistema.
2. Generar el DOCX mediante la plantilla correspondiente y guardar la revisión en SharePoint.
3. Permitir que el usuario descargue el editable.
4. Si necesita ajustes, editarlo localmente en Word.
5. Incorporar los cambios mediante la opción «Subir Word corregido» del sistema.
6. Guardar una nueva revisión, sin sobrescribir silenciosamente otra más reciente.
7. Generar el PDF a partir de la revisión concreta del DOCX seleccionada para emisión.
8. Conservar el DOCX y el PDF relacionados y permitir su consulta y descarga autorizadas.

Si no hay ajustes manuales, el sistema puede generar y guardar directamente ambos formatos. La
aplicación conoce las modificaciones locales únicamente cuando el usuario vuelve a cargar el archivo.
SharePoint funciona como repositorio; el flujo acordado utiliza edición local en Word.

Reglas que deben implementarse:

- Identificar la revisión del DOCX de la que procede cada PDF.
- Conservar los ajustes manuales y evitar que completar otra vez una plantilla los sobrescriba.
- Detectar cargas basadas en una revisión anterior cuando ya exista una más reciente.
- Si cambia el DOCX vigente, identificar que el PDF anterior corresponde a otra revisión.
- Conservar los documentos emitidos; las correcciones posteriores generan nuevas revisiones.
- Validar los archivos recibidos y comprobar autorización antes de descargarlos o procesarlos.

Una edición en Word no actualiza automáticamente PostgreSQL. Los campos estructurados, como folio,
cliente, fechas y proyecto, requieren una actualización explícita en la aplicación si también cambian
en el documento. La sincronización automática de cualquier edición libre de Word no forma parte de
esta propuesta inicial.

## Distribución de datos y archivos

| PostgreSQL en Supabase                                | SharePoint                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| Clientes, proyectos, reportes y actividades.          | Fotografías originales.                                    |
| Orden y descripción de fotografías.                   | Versiones preparadas de fotografías, cuando correspondan.  |
| Referencias e identificadores de archivos.            | DOCX generados y corregidos.                               |
| Estados, revisiones y versión de plantilla utilizada. | PDF emitidos y anexos.                                     |
| Usuarios, permisos e historial de operaciones.        | Plantillas documentales, si se decide administrarlas allí. |

Las credenciales de SharePoint y las claves privilegiadas permanecen en el servidor. Se deben definir
permisos para la aplicación y para los usuarios, además de proteger las operaciones mediante las
reglas del sistema. Las políticas de PostgreSQL no protegen automáticamente los archivos de SharePoint.

Los respaldos deben contemplar ambos repositorios y probar la recuperación de registros y archivos
relacionados. Restaurar PostgreSQL no restaura las fotografías y documentos guardados en SharePoint.

## Caché

La política depende del contenido y debe respetar los permisos de acceso.

| Contenido                               | Política inicial propuesta                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Recursos públicos con nombre versionado | Caché prolongada; cambiar la URL al publicar otra versión.                                      |
| Catálogos poco variables                | Caché breve e invalidación al modificarlos. Como punto inicial, evaluar 5 a 15 minutos.         |
| Borradores, sesiones y datos privados   | Evitar caché compartida; normalmente `Cache-Control: private, no-store` en sus respuestas HTTP. |
| Miniaturas                              | Caché privada por archivo, versión y tamaño solicitado, con límites de espacio.                 |
| DOCX y PDF emitidos                     | Recuperar la revisión guardada después de comprobar permisos, sin regenerarla en cada descarga. |

También se debe invalidar la información afectada después de una modificación y eliminar el estado
privado mantenido por la aplicación al cerrar sesión. Los documentos emitidos son archivos históricos
persistentes; su conservación no depende de una caché temporal.

Redis queda condicionado a las mediciones o al uso de varias instancias del servidor que necesiten
compartir caché. Tener 40 usuarios, por sí solo, no lo hace necesario.

## Operación con alrededor de 40 usuarios

La captura debe permanecer disponible mientras se generan documentos. Se separan estas operaciones:

| Operación                                         | Ejecución propuesta                                                |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Consultar, capturar y guardar información         | Servidor web con respuestas breves.                                |
| Preparar imágenes, completar DOCX y convertir PDF | Proceso de trabajo en segundo plano mediante una cola persistente. |

La concurrencia documental debe limitarse y ajustarse con pruebas. Como punto de partida para medir,
se pueden evaluar una o dos conversiones simultáneas; las demás solicitudes permanecen en cola con
un estado visible. No es una capacidad ya demostrada.

Para las consultas se requieren paginación, índices según las búsquedas reales y conexiones
administradas. Si se utiliza SQL directo desde Node.js, se configura un pool. Las solicitudes mediante
`supabase-js` utilizan la API de Supabase; 40 sesiones web no equivalen automáticamente a 40 conexiones
PostgreSQL dedicadas.

El guardado de reportes debe comprobar la versión que el usuario estaba editando. Si otra persona
modificó el mismo registro, se debe detectar el conflicto antes de sobrescribirlo. El autoguardado debe
agrupar cambios con una breve pausa, evitando una escritura por cada tecla.

Las tareas deben registrar su estado, recuperar fallos temporales y evitar archivos o emisiones
duplicadas al reintentarse. Una tarea que deba continuar después de cerrar el navegador necesita
tener sus insumos guardados de forma duradera; la cola no sustituye el almacenamiento del archivo.

## Pendientes de implementación

1. **Completar la base de la aplicación.** Revisar navegación y rutas, completar vistas y formularios y
   separar presentación, reglas de negocio y operaciones del servidor.
2. **Diseñar y crear la base de datos.** Modelar clientes, proyectos, reportes, actividades,
   fotografías, plantillas, revisiones, usuarios, permisos e historial. Mantener la estructura mediante
   migraciones SQL.
3. **Implementar acceso y permisos.** Inicio y cierre de sesión, autorización por función y proyecto,
   protección de endpoints y gestión de credenciales exclusivamente en el servidor.
4. **Desarrollar captura y fotografías.** Validaciones, autoguardado, carga múltiple, orden,
   descripciones y preparación de imágenes, conservando originales y detectando conflictos.
5. **Automatizar SharePoint.** Organizar expedientes, cargar y recuperar archivos, registrar sus
   identificadores y recuperar operaciones fallidas sin duplicarlos.
6. **Implementar el ciclo documental.** Generar el editable, descargarlo, recibir el Word corregido,
   gestionar revisiones y convertir el DOCX concreto a PDF, preservando ajustes manuales.
7. **Preparar rendimiento y operación.** Cola de tareas, límites de procesamiento simultáneo, caché,
   consultas paginadas, registros de errores, respaldos, recuperación y despliegue.

## Orden recomendado y validación

El primer entregable técnico debe ser un reporte completo generado desde una plantilla Word real,
descargable como DOCX, editable localmente y convertible a un PDF visualmente aceptado. Esta prueba
resuelve la elección del generador y del conversor antes de extenderlos a todos los formatos.

Después se integran persistencia, autenticación, permisos, SharePoint y el ciclo de revisiones; se
completan los módulos de captura y se valida el rendimiento del conjunto.

La validación pendiente comprende:

- Comparación visual del DOCX y PDF con los reportes originales aceptados, incluyendo formatos exigentes.
- Descarga, edición local, carga corregida y generación del PDF desde esa revisión.
- Conservación de ajustes manuales y detección de conflictos, sin pérdida silenciosa de cambios.
- Pruebas de permisos, recuperación de tareas e invalidación de caché.
- Carga representativa con 40 sesiones activas, incluyendo guardados, fotografías y solicitudes de
  documentos. Usar k6 para carga y Playwright para recorridos de interfaz.
- Medición del proceso completo, desde iniciar la captura hasta obtener el reporte listo para entregar,
  para comprobar la meta de 30 minutos o menos.
- Recuperación comprobada de datos y archivos relacionados desde sus respaldos.

El tamaño definitivo del servidor y los límites de procesamiento se elegirán con esos resultados.
Esta propuesta no constituye una prueba de capacidad ni una validación de fidelidad documental.

## Referencias técnicas

- [Endpoints y lógica de servidor de SvelteKit](https://svelte.dev/docs/kit/routing).
- [Integración de Supabase con ejecución en servidor](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
- [Autenticación de Supabase con Microsoft](https://supabase.com/docs/guides/auth/social-login/auth-azure).
- [Permisos seleccionados de Microsoft Graph](https://learn.microsoft.com/en-us/graph/permissions-selected-overview).
- [Generación documental con docx-templates](https://github.com/guigrpa/docx-templates).
- [Conversión mediante parámetros de LibreOffice](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html).
- [Supabase Queues](https://supabase.com/docs/guides/queues).
- [Gestión de conexiones de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits).
- [Estándar de caché HTTP](https://www.rfc-editor.org/rfc/rfc9111).
- [Escenarios de carga con k6](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/).

## Documentación relacionada

- [Contexto breve del proyecto](CONTEXTO_PROYECTO.md).
- [Historial de cambios y decisiones](../HISTORIAL.md).
