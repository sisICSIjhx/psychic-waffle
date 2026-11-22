# Tasks

Rama `feat/kpi-seguimiento-centros`, compartida con otros cambios sin confirmar: solo se tocan los
archivos de este cambio. Sin migración y sin abrir `storage/pglite`. Ningún dato de `insumos/` entra
en archivos versionables, pruebas, specs ni historial.

## 1. Análisis del formato

- [x] 1.1 Abrir el libro original con JSZip sin cargar las fotos y medir la hoja de reporte, la hoja
      maestra, los estilos, las combinadas, la página y los dibujos. Verificado: 56 hojas (33
      visibles), rango `C1:P52`, carta horizontal ajustada a una página, hasta 8 fotos de 11 × 8.25 cm
      con círculo numerado y 1 934 cuadros de texto vacíos por hoja.

## 2. Plantilla

- [x] 2.1 Crear `src/lib/server/documentos/libro-xlsx.ts` (celdas, combinadas, alto de fila,
      geometría, anclas y partes del paquete).
- [x] 2.2 Crear `scripts/construir-plantilla-fotografico.ts` y el script `plantilla:fotografico`.
      Verificado: escribe `REPORTE-FOTOGRAFICO.v1.xlsx` (55 KB) con 17 rótulos y pasa la auditoría
      contra 202 textos del original.
- [x] 2.3 Empaquetar la plantilla en `src/lib/server/plantillas/vigente.ts` (`?inline`) e incluir
      `**/*.xlsx` en `vite.config.ts`. Verificado con la prueba que compara los bytes empaquetados.

## 3. Reglas y generador

- [x] 3.1 Crear `src/lib/dominio/tipos-documento.ts` (formato de descarga por tipo de documento).
- [x] 3.2 Crear `src/lib/dominio/reporte-fotografico.ts` (fechas, periodos, descripción, cuadrícula,
      reparto en hojas, nombres de hoja y nombre de archivo).
- [x] 3.3 Crear `src/lib/server/documentos/fotografico.ts` (`generarReporteFotografico` y
      `reporteFotograficoDe`), sin conectarlo a `ServicioCaptura` ni a rutas.
- [x] 3.4 Crear `scripts/prueba-fotografico.ts` y el script `prueba:fotografico` (muestra con datos
      ficticios en `storage/prueba-documental`).

## 4. Validación

- [x] 4.1 Pruebas `src/lib/dominio/reporte-fotografico.spec.ts` y
      `src/lib/server/documentos/fotografico.spec.ts` (proyecto `server`): plantilla sin datos, hojas,
      celdas, fórmulas con resultado, combinadas, anchos y página, fotos e imágenes, círculos,
      actividades en dos columnas, logotipo del cliente, textos con caracteres especiales y errores.
- [x] 4.2 Abrir la muestra en Microsoft Excel 365 con una instancia propia y en solo lectura.
      Verificado: abre sin reparar, 6 hojas, fórmulas resueltas, horizontal, una página por hoja y las
      formas esperadas; se revisó la imagen de tres hojas.
- [x] 4.3 `npm run check`, ESLint y Prettier de los archivos tocados, `npm run spec:check` y
      `npm run verificar:datos`.
- [x] 4.4 Comprobar que nada quedó conectado: sin cambios en `src/routes/` ni en componentes.

## 5. Registro

- [x] 5.1 Entrada en `HISTORIAL.md` y estado en `docs/CONTEXTO_PROYECTO.md`.

## 6. Pendiente de decisión del usuario (fuera de este cambio)

- [ ] 6.1 Resolver las decisiones de `design.md` (D10): datos de la estimación, importe y orden de
      compra, fotos por hoja, lista de actividades, firmas, logotipo del cliente y qué reportes entran.
- [ ] 6.2 Conectar el generador: entrada desde la base, ruta de descarga con el formato declarado,
      registro del libro y botón en la interfaz.
- [ ] 6.3 Comprobar el libro con fotos reales de un reporte y con LibreOffice o un visor web.
