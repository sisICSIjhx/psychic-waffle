# Design

## Context

La base se usa solo mediante funciones `api_*` (jsonb → jsonb) en PGlite y Supabase. El proyecto es
el cliente (D1 de `alcances-personal-esquema-bd`) y los sitios se ligan al cliente por sus contratos
(`contrato_sitios`). El Excel de referencia tiene 17 columnas: Equipo ID, Nombre, Marca/Modelo, No.
de serie, Rango, Resolución, Clase/Tolerancia, Ubicación, Propietario, Responsable, Crítico, Estado,
Intervalo (meses), Última calibración/verificación, Próxima calibración/verificación, Proveedor y
Notas; separa grupos con filas vacías y combina celdas de notas y proveedor en varias filas.

## Decisions

### D1. Ampliar `equipos`, no crear otra tabla

El TAG de partidas y reportes ya sale de `equipos`. Una segunda tabla duplicaría el catálogo y
obligaría a sincronizarlas. Columnas nuevas: `resolucion`, `clase`, `ubicacion`, `propietario`,
`responsable`, `critico`, `estado`, `intervalo_meses`, `ultima_calibracion`, `proxima_calibracion`,
`proveedor` y `notas`. «Nombre» del Excel es el `tipo` existente.

### D2. Equipos del proyecto = equipos de los sitios de sus contratos

`api_listar_equipos_proyecto` reúne los equipos de los sitios asociados a algún contrato del
cliente, con la clave y el nombre del sitio. El alta exige un sitio del proyecto.

### D3. TAG único por sitio y nombre

El Excel usa `E-LIT-1704` para el transmisor y para el indicador magnético del mismo lazo. La
restricción pasa de `(sitio, TAG)` a `(sitio, TAG, nombre)` con la misma normalización. El aviso de
duplicado conserva el motivo `equipo_duplicado`.

### D4. Guardado parcial

`api_guardar_equipo` actualiza solo los campos presentes en la carga. Así, la ficha del contrato
(que envía TAG, tipo, marca, modelo, rango y serie) no borra los datos de calibración.

### D5. Intervalo en meses y próxima calibración

Se guarda `intervalo_meses` (entero de 1 a 120). Los textos del Excel se traducen: mensual 1,
bimestral 2, trimestral 3, cuatrimestral 4, semestral 6, anual 12, «C/N AÑOS» N × 12 y números
directos. La próxima fecha es la capturada; si falta, se calcula como última + intervalo y se marca
«calculada». Estado de calibración con la fecha de hoy en America/Mexico_City: vencida, por vencer
(30 días o menos), vigente o sin fecha. Los equipos dados de baja no cuentan en los indicadores.

### D6. Estados

`en_servicio` (En servicio), `fuera_de_servicio` (Fuera de servicio), `fuera_de_operacion` (Fuera de
operación) y `baja` (Dado de baja). Eliminar solo se permite si el equipo no está en partidas ni
reportes.

### D7. Importación con revisión

Encabezados por nombre normalizado (sin depender del orden); filas vacías omitidas; celdas
combinadas repetidas en cada fila; «Marca/Modelo» separado en la primera « / »; «---», «N/A» y
vacíos como nulo; «sí» marca crítico. Filas sin Equipo ID se omiten con aviso. Se empareja por
sitio, TAG y nombre: existentes se actualizan, nuevos se crean. «Revisar» ejecuta un ensayo sin
escribir; «Importar» aplica todo en una sola función (atómica).

### D8. Exportación CSV en el navegador

Como la matriz del programa anual, «Exportar CSV» arma en el navegador un CSV UTF-8 con BOM con las
filas visibles (respeta búsqueda y filtros): el sitio y las columnas del Excel, con fechas
dd/mm/aaaa y el intervalo por su nombre.

### D9. Filtro de calibración sin dados de baja

Los indicadores no cuentan los equipos dados de baja; el filtro por calibración tampoco los muestra,
salvo que se filtre además por el estado «Dado de baja», para que la cifra y la lista coincidan.

## Risks / Trade-offs

- La columna «Responsable» es un nombre de persona: queda en la base (como los firmantes), nunca en
  semillas, pruebas ni historial.
- Cambiar la unicidad permite el mismo TAG con nombres distintos en un sitio; el reporte muestra el
  TAG tal cual, que es lo que el cliente usa.
