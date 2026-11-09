# Optimización, seguridad y propuestas de mejora

Fecha: 2026-11-05. Rama `feat/optimizacion-seguridad`, a partir de `main`.

Este documento reúne tres cosas:

1. Las mejoras de velocidad que se aplicaron, con mediciones de antes y después.
2. Las correcciones de seguridad que se aplicaron y los riesgos que siguen abiertos.
3. Diez propuestas de mejora para el funcionamiento y el desarrollo de la aplicación.

Clasificación según la política de AGENTS.md: nivel 2. Son optimizaciones y endurecimiento sin
cambios de datos, de contratos `api_*` ni de las reglas del documento. Las comprobaciones de permisos
que se agregaron aplican la regla D10 que ya existía (`puedeEditarCatalogo`) a acciones que no la
tenían. Por eso no se abrió un cambio de OpenSpec.

---

## 1. Mejoras de velocidad

### 1.1 Resultado medido

**JavaScript que descarga el navegador por página.** Build de producción, primera visita sin caché y
tamaño ya descomprimido. Se midió con Chromium sobre `vite preview`, comparando la versión anterior
con la nueva.

| Página         | Antes  | Después | Reducción |
| -------------- | ------ | ------- | --------- |
| `/` Mi trabajo | 431 KB | 131 KB  | −70 %     |
| `/planeacion`  | 612 KB | 212 KB  | −65 %     |
| `/captura`     | 550 KB | 150 KB  | −73 %     |
| `/historial`   | 433 KB | 133 KB  | −69 %     |
| `/catalogo`    | 423 KB | 123 KB  | −71 %     |
| `/equipos`     | 551 KB | 151 KB  | −73 %     |
| `/personal`    | 427 KB | 127 KB  | −70 %     |

Antes, el archivo de animación `calendar.json` se pedía en cada página (11 veces en el recorrido de
prueba). Ahora se pide una sola vez, cuando el cursor pasa por el enlace.

**Generación del DOCX.** Reporte de 48 fotos en 8 alcances, mediana de las corridas en caliente.

| Caso                                      | Antes                | Después                                     |
| ----------------------------------------- | -------------------- | ------------------------------------------- |
| Sin fotos giradas                         | ~540 ms              | ~400 ms (−25 %)                             |
| Con 8 fotos giradas, primera generación   | ~1 000 ms            | ~850 ms (−15 %)                             |
| Con 8 fotos giradas, versiones siguientes | ~1 000 ms            | ~400 ms (−60 %; la girada ya está guardada) |
| Descarga tras enviar a revisión o emitir  | se genera al pedirla | ya está generado; se lee del disco          |

**El contenido del reporte no cambió.** Con los mismos datos, las 80 partes del DOCX nuevo son
idénticas byte a byte a las del anterior: XML, índice, imágenes y fuentes. Los dos PDF que genera
LibreOffice tienen 11 páginas y el mismo tamaño. El índice conserva los números de página calculados
(`[3,3,3,4,5,6,7,8,9,10,11,11,12]`) y las fotos giradas tienen los mismos bytes que antes; una
prueba automática lo comprueba.

### 1.2 Cambios en el navegador (carga de páginas)

| #   | Cambio                                                                                                                                                                                                                                                                                                                                                | Archivos                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| V1  | **Zod ya no se descarga en el navegador** (~100 KB). Las constantes del dominio (`ESTADOS_EQUIPO`, `MOTIVOS_AJUSTE`, `ROLES_PERSONAL`…) pasaron a `constantes.ts`, que no depende de Zod. `esquemas.ts` las reexporta, así que el servidor y las importaciones existentes siguen igual. Los componentes las importan desde `$lib/dominio/constantes`. | `src/lib/dominio/constantes.ts` (nuevo), `esquemas.ts`, 6 componentes |
| V2  | **Lottie diferido y en su versión ligera.** El reproductor (antes 307 KB y cargado en cada página al montar el menú) se descarga con la primera intención: cursor o foco en el enlace. Se usa `lottie_light` (170 KB, solo SVG y sin expresiones), suficiente para `calendar.json`. Mientras carga se ve el SVG de respaldo.                          | `src/lib/components/ui/IconoAnimado.svelte`                           |
| V3  | **Precarga de las fuentes latinas** (Inter y Manrope). El texto no espera a que se procese el CSS. Usan la misma URL con hash que el `@font-face`, así que no se descargan dos veces.                                                                                                                                                                 | `src/routes/+layout.svelte`                                           |

### 1.3 Cambios en el servidor (respuesta de las páginas)

| #   | Cambio                                                                                                                                                                                                                                                                                                                                                                                         | Archivos                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| V4  | **Consultas independientes en paralelo.** En «Mi trabajo», los sitios y los totales se piden al mismo tiempo que los programas. En la captura, los borradores. En el editor, el estado del catálogo y el del contrato. Con Supabase, cada consulta es un viaje de red, así que se ahorra latencia. Los errores de las promesas adelantadas se marcan como manejados para no tumbar el proceso. | `src/routes/+page.server.ts`, `captura/+page.server.ts`, `reportes/[id]/+page.server.ts`                     |
| V5  | **Fotos del editor sin leer el reporte completo cada vez.** Antes, cada miniatura consultaba el reporte entero en la base: 48 fotos eran 48 consultas. Ahora se consulta una sola vez y se recuerdan sus fotos, con un tope de 5 000. Esto es seguro porque la ruta de un archivo no cambia: cada carga tiene su propio id.                                                                    | `src/lib/server/captura.ts` (`fotoDelReporte`, `leerArchivoFoto`), `reportes/[id]/fotos/[fotoId]/+server.ts` |
| V6  | **ETag y 304 en las fotos.** Si el navegador ya tiene la foto, se responde sin cuerpo. La pertenencia de la foto al reporte se valida antes de responder.                                                                                                                                                                                                                                      | `reportes/[id]/fotos/[fotoId]/+server.ts`                                                                    |
| V7  | **Respuestas sin copiar memoria y con `Content-Length`.** El DOCX y las fotos se envían sobre el mismo búfer que se leyó del disco, sin una copia extra. El navegador además muestra el avance de la descarga.                                                                                                                                                                                 | `src/lib/server/http.ts` (nuevo), rutas de documento y fotos                                                 |

### 1.4 Cambios en la generación y descarga del DOCX

| #   | Cambio                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Archivos                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1  | **`noSandbox` en docx-templates.** El perfil de CPU mostró ~160 ms por documento en `vm.createContext`: la biblioteca crea un contexto de Node para cada comando de la plantilla. Los comandos son los de la plantilla versionada, que es código de confianza, y los datos del usuario solo se insertan como texto; nunca se evalúan. El documento resultante es idéntico. **Regla que se debe conservar:** nunca aceptar plantillas subidas por usuarios mientras esta opción esté activa. | `src/lib/server/documentos/generar.ts`                                 |
| D2  | **Fotos giradas guardadas.** Al generar un documento con una foto girada, se guarda la optimizada ya girada (`<uuid>-g90.jpg`), producida con el mismo perfil del generador y por lo tanto con los mismos bytes. Las versiones siguientes la reutilizan. Se borra junto con los demás archivos de la foto.                                                                                                                                                                                  | `src/lib/server/captura.ts` (`rutaGirada`, `fotoDocumento`, `limpiar`) |
| D3  | **Lectura de fotos en paralelo** (8 a la vez) al armar el documento, conservando el orden. Antes se leían una por una.                                                                                                                                                                                                                                                                                                                                                                      | `captura.ts` (`documentoDe`)                                           |
| D4  | **Una sola generación para descargas simultáneas.** Si dos peticiones piden el mismo reporte, la segunda espera la generación en curso en lugar de repetirla, siempre que siga siendo de la versión vigente. Esto también evita que se registren dos documentos.                                                                                                                                                                                                                            | `captura.ts` (`generarDocumento`)                                      |
| D5  | **Precalentado al enviar a revisión o emitir.** En ese momento el contenido queda fijo, así que el DOCX se genera en segundo plano y la descarga lo encuentra listo.                                                                                                                                                                                                                                                                                                                        | `captura.ts` (`precalentarDocumento`), `reportes/[id]/+page.server.ts` |

Descartado tras medirlo: empaquetar el DOCX sin volver a comprimir los JPEG. JSZip toma el nivel 0
como «nivel por omisión» (6) y el resultado era más lento. Se conservó el empaquetado original, que ya
reutiliza los datos comprimidos de la plantilla y de las imágenes.

---

## 2. Seguridad

### 2.1 Correcciones aplicadas

| #   | Hallazgo                                                                                                                                                                                                                                                                                          | Severidad      | Corrección                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Dependencias con vulnerabilidades conocidas**: `@sveltejs/kit`, `devalue` (serialización de datos al navegador), `svelte`, `vite`, `rollup`, `postcss`, `ws`, `nanoid`, `picomatch` y otras. En total eran 27 (3 críticas y 13 altas).                                                          | Alta           | `npm audit fix` sin cambios mayores, solo en el lockfile: kit 2.70.3, svelte 5.57.3, vite 7.3.7, devalue 5.9.4. Quedan 0 altas. Las críticas restantes son de `vitest` (ver 2.2).                                                                                                                                                                                                                                                                 |
| S2  | **No había política de seguridad de contenido (CSP).** Un XSS podía cargar scripts externos o exfiltrar datos.                                                                                                                                                                                    | Alta           | `kit.csp` en `svelte.config.js`: solo recursos propios, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri` y `form-action` propios. El script del tema de `app.html` se permite por su hash, que se calcula al cargar la configuración, así que no puede desfasarse. No se usa `unsafe-inline` ni `unsafe-eval` en scripts. Verificado en el navegador (build y modo desarrollo): ninguna violación en las 10 rutas ni al animar el icono. |
| S3  | **Faltaban encabezados de seguridad.**                                                                                                                                                                                                                                                            | Media          | `src/hooks.server.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` y `Cross-Origin-Resource-Policy`, `X-Robots-Tag: noindex` y HSTS solo sobre HTTPS. También funciona en respuestas con encabezados inmutables.                                                                                                                               |
| S4  | **Acciones del catálogo sin comprobación de permisos.** `guardarEquipo`, `confirmarPartida`, `importarEnsayo`, `importarAplicar` (contrato) y `guardar` (partida) no llamaban a `puedeEditarCatalogo`. Hoy todo el mundo puede editar, pero al activar la autenticación habrían quedado abiertas. | Alta (latente) | Se agregó la comprobación (403 con mensaje), igual que en el resto de acciones del catálogo.                                                                                                                                                                                                                                                                                                                                                      |
| S5  | **Ids de la URL sin validar en rutas que tocan archivos.** El id del reporte forma parte de la ruta de las fotos en disco. `AlmacenamientoLocal` ya filtraba `..`, pero no había una validación previa.                                                                                           | Media          | `esUuid` en `cargarFotos`, en la ruta del documento (404) y en `fotoDelReporte`. Una prueba confirma que se rechaza `../../etc`.                                                                                                                                                                                                                                                                                                                  |
| S6  | **`Content-Disposition` armado con un nombre que viene de la base.** Unas comillas o un salto de línea podían romper el encabezado.                                                                                                                                                               | Baja           | `disposicionAdjunto` quita caracteres de control, comillas y barras, y agrega `filename*` codificado (RFC 6266/5987) para conservar los acentos.                                                                                                                                                                                                                                                                                                  |
| S7  | **Carga de fotos sin tope de archivos por petición.** Una petición podía meter cientos de archivos en memoria.                                                                                                                                                                                    | Media          | Tope de 20 por petición (413). El editor sube una por una, así que no le afecta.                                                                                                                                                                                                                                                                                                                                                                  |
| S8  | **Excel sin protección contra «bombas zip»**, y sin tope de tamaño en `/equipos`.                                                                                                                                                                                                                 | Media          | `/equipos` rechaza archivos de más de 10 MB, como ya hacía la importación del contrato. `leerLibro` rechaza paquetes que declaran más de 200 MB descomprimidos antes de descomprimirlos.                                                                                                                                                                                                                                                          |
| S9  | **Errores inesperados sin correlación.**                                                                                                                                                                                                                                                          | Baja           | `handleError` registra el error en el servidor con un id corto y al navegador solo le envía un mensaje genérico en español junto con ese id.                                                                                                                                                                                                                                                                                                      |

### 2.2 Riesgos abiertos (requieren decisión o trabajo aparte)

1. **No hay autenticación.** Es el riesgo principal. Cualquiera con acceso de red al servidor puede
   ver y editar reportes, catálogo y personal, y descargar fotos y documentos. Mientras no exista,
   **no se debe publicar la aplicación en Internet**: solo en la red interna o detrás de una VPN. Ver
   la propuesta 1. Cuando llegue, la ruta de fotos debe autorizar el acceso al reporte antes de usar
   la caché `fotoDelReporte` (está anotado en el código).
2. **`vitest` y `@vitest/browser` críticos** (herramientas de prueba; no llegan a producción). La
   versión corregida (4.1.12) tiene un conflicto de dependencias de pares con
   `@vitest/browser-playwright`. Pendiente: actualizar las tres juntas
   (`vitest`, `@vitest/browser-playwright` y `vitest-browser-svelte`) cuando lo permitan. Mientras
   tanto, no exponer el modo navegador de Vitest fuera de la máquina local.
3. **Bajas que piden una versión mayor** (`@sveltejs/kit` 3, `adapter-auto` 8, `cookie`): conviene
   planear la migración a SvelteKit 3.
4. **Sin límite de peticiones (rate limiting).** Conviene ponerlo en el proxy inverso del despliegue
   (propuesta 3).
5. **`BODY_SIZE_LIMIT`** al desplegar con `adapter-node`: ≥ 16 MB, como ya está anotado en el
   contexto.
6. `vite preview` responde `Access-Control-Allow-Origin: *`. Solo ocurre en la vista previa local, no
   en producción.

---

## 3. Diez propuestas de mejora

Están ordenadas por impacto en la meta del producto (bajar el reporte de unos 60 a 30 minutos o
menos) y por riesgo. El esfuerzo es orientativo: bajo es menos de 1 día, medio de 2 a 5 días y alto
más de una semana.

### 1. Autenticación con Microsoft y permisos por proyecto

- **Para qué:** cerrar el riesgo principal de 2.2 y saber quién elaboró cada reporte.
- **Qué incluye:** Supabase Auth con Microsoft Entra ID (las cuentas que ya usa la empresa). En
  `hooks.server.ts`, llenar `locals.autenticacion` y `locals.usuario`; las reglas de `permisos.ts` ya
  lo esperan. RLS por proyecto con `personal_proyectos`. El rol «reporteador» solo genera reportes. La
  bitácora toma el usuario de la sesión.
- **Esfuerzo / nivel:** alto, nivel 3 (OpenSpec).

### 2. Integración continua en GitHub Actions

- **Para qué:** que ningún cambio llegue a `main` sin pasar las mismas pruebas que se corren a mano, y
  detectar vulnerabilidades nuevas sin depender de alguien que se acuerde.
- **Qué incluye:** un flujo con `npm ci`, `npm run check`, `npm run lint`, `npm run test` (Chromium de
  Playwright en caché), `npm run verificar:datos`, la comprobación de que `esquema_completo.sql` está
  al día y `npm audit --omit=dev`. Dependabot o Renovate semanal para las dependencias, y escaneo de
  secretos.
- **Esfuerzo / nivel:** bajo, nivel 1.

### 3. Despliegue de producción con `adapter-node`, compresión y caché

- **Para qué:** hoy `adapter-auto` no produce un servidor para ningún destino. Con un despliegue
  propio, la carga inicial baja otro 60-70 % gracias a la compresión.
- **Qué incluye:** `adapter-node` con `precompress: true` (Brotli y gzip de los estáticos). Proxy
  inverso (Caddy o nginx) con HTTP/2, TLS, `Cache-Control: immutable` para `/_app/immutable/`, límite
  de peticiones y `BODY_SIZE_LIMIT=16M`. Un `Dockerfile` con LibreOffice para el PDF, un endpoint
  `/salud` y reinicio automático.
- **Esfuerzo / nivel:** medio, nivel 2.

### 4. Generación de documentos fuera del hilo principal, con cola y PDF automático

- **Para qué:** con alrededor de 40 usuarios, generar DOCX (≈0,4-1 s de CPU) y convertir a PDF
  (varios segundos) bloquea al resto mientras ocurre.
- **Qué incluye:** generación en `worker_threads` (un grupo de 2 a 4 hilos) con la deduplicación que
  ya existe. Una cola para la conversión a PDF con LibreOffice (`pdf.ts` ya existe), un botón
  «Descargar PDF» y el PDF guardado por versión, igual que el DOCX.
- **Esfuerzo / nivel:** medio, nivel 2.

### 5. Fotos comprimidas en el navegador antes de subirlas

- **Para qué:** una foto de celular pesa de 3 a 15 MB, pero la optimizada pesa unos 200 KB. Con la
  conexión de un sitio en campo, subir 40 fotos tarda minutos. Comprimirlas antes de subirlas reduce
  el envío unas 10 veces.
- **Qué incluye:** redimensionar a 1600 px con `createImageBitmap` y `OffscreenCanvas` en un Web
  Worker, y respetar la orientación EXIF. El original se sube después, en segundo plano, si se quiere
  conservar. Reintentos automáticos y subida de 2 o 3 fotos a la vez. HEIC sigue en el servidor
  cuando el navegador no lo decodifica.
- **Esfuerzo / nivel:** medio, nivel 2.

### 6. «Copiar del reporte anterior» y descripciones sugeridas

- **Para qué:** la mayoría de los reportes repiten la partida del mes anterior. Reutilizar el texto
  ahorra la mayor parte de la captura.
- **Qué incluye:** al crear un reporte, ofrecer los textos del último emitido de la misma partida
  (introducción, descripciones por alcance, conclusiones y herramientas) sin copiar las fotos. Para
  los pies de foto, autocompletar con las descripciones usadas en esa partida.
- **Esfuerzo / nivel:** medio, nivel 2 (con OpenSpec si se decide qué se copia).

### 7. Vista previa del documento y del índice antes de emitir

- **Para qué:** detectar antes de emitir una foto mal girada, un alcance sin evidencia o un índice
  que no cuadra, sin abrir Word.
- **Qué incluye:** generar el PDF de la versión vigente (propuesta 4) y mostrar sus páginas en el
  editor, con el índice calculado (`paginacion.ts`) junto a cada título. Avisos previos que hoy solo
  aparecen al enviar a revisión.
- **Esfuerzo / nivel:** medio, nivel 2.

### 8. Medición del tiempo real de elaboración y de la aplicación

- **Para qué:** el pendiente principal del contexto es medir el tiempo real de un reporte (meta de 30
  minutos). Hoy no hay datos.
- **Qué incluye:** registrar automáticamente el tiempo activo de edición por reporte, desde crear
  hasta enviar a revisión y descontando las pausas, y mostrarlo en un tablero. En el servidor, el
  encabezado `Server-Timing` (base, generación DOCX, fotos) y registros estructurados en JSON con el
  id de error de `handleError`.
- **Esfuerzo / nivel:** medio, nivel 2.

### 9. Respaldos automáticos y restauración probada

- **Para qué:** las fotos y los documentos emitidos son evidencia contractual; perderlos no tiene
  arreglo.
- **Qué incluye:** un `npm run respaldo` con un volcado de la base (PGlite o `pg_dump` de Supabase) y
  una copia de `storage/` con fecha y retención (7 diarios y 4 semanales). Un `npm run restaurar`
  probado sobre una base vacía y una verificación mensual automática. Con SharePoint, aprovechar su
  versionado.
- **Esfuerzo / nivel:** bajo a medio, nivel 2.

### 10. Avisos y recordatorios en «Mi trabajo» y por correo

- **Para qué:** que nada venza sin que alguien se entere.
- **Qué incluye:** calibraciones vencidas o por vencer (el módulo «Equipos» ya lo calcula), partidas
  vencidas del programa, borradores sin cambios en más de 3 días y reportes en revisión esperando
  emisión. Un resumen semanal por correo con Microsoft Graph, una vez que exista la autenticación.
- **Esfuerzo / nivel:** medio, nivel 2.

### Orden sugerido

2 → 3 → 1 → 5 → 6 → 4 → 7 → 8 → 9 → 10. La integración continua y el despliegue son baratos y
protegen todo lo demás. La autenticación es requisito para publicar. Las propuestas 5 y 6 son las que
más acercan a la meta de 30 minutos.

---

## Validación realizada

- `npm run check`: 0 errores y 0 avisos.
- `npm run lint`: sin observaciones. Se excluyó `.claude/skills/**` de ESLint; son scripts de
  terceros versionados que ya hacían fallar el comando antes de este cambio.
- `npm run test`: proyecto server con 44 archivos y 330 pruebas; proyecto client con 18 archivos y
  118 pruebas. Todas correctas: 62 archivos y 448 pruebas. El proyecto client se ejecutó con el
  Chromium preinstalado del entorno mediante una configuración temporal no versionada.
- Pruebas nuevas:
  - Foto girada con los mismos bytes y su reutilización.
  - Descargas simultáneas con una sola generación.
  - Precalentado.
  - Fotos servidas con una sola consulta y solo las del reporte.
  - Id no UUID rechazado.
  - `Content-Disposition` seguro.
  - Encabezados de seguridad (con HSTS y respuestas inmutables).
  - Bomba zip.
- En el navegador (Chromium) sobre la build de producción y el modo desarrollo: 10 rutas con
  respuesta 200, sin violaciones de CSP ni errores de consola (salvo `favicon.ico`, que no existe
  desde antes), animación del menú funcionando y navegación del lado del cliente correcta.
- DOCX de 48 fotos: idéntico byte a byte al de la versión anterior y el mismo PDF en LibreOffice.
