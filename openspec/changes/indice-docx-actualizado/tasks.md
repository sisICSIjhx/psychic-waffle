# Tasks

Rama `feat/indice-docx`, apilada sobre `feat/fechas-multiples` (cambio `fechas-ejecucion-multiples`).
Este cambio no tiene migración reservada ni toca la base: no hace falta detener el servidor de
desarrollo ni respaldar `storage/pglite`. El arnés con Word (D9) solo corre en Windows con Microsoft
Word 365 y escribe en `storage/verificacion-indice/` (ignorado). Ningún archivo de fuente entra al
repositorio, y no se escriben datos personales en las pruebas, los resultados de Word ni el historial.

## 1. Rama y punto de partida

- [x] 1.1 Crear la rama `feat/indice-docx` a partir de `feat/fechas-multiples`. Verificar que el cambio 2
      está terminado (`fechasEncabezado` existe en `src/lib/dominio/documento.ts`) y que
      `npm run check`, `npm run lint` y `npm run test` pasan antes de cambiar nada.
- [x] 1.2 Respaldar fuera del repositorio los prototipos de la carpeta `indice-docx\` del análisis.
      Resolver con el usuario las preguntas abiertas de `design.md`: tabla de Open Sans para la portada,
      y descarga autorizada de Arimo o Liberation Sans (Regular y Bold) desde su fuente oficial a una
      carpeta fuera del repositorio. Verificar que `git status` no muestra archivos de fuente.

## 2. Reportes sintéticos y arnés con Word (desarrollo)

- [x] 2.1 Crear `src/lib/server/documentos/sinteticos.ts` (D9) y verificar con `sinteticos.spec.ts` que:
      la misma semilla da los mismos datos; hay semillas con de 1 a 14 alcances, de 1 a 12 TAG, nombres
      largos, fechas de uno y varios días y títulos de hasta 183 caracteres; el vocabulario sale de
      `scripts/datos-prueba`.
- [x] 2.2 Crear `scripts/paginas-word.ps1` (D9). Verificar con los 3 documentos de prueba, generados
      con fotos de relleno y la v1 sin `updateFields`, que da 9, 16 y 16 páginas y las páginas de
      títulos del análisis: prueba-1 3,3,3,3,4,6,7,8,8,9,9; prueba-2
      3,3,3,4,5,6,7,8,9,10,11,12,13,14,15,16; prueba-3 3,3,3,5,7,9,11,13,16,16. Si alguna página
      difiere porque el cambio 2 pasó `scripts/datos-prueba/*.json` a días de ejecución (por ejemplo
      «15, 16, 20-25» en `postes-volumen-alto.json`), anotar la diferencia y tomar como referencia la
      medición de Word. Verificar también que al terminar no queda ningún proceso `WINWORD` iniciado por
      el arnés.
- [x] 2.3 Crear `scripts/verificar-indice-word.ts` y el script `verificar:indice` en `package.json`
      (generación, medición, resultados y modo `-- <docx…>`). Verificar que fuera de Windows o sin Word
      termina con un mensaje claro y código distinto de 0. Medir las semillas 1-104 y los 3 de prueba con
      la v1 sin `updateFields` y guardar `src/lib/server/documentos/calibracion/paginas-word.v1.json`.

## 3. Anchos de las fuentes

- [x] 3.1 Crear `scripts/extraer-anchos-fuentes.ts` (D4) y generar
      `src/lib/server/documentos/anchos-fuentes.ts`: Arial normal y negrita desde Arimo o Liberation;
      Aptos normal y cursiva desde la caché local de Office; Open Sans normal y negrita si el usuario lo
      confirmó. Verificar que dos ejecuciones dan un archivo idéntico, que el encabezado dice el origen y
      la licencia de cada fuente y que solo hay números.
- [x] 3.2 Agregar `anchos-fuentes.spec.ts` y verificar: «M» = 1706, «a» = 1139 y el espacio = 569 de
      2048 en Arial normal; los interlineados 2355/2048 (Arial) y 2500/2048 (Aptos); la cobertura total
      de los caracteres de `scripts/datos-prueba` y del vocabulario sintético; el ancho promedio para un
      carácter fuera de la tabla.

## 4. Modelo de paginación

- [x] 4.1 Crear `src/lib/server/documentos/paginacion.ts` con `GEOMETRIA_V2` y `renglones` (R2 y R5 de
      D3). Verificar con `paginacion.spec.ts` que los renglones por párrafo coinciden con
      `paginas-word.v1.json` en al menos el 99 % de los párrafos (objetivo 100 %, como los 193 de 193
      del análisis). Decidir con esa prueba si se conservan los pares de kerning (D4).
- [x] 4.2 Agregar `bloquesDelModelo` y `paginar` con R1 y R3-R9. Verificar con `paginacion.spec.ts` la
      paridad con el prototipo contra `paginas-word.v1.json`, con el salto forzado desactivado: 100 % de
      entradas en las semillas 1-24, al menos 99 % en 25-64 y al menos 36 de 37 en los 3 de prueba.
- [x] 4.3 Agregar las páginas de la portada y del índice (D5), con la tabla de Open Sans si se confirmó.
      Verificar con `paginacion.spec.ts` que las semillas con portada o índice de 2 páginas dan la página
      inicial del cuerpo que midió Word.
- [x] 4.4 Agregar el salto forzado (D6) con `ε` en `GEOMETRIA_V2`. Verificar con pruebas que un título
      con holgura de +0,2 pt o de −0,2 pt queda marcado y en la página siguiente, y que uno con holgura
      mayor que `ε` no se marca.
- [x] 4.5 Agregar `entradaPaginacion(datos)` (D2) y conservar la medida en cm de cada celda en
      `prepararAlcances`. Verificar con una prueba que las entradas del modelo usan los mismos textos
      saneados, los pies «Ilustración 2.n.m», la fecha de varios días formada en la portada y las alturas
      de foto que recibe `createReport`.

## 5. Plantilla v2

- [x] 5.1 Cambiar `scripts/construir-plantilla.ts` (D8): destino `FOR-ICSI-RMT-01.v2.docx`, sin
      `updateFields` (comprobar que no queda) y control del índice con el título y el párrafo de reserva.
      Ejecutarlo en local con el reporte fuente de la v1 (`insumos/`). Verificar que `auditarPaquete` no
      da hallazgos y que `npm run verificar:datos` no da coincidencias.
- [x] 5.2 Comparar las partes de la v1 y la v2 y verificar que solo difieren `word/settings.xml` y el
      control del índice. Después retirar la v1 y actualizar `vigente.ts`, la ruta y
      `VERSION_PLANTILLA = 'FOR-ICSI-RMT-01.v2'` de `generar.ts`, `generar.spec.ts` y el comentario de
      `scripts/prueba-documental.ts`. Verificar con la prueba de la plantilla v2 (sin `updateFields`,
      con `removePersonalInformation`, control del índice con reserva) y con la prueba de geometría de D3.

## 6. Índice en el documento

- [x] 6.1 Crear `src/lib/server/documentos/indice.ts` con `escribirIndice` (D7) y verificar con
      `indice.spec.ts`: un marcador `_Toc` por título; una entrada con hipervínculo y `PAGEREF` por
      título, con la estructura de los originales; campos balanceados; ninguna referencia sin marcador;
      identificadores sin colisión; `pageBreakBefore` en el orden del esquema; error si no cuadran los
      títulos o si aparece `updateFields` o `w:dirty`.
- [x] 6.2 Integrar el cálculo y `escribirIndice` en `generarDocx` y quitar `indice.alcances`. Verificar
      con `generar.spec.ts`: sin `updateFields` (se invierte 334-336) ni `w:dirty`; páginas iguales a
      las del modelo; reporte con y sin verificación; `versionPlantilla` v2; `auditarPaquete` sin
      hallazgos. Verificar también que `src/lib/server/importacion/reporte-docx.spec.ts` pasa sin
      cambios. Medir y anotar el tiempo del posproceso en los 3 documentos (objetivo: menos de 0,5 s
      adicionales en el de 74 fotos).
- [x] 6.3 Verificar con `src/lib/server/captura.spec.ts` que un DOCX v1 registrado para la versión
      vigente de un reporte emitido no se reutiliza, que se genera y registra uno v2 sin cambiar el estado
      ni la versión del reporte, y que la segunda descarga reutiliza el v2.

## 7. Precisión con Word

- [x] 7.1 Ejecutar `npm run verificar:indice` sobre la v2 (semillas 1-104 y los 3 de prueba) y guardar
      `src/lib/server/documentos/calibracion/paginas-word.v2.json`. Verificar los criterios de D10: al
      menos 99 % de entradas exactas en el conjunto y en 25-104; los 3 de prueba exactos, con el índice
      guardado igual al actualizado; ninguna diferencia mayor de una página. Si no se cumplen, ajustar el
      modelo o `ε` y repetir; no se cierra el cambio sin cumplirlos.
- [x] 7.2 Hacer que `paginacion.spec.ts` compruebe los mismos criterios sin Word, a partir de
      `paginas-word.v2.json` y de `sinteticos.ts`. Verificar que falla si la versión del archivo no es
      `VERSION_PLANTILLA`.
- [x] 7.3 Generar los 3 documentos con `npm run prueba:documental` (con las fotos de `insumos/` si
      existen) y pasarlos por `npm run verificar:indice -- <docx…>`. Verificar que el índice guardado es
      igual al actualizado. Abrirlos en Word visible y confirmar que no aparece el aviso, que Ctrl+clic
      lleva a cada título y que el índice se ve como el de los originales. Guardar las capturas fuera del
      repositorio.

## 8. Cierre

- [x] 8.1 Ejecutar `npm run check`, `npm run lint` y `npm run test` sin errores.
- [x] 8.2 Validar en el navegador a 1366 × 800, en tema claro y oscuro, con el servidor de desarrollo
      (sin migración que aplicar): «Descargar DOCX» del editor entrega un documento v2 que abre en Word
      sin aviso; el editor no cambia, mantiene el contraste AA y no tiene desborde horizontal. Guardar
      las capturas fuera del repositorio.
- [x] 8.3 Hacer commit y ejecutar `scripts/revision-codex.ps1` con `-Cambio` (el cambio OpenSpec
      `indice-docx-actualizado`), `-Base` (último commit de `feat/fechas-multiples`), `-Sha` (último
      commit del cambio), `-Fase indice-docx`, `-Ronda` y como `-ArchivosContexto` los
      artefactos de este cambio, como máximo en 2 rondas. Registrar los hallazgos y su resolución en
      `docs/revisiones/indice-docx-actualizado.md`.
- [x] 8.4 Agregar la entrada en `HISTORIAL.md`, sin datos personales: la decisión de la fase 2 que se
      revierte, la precisión medida (calibración, validación, semillas nuevas y documentos de prueba),
      `ε`, la versión de Word usada y los pendientes. Verificar los enlaces y el formato con
      `npm run lint`.
- [x] 8.5 Actualizar `docs/CONTEXTO_PROYECTO.md`: plantilla v2, `paginacion.ts` e `indice.ts` en la fila
      «Documento DOCX», `npm run verificar:indice` (solo Windows con Word) en los scripts y el estado
      del cambio. Verificar el formato con `npm run lint`.

## Workflow follow-up

- El cambio `editor-fotos` debe agregar el giro a `sinteticos.ts`, volver a correr
  `npm run verificar:indice` y cumplir los criterios de D10 (`design.md`, D11).
- Archivar el cambio cuando el usuario lo apruebe, después de archivar o junto con
  `reportes-mantenimiento-for-icsi-rmt-01`.
