# Tasks

Cada fase cierra con estos pasos:

1. Ejecutar `npm run check`, `npm run lint` y `npm run test`.
2. Hacer un commit en `feat/reportes-rmt-01`.
3. Ejecutar la revisión con Codex (`codex review --commit <sha>`).
4. Corregir los hallazgos (como máximo 2 rondas).
5. Dejar el resumen en `docs/revisiones/fase-N.md`.
6. Registrar la fase en `HISTORIAL.md`.

## 0. Preparación

- [x] 0.1 Crear la rama `feat/reportes-rmt-01` a partir de `main` y hacer un commit del estado actual
      de la documentación (HISTORIAL, CONTEXTO, PROPUESTA y `.gitignore` con `/insumos/`).
- [x] 0.2 Agregar `/storage/` a `.gitignore` y crear `.env.example` con `PUBLIC_SUPABASE_URL`,
      `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SOFFICE_PATH` y `STORAGE_DIR`.
- [x] 0.3 Crear `scripts/revision-codex.ps1`, que recibe el SHA y la fase, ejecuta `codex review` con
      instrucciones fijas (excluir `insumos/`, `storage/` y `.env*` salvo `.env.example`; reportar
      severidad, archivo y línea) y guarda la salida en el scratchpad.
- [x] 0.4 Probar el script con el commit 0.1 y verificar que no lee rutas excluidas.

## 1. Shell y navegación

- [ ] 1.1 Corregir la importación de `src/routes/+page.svelte` (`$lib/components/views/DashboardView.svelte`).
- [ ] 1.2 Crear las rutas `/planeacion`, `/captura`, `/historial`, `/catalogo`, `/personal` y `/perfil`,
      y alinear `routesByView` en `src/routes/+layout.svelte`.
- [ ] 1.3 Alinear las propiedades y eventos entre `+layout.svelte` y `src/lib/layout/Sidebar.svelte`
      (`activeView`/`isCollapsed`/`navigate`), y eliminar el duplicado `src/lib/components/Sidebar.svelte`
      tras comprobar que no se importa.
- [ ] 1.4 Corregir el atributo `style` mal ubicado en `HeaderBar.svelte`.
- [ ] 1.4.1 Eliminar la vista Prosasa: `ProsasaView.svelte`, su entrada en el menú de la barra lateral
      y en `routesByView`. Dejar el submenú de Captura con Cerritos, Proagro y Virtual, apuntando a
      `/captura?cliente=`, y retirar `ProagroView` y `VirtualView`, que están vacías, tras comprobar
      que nada más las importa.
- [ ] 1.5 Implementar `SelectField`, `DateField`, `NumberField` y `TextAreaField` con el patrón de
      `TextField`.
- [ ] 1.6 Actualizar `src/routes/page.svelte.spec.ts` y agregar una prueba de navegación entre vistas.
- [ ] 1.7 Validación y revisión con Codex de la fase 1.

## 2. Prueba documental (riesgo principal, antes de la captura)

- [ ] 2.1 Construir `FOR-ICSI-RMT-01.v1.docx` a partir de cualquier reporte real, ya que todos
      comparten el mismo diseño. Limpiar el contenido,
      conservar logotipos, encabezado y pie, y añadir marcadores de campos y bloques repetidos. La
      plantilla se sanea (sin propiedades de autor, comentarios, revisiones, customXml ni nombres) y
      una auditoría automatizada del paquete lo comprueba.
- [ ] 2.2 Implementar en `src/lib/dominio/` las reglas puras, con pruebas: título, numeración
      «Ilustración 2.n.m», agrupación de fotos por disposición y nombre de archivo (sin TAG, con uno o
      con varios).
- [ ] 2.3 Implementar `src/lib/server/documentos/generar.ts` con `docx-templates` y la preparación de
      imágenes con `sharp`.
- [ ] 2.4 Crear `scripts/prueba-documental.ts`, que genera 3 reportes desde datos JSON de ejemplo:
      cuadrícula con verificación (manómetros), antes/durante/después (PSV) y un reporte con más de
      70 fotos. Los JSON llevan firmantes ficticios; las fotos se toman de `insumos/` solo en local.
- [ ] 2.5 Agregar una prueba automatizada: el DOCX se abre, no conserva marcadores sin resolver,
      respeta el orden de las secciones y numera según tenga o no verificación.
- [ ] 2.6 Convertir a PDF con LibreOffice, si está instalado, y comparar visualmente con los
      originales. Dejar las capturas de la comparación para la revisión del usuario.
- [ ] 2.7 Validación y revisión con Codex de la fase 2. **Punto de control:** se presentan los 3 DOCX al
      usuario antes de cerrar la plantilla v1.

## 3. Modelo de datos y repositorios

- [ ] 3.1 Escribir `supabase/migrations/0001_catalogo.sql`: clientes, contratos, sitios, partidas,
      alcances, herramientas, equipos y firmantes, con sus restricciones `unique` y la normalización
      de la clave de sitio.
- [ ] 3.2 Escribir `0002_programa.sql`: programas, meses, realizados manuales (con `registrado_en`) y la vista de
      realizado.
- [ ] 3.3 Escribir `0003_reportes.sql`: reportes, alcances, fotos, herramientas, equipos, documentos
      generados, columna `version`, estados, revisiones (`revision`, `sustituye_a`) y `orden` en `reporte_equipos`.
- [ ] 3.4 Escribir `0004_rls.sql`: RLS habilitado con la política de servicio.
- [ ] 3.5 Crear en `src/lib/dominio/` los tipos y esquemas Zod de cada entidad.
- [ ] 3.6 Crear los repositorios `catalogo`, `programa` y `reportes` en `src/lib/server/repositorios/`,
      con sus implementaciones PGlite y Supabase.
- [ ] 3.7 Agregar pruebas del servidor sobre PGlite: unicidad de sitio y partida, cálculo del realizado
      y conflicto de versión.
- [ ] 3.8 (Depende del usuario) El usuario crea el proyecto de Supabase, que aún no existe, y llena
      `.env` siguiendo `.env.example`. Después se aplican las migraciones y se prueba la conexión.
      Este paso no bloquea las fases 4 a 6, que trabajan con PGlite.
- [ ] 3.9 Validación y revisión con Codex de la fase 3.

## 4. Catálogo e importación

- [ ] 4.1 Implementar el importador de `CATALOGO DE ALCANCES.xlsx`: búsqueda de cabeceras, agrupación
      de viñetas, clasificación en alcance, nota o norma, y el programa P/R.
- [ ] 4.2 Agregar pruebas del importador con un `.xlsx` sintético versionado, sin datos personales:
      estructura válida, columnas faltantes e idempotencia.
- [ ] 4.3 Crear la vista `/catalogo`: contratos, sitios, partidas con edición de alcances, objetivo,
      herramientas, conclusiones, disposición de fotos, equipos/TAG y firmantes.
- [ ] 4.4 Implementar la importación desde la interfaz con ensayo previo y confirmación, y el script
      `npm run importar`.
- [ ] 4.5 Importar el catálogo de Cerritos en local. Derivar las partidas de Proagro y Virtual desde
      sus reportes, marcadas «por confirmar». Agregar en `/catalogo` el filtro y la acción de
      confirmar, y permitir reemplazarlas al importar el catálogo oficial.
- [ ] 4.6 Validación y revisión con Codex de la fase 4.

## 5. Captura de reportes

- [ ] 5.1 Crear `/captura`: selección guiada de contrato, sitio, partida, periodo y TAG, con el filtro
      `?cliente=`, conectada al submenú de Cerritos, Proagro y Virtual.
- [ ] 5.2 Implementar el prellenado desde el catálogo y el contrato, con la copia de firmantes.
- [ ] 5.3 Crear el editor `/reportes/[id]`: encabezado, alcances editables y reordenables,
      herramientas y conclusiones, más un interruptor «Incluir tabla de verificación» disponible en
      cualquier cliente (el valor inicial lo da la partida, y se pide confirmación al desactivarlo con
      estados ya capturados).
- [ ] 5.4 Implementar la carga múltiple de fotos por alcance: validación de formato y tamaño,
      reordenamiento con renumeración y espacios antes/durante/después.
- [ ] 5.5 Implementar el autoguardado con espera y la detección de conflictos de versión.
- [ ] 5.6 Implementar las validaciones para enviar a revisión y los estados Borrador → En revisión →
      Emitido.
- [ ] 5.7 Agregar el endpoint de generación y descarga del DOCX desde el reporte, y registrarlo en
      `documentos_generados`.
- [ ] 5.8 Agregar pruebas de componentes (`*.svelte.spec.ts`) del editor y una prueba de recorrido
      completo: crear, capturar, emitir y descargar.
- [ ] 5.9 Validación y revisión con Codex de la fase 5.

## 6. Planeación anual e historial

- [ ] 6.1 Crear la vista `/planeacion`: matriz P/R por mes, filtros, pendientes vencidos y acceso a
      la captura desde una celda.
- [ ] 6.2 Crear la vista `/historial`: paginación, filtros, apertura y descarga.
- [ ] 6.3 Mostrar en el panel de control los indicadores del mes: programado, realizado, pendientes y
      borradores.
- [ ] 6.4 Agregar pruebas de la vista de realizado y de los filtros.
- [ ] 6.5 Validación y revisión con Codex de la fase 6.

## 7. Cierre

- [ ] 7.1 Medir con el usuario el tiempo de elaboración de un reporte real de principio a fin, frente
      a la meta de 30 minutos.
- [ ] 7.2 Actualizar `docs/CONTEXTO_PROYECTO.md`: arquitectura, rutas, estado y el nuevo repositorio
      Git.
- [ ] 7.3 Registrar los resultados y pendientes en `HISTORIAL.md`: autenticación, SharePoint, ciclo de
      revisiones y despliegue.
- [ ] 7.4 Ejecutar `npm run spec:check` y preparar el archivado del cambio.
