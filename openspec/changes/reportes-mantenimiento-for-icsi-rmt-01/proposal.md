# Proposal

## Why

Hoy cada reporte de mantenimiento se arma copiando un Word anterior y cambiando a mano el encabezado,
los alcances, las fotografías y las conclusiones. Se tardan unos 60 minutos por reporte y se repiten
errores de captura. El análisis de los 157 reportes de `insumos/` (Cerritos, Proagroindustrias y
Virtual) y del catálogo de alcances de Cerritos muestra que todos usan el mismo formato
`FOR-ICSI-RMT-01`, y que la mayor parte del contenido se puede tomar del catálogo de partidas del
contrato. Con eso es posible generar el reporte desde datos estructurados y acercarse a la meta de
30 minutos o menos.

Errores observados en los insumos que el sistema debe evitar:

- Un mismo sitio se escribe de cuatro formas distintas (`EM-30185 ÁREA VI`, `EM-30185 AREA VI`,
  `EM-30184 AREA VI` y `EM-30186 AREA VI`).
- Virtual reutiliza el número de contrato de Cerritos y un reporte conserva el texto
  `4500057477 (Cambiar)`.
- La carpeta `PARTIDA 08` de la ERM 30185 contiene archivos titulados «PARTIDA 13», porque se copiaron
  de la ERM 30184.
- En las tablas de verificación, la numeración de las ilustraciones aparece repetida o fuera de orden.
- Hay reportes con la fecha incompleta (`/ mayo / 2026`).

## What Changes

**Comportamiento actual comprobado:** la aplicación solo tiene el shell (barra lateral, encabezado y
tema). Las vistas de Planeación, Captura (Prosasa, Virtual y Proagro), Historial y Personal son
archivos vacíos. No hay backend, base de datos, modelo de datos ni generación documental. Además, la
ruta raíz importa una vista desde una ruta inexistente.

**Comportamiento propuesto:**

- Modelo de datos en PostgreSQL (Supabase) mantenido con migraciones SQL. Incluye clientes,
  contratos, sitios, catálogo de partidas con sus alcances, equipos/TAG, programa anual (programado
  frente a realizado por mes), personal firmante y reportes con sus alcances, fotografías,
  herramientas, tabla de verificación y conclusiones.
- Importación del `CATALOGO DE ALCANCES.xlsx`: tanto la hoja «PROGRAMA ANUAL 2026» como la de
  «Catálogo de Conceptos-ALCANCES». Proagro y Virtual tienen catálogo, pero todavía no se recibe: sus
  partidas se derivan de sus reportes, se marcan «por confirmar» y se reemplazan al importar el catálogo
  oficial.
- No existe un proyecto de Supabase, así que el esquema se crea desde cero.
- Vista de Planeación Anual: partidas del contrato por mes, con su avance programado/realizado, que se
  actualiza al emitir reportes.
- Captura guiada y común a los tres clientes: contrato → sitio → partida → (TAG) → periodo. Al elegir
  la partida se prellenan la periodicidad, el objetivo, los alcances, las herramientas, los firmantes y
  el texto base de las conclusiones. El usuario solo añade fotografías por alcance, estados,
  observaciones y ajustes. La tabla de verificación se puede añadir u omitir en cualquier reporte, sin
  importar el cliente. El menú de Captura ofrece Cerritos, Proagro y Virtual como accesos filtrados al
  mismo flujo.
- **Se elimina la vista Prosasa**, que pertenecía a un proyecto anterior que ya no existe.
- Generación del DOCX editable desde una plantilla Word `FOR-ICSI-RMT-01`, con encabezado, firmas,
  secciones numeradas, fotografías con pie «Ilustración n.m» y variantes de disposición (cuadrícula o
  antes/durante/después). El PDF queda como prueba de conversión, no como emisión definitiva.
- Historial de reportes con búsqueda por contrato, sitio, partida, periodo y estado.
- Corrección de las observaciones del shell que bloquean el desarrollo: rutas, propiedades de
  Sidebar, HeaderBar y prueba de página.
- Revisión independiente de cada fase con Codex CLI en modo de solo lectura, y corrección de los
  hallazgos con fundamento.

Fuera de alcance de este cambio, para cambios posteriores: autenticación y permisos con Microsoft
Entra ID, integración con SharePoint, el ciclo de revisiones del Word corregido, la cola de trabajos
y las pruebas de carga. Mientras no exista autenticación, la aplicación se usa solo en local.

## Capabilities

### New Capabilities

- `catalogo-contratos`: clientes, contratos, sitios, partidas con sus alcances, equipos/TAG y
  firmantes por contrato; importación desde Excel y normalización de nombres.
- `programa-anual`: programa de operación y mantenimiento por contrato y sitio, con cantidades
  programadas y realizadas por mes y el avance derivado de los reportes.
- `captura-reportes`: alta, prellenado, edición, autoguardado, validación y estados del reporte
  FOR-ICSI-RMT-01, incluidas las fotografías por alcance y la tabla de verificación.
- `generacion-documental`: generación del DOCX editable desde la plantilla, y conversión de prueba a
  PDF.

### Modified Capabilities

- Ninguna. `memoria-proyecto` no cambia sus requisitos.

## Impact

- Código: `src/routes/` (nuevas rutas por vista y endpoints `+server.ts`/`+page.server.ts`),
  `src/lib/components/views/`, `src/lib/components/fields/`, nuevo `src/lib/dominio/` (tipos y
  esquemas Zod) y nuevo `src/lib/server/` (repositorios, importador y generador).
- Datos: nuevo directorio `supabase/migrations/`. Las semillas no llevan datos personales; los
  firmantes se cargan desde la aplicación o desde un importador local que lee `insumos/`.
- Dependencias nuevas, en versión exacta: `@supabase/supabase-js`, `@supabase/ssr`, `zod`,
  `docx-templates`, un lector de `.xlsx` (`exceljs`) y `@electric-sql/pglite` (solo en desarrollo,
  para probar las migraciones sin Docker).
- Configuración: `.env.example` con las variables de Supabase. Los `.env` reales los aporta el
  usuario. `insumos/` y el almacenamiento local de fotos quedan en `.gitignore`.
- Externos: un proyecto de Supabase, que crea el usuario. LibreOffice queda como opcional para la
  prueba de PDF.
