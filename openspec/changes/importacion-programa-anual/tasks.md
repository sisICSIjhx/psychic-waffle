# Tasks

Primer cambio del orden de octubre de 2026 (`fechas-ejecucion-multiples` se apila después, en
`feat/fechas-multiples`). Migración reservada: `supabase/migrations/0015_importar_programa.sql`; no se
usa otro número. Las pruebas usan solo libros sintéticos con datos ficticios. El Excel real se queda
en `insumos/` y solo se lee con scripts fuera del repositorio. Ningún archivo versionado lleva nombres
de personas ni de reportes.

## 1. Rama y punto de partida

- [ ] 1.1 Crear la rama `feat/programa-anual` a partir de `feat/ux-fase-c` y comprobar con
      `npm run test` que todo pasa antes de cambiar nada.

## 2. Lectura del libro

- [ ] 2.1 Agregar `columnasOcultas` y `filasOcultas` (`Set<number>`, base 0) a `Hoja` en
      `src/lib/server/importacion/xlsx.ts`, leídos de `<col hidden="1">` y `<row hidden="1">` (D2).
      Verificar en `importacion.spec.ts` con un libro que tenga un rango `min`-`max` oculto y una fila
      oculta, y que las pruebas actuales del catálogo siguen pasando.
- [ ] 2.2 Agregar `crearProgramaSintetico` a `src/lib/server/importacion/libro-sintetico.ts`, con datos
      ficticios: una hoja sin «PROGRAMA» en el nombre, cabecera combinada sin texto, meses sin año
      combinados por semanas, columnas ocultas, título «PROGRAMA ANUAL AAAA», dos bloques con
      separadora «(ERM nnnnn)», rellenos gris, blanco y rojo, y filas R. Verificar que `leerLibro` lo
      lee y que `npm run verificar:datos` pasa.

## 3. Analizador de programa (`src/lib/server/importacion/programa.ts`)

- [ ] 3.1 Implementar `tipoDeLibro(hojas)` (D1) y verificar con pruebas que el catálogo sintético
      actual es «catalogo», que el programa sintético es «programa» y que otro libro se rechaza
      describiendo las dos estructuras.
- [ ] 3.2 Implementar la fila de meses, el año, los rangos combinados, la exclusión de meses ocultos y
      el periodo (D3). Verificar con pruebas: meses sin año con título, cambio de año en enero, último
      mes sin combinar con el ancho del anterior, marca en la última columna del último mes, año dado
      por opción, año desconocido y meses no consecutivos rechazados.
- [ ] 3.3 Implementar los bloques por sitio (D4) y verificar con pruebas: segundo bloque por su
      separadora, primer bloque por la clave del encabezado, sitio sin bloque (el mensaje nombra los
      bloques del libro), libro sin claves, filas sin sitio y número repetido dentro del bloque
      rechazados.
- [ ] 3.4 Implementar las columnas por cabecera o por posición (D5) y verificar con pruebas: cabecera
      con texto, cabecera combinada sin texto, columna con valores de otro tipo y periodicidad no
      reconocida rechazadas con su hoja, fila y columna.
- [ ] 3.5 Implementar las marcas, las cantidades por mes, la fila R y `actividadSinPeriodicidad`
      (D6). Verificar con pruebas: semanal por marcas, mensual, diaria, «Cuando aplique» sin meses,
      relleno blanco sin marca, «.» ignorado con advertencia, dos marcas en un mes de una mensual,
      realizados de la fila R y actividades con «(SEMANAL).», «(MENSUAL)», «, MENSUAL», « MENSUAL.» y
      un paréntesis interno que se conserva («TIPO "R" (PROTECCION CATODICA) MENSUAL.»).
- [ ] 3.6 Generar las advertencias del libro (suma distinta de la cantidad anual, meses sin marca en
      una mensual, fila en rojo, R sin P, marcas en columnas ocultas y filas ocultas), con sitio,
      partida, mes y fila. Verificar con una prueba por cada tipo.
- [ ] 3.7 Con un script fuera del repositorio, comprobar `analizarProgramaAnual` contra
      `insumos/PROAGROINDUSTRIAS/PROGRAMA ANUAL 2026 PROAGROS 1.xlsx`. Por sitio deben coincidir el
      periodo (2026-03-01 a 2027-02-28), el número de partidas, el total programado y las diferencias
      de la tabla de D12. Anotar el resultado para `HISTORIAL.md`.

## 4. Último mes del catálogo

- [ ] 4.1 Corregir el rango del último mes en `analizarPrograma` (`catalogo.ts:262-266`) según D11.
      Verificar en `importacion.spec.ts` dos casos: una mensual con la marca en la 3.ª columna de un
      último mes combinado en 4 suma 12, y un último mes sin combinar toma el ancho del anterior. Las
      pruebas actuales del catálogo deben seguir pasando.

## 5. Función SQL, repositorio y advertencias

- [ ] 5.1 Crear `supabase/migrations/0015_importar_programa.sql` con `api_importar_programa` (D7) y el
      bloque de permisos de 0009. Verificar en `src/lib/server/repositorios/repositorios.spec.ts`
      sobre PGlite:
  - el ensayo no escribe, el programa se crea y la reimportación queda sin cambios;
  - solo cambian la periodicidad y la cantidad anual, sin tocar alcances, entregas, requisitos,
    materiales, notas, normas, distribución ni estado del catálogo;
  - `usarActividad` y `confirmar` funcionan, y la partida nueva queda «por confirmar»;
  - las R importadas se reemplazan y las manuales se conservan;
  - `noIncluidas` y `tieneReportes` vienen en la respuesta;
  - el programa superpuesto y el sitio de otro contrato devuelven IC422;
  - una partida inválida no deja cambios.
- [ ] 5.2 Agregar `importarPrograma(carga, ensayo)` a `src/lib/server/repositorios/programa.ts`, con su
      esquema Zod de respuesta. Verificar con la prueba de 5.1 que la respuesta se valida, y con
      `npm run check`.
- [ ] 5.3 Implementar `advertenciasDelEnsayo` (D8): vigencia que no contiene el periodo, con los meses
      fuera, y cambio de periodicidad en partidas con reportes. Verificar con pruebas que el caso de
      Proagro (vigencia 2026-05-01 a 2027-04-30) advierte marzo y abril de 2026, y que una vigencia
      igual al periodo no advierte.
- [ ] 5.4 Guardar en `src/lib/server/importacion/temporal.ts` el `tipo` de la carga pendiente.
      Verificar con una prueba que una carga de programa se recupera con su tipo y que una carga
      guardada sin `tipo` se trata como catálogo.

## 6. Interfaz de importación en el contrato

- [ ] 6.1 Hacer que `importarEnsayo` e `importarAplicar` (`src/routes/catalogo/contratos/[id]/+page.server.ts`)
      decidan por tipo de libro (D9) y que el programa use el bloque del sitio elegido. Verificar con
      `npm run check` y en el navegador dos cosas: un libro de programa sintético se ensaya y se aplica,
      y el catálogo sintético sigue usando el resumen actual.
- [ ] 6.2 Crear `src/lib/components/catalogo/ResumenPrograma.svelte` (sintaxis heredada) y
      `ResumenPrograma.svelte.spec.ts`. El componente muestra periodo, acción del programa, totales,
      «antes → después» de periodicidad y cantidad, total programado, realizados, «por confirmar»,
      advertencias generales y por partida, y partidas no incluidas; sin cambios no ofrece «Aplicar».
      Verificar con pruebas de componente, incluido que la acción se lee como texto y no solo por
      color.
- [ ] 6.3 Renombrar la sección de `ContratoView.svelte` a «Importar catálogo o programa desde Excel»
      con la nota de los dos formatos y mostrar `ResumenPrograma` cuando `form.tipo === 'programa'`.
      Verificar en el navegador que el ensayo caducado muestra el mensaje actual y no guarda nada.

## 7. Línea de comandos

- [ ] 7.1 Implementar en `programa.ts`, como funciones puras, el análisis de `--periodicidad <n>=<valor>`
      y `--usar-actividad <n[,n…]>`, la aplicación de esos ajustes a la carga y la validación de
      `--ajustar-vigencia` (contiene el periodo, sin reportes ni programas fuera). Verificar con
      pruebas: periodicidad inválida, número fuera del bloque y vigencia que deja fuera un reporte o
      no contiene el programa.
- [ ] 7.2 Agregar `--programa` y sus opciones a `scripts/importar-catalogo.ts` (D10): ensayo por
      omisión, incompatibilidad con `--crear` y el texto de uso de las líneas 3-8. Verificar ejecutando
      el ensayo del libro de Proagro sobre una copia temporal de la base (`STORAGE_DIR` apuntando a una
      carpeta fuera del repositorio): imprime el resumen y las advertencias y no cambia la copia.

## 8. Carga del programa de Proagro en la base de desarrollo

- [ ] 8.1 Detener el servidor de desarrollo y copiar `storage/pglite` a una carpeta fechada fuera del
      repositorio. Verificar que la copia tiene los mismos archivos y el mismo tamaño. Al abrir la
      base, se aplicará la migración 0015.
- [ ] 8.2 Ensayar la carga completa sobre otra copia (`STORAGE_DIR` temporal):
  - EM-30184 con `--programa --ajustar-vigencia 2026-03-01:2027-02-28 --usar-actividad 22`;
  - EM-30185 con `--programa --periodicidad 25=cuatrimestral`.

  Hacer primero el ensayo y luego `--aplicar`. Verificar contra D12: partidas, total programado,
  diferencias, el realizado de 30184-14 en junio, la vigencia nueva, la actividad de la 30184-22 y la
  30185-25 «por confirmar», cuatrimestral, con cantidad 3. Una segunda ejecución debe informar «sin
  cambios».

- [ ] 8.3 Repetir 8.2 sobre `storage/pglite`, con el servidor todavía detenido: primero EM-30184 y
      luego EM-30185, cada uno con su ensayo antes de `--aplicar`. Verificar que los resúmenes coinciden
      con los de la copia.
- [ ] 8.4 Iniciar el servidor y verificar con un GET a `/planeacion/__data.json?contrato=<id>&sitio=<id>`
      de cada sitio, con un script fuera del repositorio:
  - el programa vigente va del 2026-03-01 al 2027-02-28, con 12 meses;
  - por partida, la suma de los meses coincide con la cantidad anual, salvo las diferencias de D12;
  - 30184-14 tiene 1 realizado sin reporte en junio;
  - 30185-25 está programada en abril, agosto y diciembre.

  Con otro GET, a `/captura?cliente=…`, verificar que la captura ofrece desde marzo de 2026.

## 9. Cierre

- [ ] 9.1 Ejecutar `npm run check`, `npm run lint` y `npm run test` sin errores.
- [ ] 9.2 Validar en el navegador a 1366 × 800, en tema claro y oscuro, el ensayo y el resumen en
      `/catalogo/contratos/[id]` y la planeación de EM-30184 y EM-30185. Comprobar contraste AA, foco
      visible y que no hay desborde horizontal (la tabla del resumen se desplaza dentro de su
      contenedor). Guardar las capturas fuera del repositorio.
- [ ] 9.3 Hacer commit (sin push) y ejecutar `scripts/revision-codex.ps1` con
      `-Cambio 'el cambio OpenSpec importacion-programa-anual'`, `-Base` (último commit de
      `feat/ux-fase-c`), `-Sha` (último commit del cambio), `-Fase programa-anual`, `-Ronda` y como
      `-ArchivosContexto` `proposal.md`, `design.md`, `tasks.md` y las specs de este cambio. Hacer como
      máximo 2 rondas, corregir lo que proceda y registrar los
      hallazgos y su resolución en `docs/revisiones/importacion-programa-anual.md`.
- [ ] 9.4 Agregar la entrada en `HISTORIAL.md` con fecha local, motivo, alcance, archivos, validación
      real, resultado de 3.7, 4.1 y 8.x y los ajustes de la carga: vigencia anterior → nueva, actividad
      de la 30184-22 y la 30185-25. Anotar como pendientes el «.» de la 30185-2, el número provisional
      del contrato y los 78 reportes Word sin cargar. Verificar que no contiene datos personales.
- [ ] 9.5 Actualizar `docs/CONTEXTO_PROYECTO.md`: migraciones `0001…0015`, importación de programa
      (interfaz y `npm run importar -- --programa`), Proagro con programa 2026-03 a 2027-02 y estado
      del cambio. Ejecutar `npm run graph:sync` y verificar el formato con `npx prettier --check` sobre
      los documentos tocados.

## Workflow follow-up

- Archivar el cambio cuando el usuario lo apruebe, junto con `reportes-mantenimiento-for-icsi-rmt-01`
  y `ux-editor-inicio-captura` o después de ellos, porque comparten las capacidades `programa-anual` y
  `catalogo-contratos`.
- Continuar con `fechas-ejecucion-multiples` en `feat/fechas-multiples`, apilada sobre
  `feat/programa-anual`.
