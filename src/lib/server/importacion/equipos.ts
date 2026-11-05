// Lectura del Excel «Catálogo de equipos» (cambio catalogo-equipos-proyecto, D7). Las columnas se
// reconocen por su encabezado, no por su posición; las celdas combinadas (notas o proveedor de
// varios equipos) se repiten en cada fila y las filas vacías que separan grupos se omiten.
import {
	esquemaEquipoImportado,
	type EquipoImportado,
	type EstadoEquipo
} from '../../dominio/esquemas.ts';
import { intervaloDesdeTexto } from '../../dominio/equipos.ts';
import { ErrorImportacion } from './catalogo.ts';
import { fechaDeSerieExcel, leerLibro, valorEn, type Hoja, type ValorCelda } from './xlsx.ts';

type Campo =
	| 'tag'
	| 'tipo'
	| 'marcaModelo'
	| 'marca'
	| 'modelo'
	| 'numeroSerie'
	| 'rango'
	| 'resolucion'
	| 'clase'
	| 'ubicacion'
	| 'propietario'
	| 'responsable'
	| 'critico'
	| 'estado'
	| 'intervaloMeses'
	| 'ultimaCalibracion'
	| 'proximaCalibracion'
	| 'proveedor'
	| 'notas';

/** Encabezado normalizado (solo letras y cifras) → campo; se prueba con «empieza con». */
const ENCABEZADOS: [string, Campo][] = [
	['equipoid', 'tag'],
	['tag', 'tag'],
	['nombre', 'tipo'],
	['descripcion', 'tipo'],
	['marcamodelo', 'marcaModelo'],
	['marca', 'marca'],
	['modelo', 'modelo'],
	['nodeserie', 'numeroSerie'],
	['numerodeserie', 'numeroSerie'],
	['serie', 'numeroSerie'],
	['rango', 'rango'],
	['resolucion', 'resolucion'],
	['clase', 'clase'],
	['ubicacion', 'ubicacion'],
	['propietario', 'propietario'],
	['responsable', 'responsable'],
	['critico', 'critico'],
	['estado', 'estado'],
	['intervalo', 'intervaloMeses'],
	['frecuencia', 'intervaloMeses'],
	['ultima', 'ultimaCalibracion'],
	['proxima', 'proximaCalibracion'],
	['proveedor', 'proveedor'],
	['notas', 'notas'],
	['observaciones', 'notas']
];

const ESTADOS: Record<string, EstadoEquipo> = {
	'en servicio': 'en_servicio',
	operando: 'en_servicio',
	'fuera de servicio': 'fuera_de_servicio',
	'fuera de operacion': 'fuera_de_operacion',
	baja: 'baja',
	'dado de baja': 'baja'
};

const normalizar = (texto: string) =>
	texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const compacto = (texto: string) => normalizar(texto).replace(/[^a-z0-9]/g, '');

export interface LecturaEquipos {
	hoja: string;
	equipos: EquipoImportado[];
	/** Filas omitidas o datos no reconocidos, con su número de fila de Excel. */
	avisos: string[];
}

function campoDeEncabezado(valor: ValorCelda): Campo | null {
	if (typeof valor !== 'string') return null;
	const clave = compacto(valor);
	if (!clave) return null;
	return ENCABEZADOS.find(([prefijo]) => clave.startsWith(prefijo))?.[1] ?? null;
}

/** Fila de encabezados: la primera de las 15 iniciales que tenga «Equipo ID» (o «TAG»). */
function buscarEncabezados(hoja: Hoja): { fila: number; columnas: Map<Campo, number> } | null {
	for (let fila = 0; fila < Math.min(hoja.filas.length, 15); fila++) {
		const columnas = new Map<Campo, number>();
		(hoja.filas[fila] ?? []).forEach((valor, columna) => {
			const campo = campoDeEncabezado(valor);
			if (campo && !columnas.has(campo)) columnas.set(campo, columna);
		});
		if (columnas.has('tag') && columnas.size >= 3) return { fila, columnas };
	}
	return null;
}

/** Texto limpio: espacios simples; vacío, guiones o «N/A» dan null. */
function texto(valor: ValorCelda): string | null {
	if (valor === null) return null;
	if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
	const limpio = String(valor).replace(/\s+/g, ' ').trim();
	if (!limpio || /^[-–—]+$/.test(limpio) || /^n\/?a$/i.test(limpio)) return null;
	return limpio;
}

/** Fecha de Excel (número de serie) o «dd/mm/aaaa»; undefined si no se reconoce. */
function fecha(valor: ValorCelda): string | null | undefined {
	if (typeof valor === 'number') return fechaDeSerieExcel(valor);
	const limpio = texto(valor);
	if (limpio === null) return null;
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpio);
	if (iso) return limpio;
	const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(limpio);
	if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
	return undefined;
}

export async function leerExcelEquipos(datos: Uint8Array | ArrayBuffer): Promise<LecturaEquipos> {
	const hojas = await leerLibro(datos).catch(() => {
		throw new ErrorImportacion('El archivo no es un libro de Excel (.xlsx) válido.', '');
	});
	const encontrada = hojas
		.map((hoja) => ({ hoja, encabezados: buscarEncabezados(hoja) }))
		.find((h) => h.encabezados !== null);
	if (!encontrada?.encabezados) {
		throw new ErrorImportacion(
			'No se encontró la fila de encabezados con «Equipo ID». Use el formato del catálogo de equipos.',
			hojas[0]?.nombre ?? '',
			'Equipo ID'
		);
	}
	const { hoja } = encontrada;
	const { fila: filaEncabezados, columnas } = encontrada.encabezados;
	const equipos: EquipoImportado[] = [];
	const avisos: string[] = [];

	for (let fila = filaEncabezados + 1; fila < hoja.filas.length; fila++) {
		const numero = fila + 1;
		// Una fila vacía (sin contar celdas combinadas que vienen de otra fila) separa grupos.
		const propias = [...columnas.values()].map((c) => texto(hoja.filas[fila]?.[c] ?? null));
		if (propias.every((v) => v === null)) continue;

		const celda = (campo: Campo) => {
			const columna = columnas.get(campo);
			return columna === undefined ? null : valorEn(hoja, fila, columna);
		};
		const tag = texto(celda('tag'));
		const tipo = texto(celda('tipo'));
		if (!tag) {
			avisos.push(`Fila ${numero}: sin «Equipo ID»${tipo ? ` (${tipo})` : ''}; se omitió.`);
			continue;
		}

		let marca = texto(celda('marca'));
		let modelo = texto(celda('modelo'));
		const marcaModelo = texto(celda('marcaModelo'));
		if (marcaModelo && !marca && !modelo) {
			const barra = marcaModelo.indexOf('/');
			marca = barra === -1 ? marcaModelo : marcaModelo.slice(0, barra).trim() || null;
			modelo = barra === -1 ? null : marcaModelo.slice(barra + 1).trim() || null;
		}

		const textoEstado = texto(celda('estado'));
		let estado: EstadoEquipo = 'en_servicio';
		if (textoEstado) {
			const reconocido = ESTADOS[normalizar(textoEstado)];
			if (reconocido) estado = reconocido;
			else
				avisos.push(
					`Fila ${numero} (${tag}): estado «${textoEstado}» no reconocido; se dejó «En servicio».`
				);
		}

		const valorIntervalo = celda('intervaloMeses');
		let intervaloMeses = intervaloDesdeTexto(
			typeof valorIntervalo === 'number' ? valorIntervalo : texto(valorIntervalo)
		);
		if (intervaloMeses === undefined || (intervaloMeses !== null && intervaloMeses > 120)) {
			avisos.push(`Fila ${numero} (${tag}): intervalo «${texto(valorIntervalo)}» no reconocido.`);
			intervaloMeses = null;
		}

		const fechas = {} as Record<'ultimaCalibracion' | 'proximaCalibracion', string | null>;
		for (const campo of ['ultimaCalibracion', 'proximaCalibracion'] as const) {
			const valor = fecha(celda(campo));
			if (valor === undefined) {
				avisos.push(`Fila ${numero} (${tag}): fecha «${texto(celda(campo))}» no reconocida.`);
			}
			fechas[campo] = valor ?? null;
		}

		const critico = normalizar(texto(celda('critico')) ?? '');
		equipos.push(
			esquemaEquipoImportado.parse({
				fila: numero,
				tag,
				tipo,
				marca,
				modelo,
				numeroSerie: texto(celda('numeroSerie')),
				rango: texto(celda('rango')),
				resolucion: texto(celda('resolucion')),
				clase: texto(celda('clase')),
				ubicacion: texto(celda('ubicacion')),
				propietario: texto(celda('propietario')),
				responsable: texto(celda('responsable')),
				critico: ['si', 's', 'x', 'yes', '1', 'true', 'critico'].includes(critico),
				estado,
				intervaloMeses,
				...fechas,
				proveedor: texto(celda('proveedor')),
				notas: texto(celda('notas'))
			})
		);
	}
	return { hoja: hoja.nombre, equipos, avisos };
}
