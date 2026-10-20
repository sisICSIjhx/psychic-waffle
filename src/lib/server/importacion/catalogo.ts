// Análisis del libro «CATALOGO DE ALCANCES.xlsx»: hoja del programa anual (partidas, cantidades y
// meses marcados P/R) y hoja del catálogo de conceptos (alcances, entregas, requisitos y
// materiales). Las cabeceras se buscan por su texto, no por coordenadas fijas.
import { diasDelMes, MESES } from '../../dominio/documento.ts';
import type { PERIODICIDADES } from '../../dominio/esquemas.ts';
import { normalizarParaComparar } from '../documentos/auditoria.ts';
import { esRellenoMarcado, leerLibro, valorEn, type Hoja, type ValorCelda } from './xlsx.ts';

export type Periodicidad = (typeof PERIODICIDADES)[number];
export type TipoAlcance = 'alcance' | 'nota' | 'norma';

export interface PartidaImportada {
	numero: string;
	actividad: string;
	/** El libro no trae descripción de partida; si se agrega, la importación la actualizará. */
	descripcion?: string | null;
	distribucion: 'produccion' | 'mantenimiento' | null;
	periodicidad: Periodicidad;
	cantidadAnual: number | null;
	entrega: string | null;
	entregaOma: string | null;
	entregaPropuesta: string | null;
	requiereOdm: boolean;
	requierePt: boolean;
	requiereAst: boolean;
	materialesPor: 'icsi' | 'cliente' | null;
	reportesHomologados: string | null;
	alcances: { tipo: TipoAlcance; texto: string }[];
	/** Meses marcados en la fila P, con la cantidad programada de cada uno. */
	meses: { mes: string; cantidad: number }[];
	/** Meses marcados en la fila R. */
	realizados: { mes: string; cantidad: number }[];
}

export interface FirmantePropuesto {
	funcion: string;
	nombre: string;
	cargo: string;
	empresa: string;
}

export interface CatalogoImportado {
	usuario: string | null;
	estacion: string | null;
	programa: { periodoInicio: string; periodoFin: string } | null;
	partidas: PartidaImportada[];
	/** Nombres que trae la hoja: solo se proponen; el usuario decide si los registra. */
	firmantesPropuestos: FirmantePropuesto[];
	advertencias: string[];
}

/** Error de estructura del libro: indica la hoja y, si aplica, la columna faltante. */
export class ErrorImportacion extends Error {
	readonly hoja: string;
	readonly columna: string | null;

	constructor(mensaje: string, hoja: string, columna: string | null = null) {
		super(mensaje);
		this.name = 'ErrorImportacion';
		this.hoja = hoja;
		this.columna = columna;
	}
}

const normalizar = (valor: ValorCelda | undefined) =>
	normalizarParaComparar(String(valor ?? '')).toUpperCase();

const texto = (valor: ValorCelda | undefined) =>
	valor === null || valor === undefined ? '' : String(valor).replace(/\s+/g, ' ').trim();

const PERIODICIDAD_POR_TEXTO: Record<string, Periodicidad> = {
	DIARIO: 'diaria',
	DIARIA: 'diaria',
	SEMANAL: 'semanal',
	QUINCENAL: 'quincenal',
	MENSUAL: 'mensual',
	BIMESTRAL: 'bimestral',
	TRIMESTRAL: 'trimestral',
	CUATRIMESTRAL: 'cuatrimestral',
	SEMESTRAL: 'semestral',
	ANUAL: 'anual',
	'CUANDO APLIQUE': 'cuando_aplique',
	'SEGUN REQUERIMIENTO': 'cuando_aplique'
};

export function periodicidadDeTexto(valor: ValorCelda | undefined): Periodicidad | null {
	return PERIODICIDAD_POR_TEXTO[normalizar(valor)] ?? null;
}

/** «·», «•» o «-» al inicio: alcance ejecutable; «Nota»: nota; normas y referencias: norma. */
export function clasificarLinea(linea: string): { tipo: TipoAlcance; texto: string } | null {
	const limpia = linea.replace(/\s+/g, ' ').trim();
	if (!limpia) return null;
	const vineta = /^[·•▪\-–]\s*/.exec(limpia);
	const sinVineta = limpia.slice(vineta?.[0].length ?? 0).trim();
	if (!sinVineta) return null;
	const comparable = normalizar(sinVineta);
	if (/^NOTA\b/.test(comparable)) return { tipo: 'nota', texto: sinVineta };
	if (/\bNOM-|\bNORMA\b|^CONTROL DE\b|\bNRF-|\bISO\s?\d/.test(comparable)) {
		return { tipo: 'norma', texto: sinVineta };
	}
	return { tipo: vineta ? 'alcance' : 'nota', texto: sinVineta };
}

/** Lunes del mes: semanas que inician en él (52 o 53 al año). */
function lunesDelMes(anio: number, mes: number): number {
	let cuenta = 0;
	for (let dia = 1; dia <= diasDelMes(anio, mes); dia++) {
		if (new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay() === 1) cuenta++;
	}
	return cuenta;
}

/** Cantidad programada en un mes marcado según la periodicidad. */
export function cantidadDelMes(periodicidad: Periodicidad, mesIso: string): number | null {
	const [anio, mes] = mesIso.split('-').map(Number);
	switch (periodicidad) {
		case 'cuando_aplique':
			return null;
		case 'diaria':
			return diasDelMes(anio, mes);
		case 'semanal':
			return lunesDelMes(anio, mes);
		case 'quincenal':
			return 2;
		default:
			return 1;
	}
}

interface Columnas {
	[clave: string]: number;
}

/** Busca en las primeras filas la que contiene todas las cabeceras requeridas. */
function ubicarCabeceras(
	hoja: Hoja,
	requeridas: Record<string, (t: string) => boolean>,
	opcionales: Record<string, (t: string) => boolean> = {}
): { fila: number; columnas: Columnas } {
	let mejor = { fila: -1, encontradas: -1, columnas: {} as Columnas };
	const limite = Math.min(hoja.filas.length, 40);
	for (let fila = 0; fila < limite; fila++) {
		const celdas = hoja.filas[fila] ?? [];
		const columnas: Columnas = {};
		for (const [clave, coincide] of Object.entries({ ...requeridas, ...opcionales })) {
			const indice = celdas.findIndex(
				(v) => v !== null && v !== undefined && coincide(normalizar(v))
			);
			if (indice !== -1) columnas[clave] = indice;
		}
		const encontradas = Object.keys(requeridas).filter((c) => c in columnas).length;
		if (encontradas > mejor.encontradas) mejor = { fila, encontradas, columnas };
	}
	const faltante = Object.keys(requeridas).find((c) => !(c in mejor.columnas));
	if (faltante) {
		throw new ErrorImportacion(
			`La hoja «${hoja.nombre}» no tiene la columna «${faltante}»`,
			hoja.nombre,
			faltante
		);
	}
	return { fila: mejor.fila, columnas: mejor.columnas };
}

const es = (esperado: string) => (t: string) => t === esperado;
const empieza = (prefijo: string) => (t: string) => t.startsWith(prefijo);

function buscarHoja(hojas: Hoja[], prueba: (nombre: string) => boolean, descripcion: string): Hoja {
	const hoja = hojas.find((h) => prueba(normalizar(h.nombre)));
	if (!hoja) throw new ErrorImportacion(`El libro no tiene la hoja ${descripcion}`, descripcion);
	return hoja;
}

const MESES_NORMALIZADOS = MESES.map((m) => normalizarParaComparar(m).toUpperCase());

/** «MAYO 2026» → «2026-05-01». */
function mesDeTexto(valor: ValorCelda | undefined): string | null {
	const coincidencia = /^([A-Z]+)\s+(\d{4})$/.exec(normalizar(valor));
	if (!coincidencia) return null;
	const indice = MESES_NORMALIZADOS.indexOf(coincidencia[1]);
	return indice === -1 ? null : `${coincidencia[2]}-${String(indice + 1).padStart(2, '0')}-01`;
}

/** «PERIODO: 01 DE MAYO DE 2026 AL 30 DE ABRIL DE 2027». */
function periodoDeTexto(valor: string): { periodoInicio: string; periodoFin: string } | null {
	const fecha = '(\\d{1,2}) DE ([A-Z]+) DE (\\d{4})';
	const coincidencia = new RegExp(`${fecha} AL ${fecha}`).exec(
		normalizarParaComparar(valor).toUpperCase()
	);
	if (!coincidencia) return null;
	const iso = (dia: string, mes: string, anio: string) => {
		const indice = MESES_NORMALIZADOS.indexOf(mes);
		return indice === -1
			? null
			: `${anio}-${String(indice + 1).padStart(2, '0')}-${dia.padStart(2, '0')}`;
	};
	const inicio = iso(coincidencia[1], coincidencia[2], coincidencia[3]);
	const fin = iso(coincidencia[4], coincidencia[5], coincidencia[6]);
	return inicio && fin ? { periodoInicio: inicio, periodoFin: fin } : null;
}

interface FilaPrograma {
	numero: string;
	actividad: string;
	periodicidad: Periodicidad | null;
	textoPeriodicidad: string;
	cantidadAnual: number | null;
	distribucion: string;
	/** Meses marcados en las filas P y R; las cantidades se calculan con la periodicidad final. */
	mesesMarcados: string[];
	realizadosMarcados: string[];
}

function analizarPrograma(hoja: Hoja, advertencias: string[]) {
	const { fila: filaCabecera, columnas } = ubicarCabeceras(
		hoja,
		{
			PARTIDA: es('PARTIDA'),
			ACTIVIDAD: es('ACTIVIDAD'),
			PERIODICIDAD: es('PERIODICIDAD'),
			CANTIDAD: es('CANTIDAD'),
			'P/R': es('P/R')
		},
		{ DISTRIBUCION: es('DISTRIBUCION'), PERIODO: empieza('PERIODO') }
	);

	// Fila de meses: la primera, bajo las cabeceras, con al menos dos celdas «MES AAAA».
	let filaMeses = -1;
	const columnasMes: { columna: number; mes: string }[] = [];
	for (let fila = filaCabecera; fila < Math.min(filaCabecera + 4, hoja.filas.length); fila++) {
		const encontrados = (hoja.filas[fila] ?? [])
			.map((v, columna) => ({ columna, mes: mesDeTexto(v) }))
			.filter((c): c is { columna: number; mes: string } => c.mes !== null);
		if (encontrados.length >= 2) {
			filaMeses = fila;
			columnasMes.push(...encontrados);
			break;
		}
	}
	if (filaMeses === -1) {
		throw new ErrorImportacion(
			`La hoja «${hoja.nombre}» no tiene la fila de meses del programa`,
			hoja.nombre,
			'MESES'
		);
	}

	const textoPeriodo =
		columnas.PERIODO !== undefined ? texto(hoja.filas[filaCabecera][columnas.PERIODO]) : '';
	let programa = periodoDeTexto(textoPeriodo);
	if (!programa && columnasMes.length) {
		const ultimo = columnasMes.at(-1)!.mes;
		const [anio, mes] = ultimo.split('-').map(Number);
		programa = {
			periodoInicio: columnasMes[0].mes,
			periodoFin: `${ultimo.slice(0, 8)}${diasDelMes(anio, mes)}`
		};
		advertencias.push('El periodo del programa se tomó de la fila de meses.');
	}

	// Cada mes puede ocupar varias columnas combinadas: se revisa todo su rango.
	const rangoDeMes = columnasMes.map((c, i) => ({
		...c,
		hasta: (columnasMes[i + 1]?.columna ?? c.columna + 2) - 1
	}));
	const marcado = (fila: number, desde: number, hasta: number) => {
		for (let columna = desde; columna <= hasta; columna++) {
			if (esRellenoMarcado(hoja.rellenos[fila]?.[columna])) return true;
			const valor = normalizar(hoja.filas[fila]?.[columna]);
			if (valor === 'X' || valor === 'P' || valor === 'R' || /^\d+$/.test(valor)) return true;
		}
		return false;
	};

	const filas: FilaPrograma[] = [];
	for (let fila = filaMeses + 1; fila < hoja.filas.length; fila++) {
		const numero = texto(valorEn(hoja, fila, columnas.PARTIDA));
		const pr = normalizar(hoja.filas[fila]?.[columnas['P/R']]);
		if (pr !== 'P' || !/^\d+[A-Z]?$/.test(numero)) continue;
		const textoPeriodicidad = texto(valorEn(hoja, fila, columnas.PERIODICIDAD));
		const periodicidad = periodicidadDeTexto(textoPeriodicidad);
		const cantidad = valorEn(hoja, fila, columnas.CANTIDAD);
		const filaR = normalizar(hoja.filas[fila + 1]?.[columnas['P/R']]) === 'R' ? fila + 1 : -1;
		const mesesMarcados: string[] = [];
		const realizadosMarcados: string[] = [];
		for (const rango of rangoDeMes) {
			if (marcado(fila, rango.columna, rango.hasta)) mesesMarcados.push(rango.mes);
			if (filaR !== -1 && marcado(filaR, rango.columna, rango.hasta)) {
				realizadosMarcados.push(rango.mes);
			}
		}
		filas.push({
			numero,
			actividad: texto(valorEn(hoja, fila, columnas.ACTIVIDAD)),
			periodicidad,
			textoPeriodicidad,
			cantidadAnual: typeof cantidad === 'number' ? cantidad : null,
			distribucion:
				columnas.DISTRIBUCION !== undefined
					? texto(valorEn(hoja, fila, columnas.DISTRIBUCION))
					: '',
			mesesMarcados,
			realizadosMarcados
		});
	}
	return { programa, filas, filaMeses };
}

interface FilaCatalogo {
	numero: string;
	actividad: string;
	distribucion: string;
	textoFrecuencia: string;
	entrega: string;
	entregaOma: string;
	entregaPropuesta: string;
	requiereOdm: boolean;
	requierePt: boolean;
	requiereAst: boolean;
	material: string;
	reportesHomologados: string;
	alcances: { tipo: TipoAlcance; texto: string }[];
}

function analizarCatalogo(hoja: Hoja) {
	const { fila: filaCabecera, columnas } = ubicarCabeceras(
		hoja,
		{
			ITEM: es('ITEM'),
			ACTIVIDAD: es('ACTIVIDAD'),
			DESCRIPCION: es('DESCRIPCION'),
			FRECUENCIA: es('FRECUENCIA')
		},
		{
			DISTRIBUCION: es('DISTRIBUCION'),
			ENTREGA: es('ENTREGA'),
			ENTREGA_OMA: empieza('ENTREGA DE ACUERDO'),
			ENTREGA_PROPUESTA: empieza('ENTREGA PROPUESTA'),
			ODM: empieza('REQUIERE ODM'),
			PT: empieza('REQUIERE PT'),
			AST: empieza('REQUIERE AST'),
			MATERIAL: empieza('MATERIAL'),
			HOMOLOGADOS: empieza('REPORTES HOMOLOGADOS')
		}
	);
	const filaSiNo = hoja.filas[filaCabecera + 1] ?? [];
	/** «X» en la columna SI (la de la cabecera) o en NO (la siguiente). */
	const requiere = (fila: number, columna: number | undefined) => {
		if (columna === undefined) return false;
		const colSi = normalizar(filaSiNo[columna]) === 'SI' ? columna : columna;
		return normalizar(valorEn(hoja, fila, colSi)) === 'X';
	};

	const filas: FilaCatalogo[] = [];
	let actual: FilaCatalogo | null = null;
	const continuacionActividad: { tipo: TipoAlcance; texto: string }[] = [];
	const cerrar = () => {
		if (actual) actual.alcances.push(...continuacionActividad.splice(0));
	};
	for (let fila = filaCabecera + 1; fila < hoja.filas.length; fila++) {
		const celdas = hoja.filas[fila] ?? [];
		const numero = texto(celdas[columnas.ITEM]);
		if (/^\d+[A-Z]?$/.test(numero)) {
			cerrar();
			actual = {
				numero,
				actividad: texto(celdas[columnas.ACTIVIDAD]),
				distribucion:
					columnas.DISTRIBUCION !== undefined ? texto(celdas[columnas.DISTRIBUCION]) : '',
				textoFrecuencia: texto(celdas[columnas.FRECUENCIA]),
				entrega: columnas.ENTREGA !== undefined ? texto(celdas[columnas.ENTREGA]) : '',
				entregaOma: columnas.ENTREGA_OMA !== undefined ? texto(celdas[columnas.ENTREGA_OMA]) : '',
				entregaPropuesta:
					columnas.ENTREGA_PROPUESTA !== undefined ? texto(celdas[columnas.ENTREGA_PROPUESTA]) : '',
				requiereOdm: requiere(fila, columnas.ODM),
				requierePt: requiere(fila, columnas.PT),
				requiereAst: requiere(fila, columnas.AST),
				material: columnas.MATERIAL !== undefined ? texto(celdas[columnas.MATERIAL]) : '',
				reportesHomologados:
					columnas.HOMOLOGADOS !== undefined ? texto(celdas[columnas.HOMOLOGADOS]) : '',
				alcances: []
			};
			filas.push(actual);
		} else if (actual) {
			// En filas de continuación, la columna ACTIVIDAD puede traer viñetas adicionales.
			const extra = clasificarLinea(String(celdas[columnas.ACTIVIDAD] ?? ''));
			if (extra && /^[·•]/.test(String(celdas[columnas.ACTIVIDAD] ?? '').trim()))
				continuacionActividad.push(extra);
		}
		if (!actual) continue;
		for (const linea of String(celdas[columnas.DESCRIPCION] ?? '').split(/\r?\n/)) {
			const alcance = clasificarLinea(linea);
			if (alcance) actual.alcances.push(alcance);
		}
	}
	cerrar();
	return filas;
}

const DISTRIBUCION: Record<string, PartidaImportada['distribucion']> = {
	PRODUCCION: 'produccion',
	MANTENIMIENTO: 'mantenimiento'
};

/** Firmantes que la hoja muestra bajo «OPERADOR»/«AUTORIZA»: nombre, cargo y empresa. */
/** Nombre, cargo y empresa bajo las etiquetas de firma de la hoja (OPERADOR, AUTORIZA…). */
export function firmantesDeHoja(hoja: Hoja): FirmantePropuesto[] {
	const propuestos: FirmantePropuesto[] = [];
	for (let fila = 0; fila < hoja.filas.length; fila++) {
		(hoja.filas[fila] ?? []).forEach((valor, columna) => {
			const etiqueta = normalizar(valor);
			if (
				etiqueta !== 'OPERADOR' &&
				etiqueta !== 'AUTORIZA' &&
				etiqueta !== 'ELABORO' &&
				etiqueta !== 'REVISO'
			)
				return;
			const debajo: string[] = [];
			for (let f = fila + 1; f < Math.min(fila + 10, hoja.filas.length) && debajo.length < 3; f++) {
				const t = texto(hoja.filas[f]?.[columna]);
				if (t && !/^_+$/.test(t)) debajo.push(t);
			}
			if (debajo.length) {
				propuestos.push({
					funcion: etiqueta.toLowerCase(),
					nombre: debajo[0],
					cargo: debajo[1] ?? '',
					empresa: debajo[2] ?? ''
				});
			}
		});
	}
	return propuestos;
}

function datoTrasEtiqueta(hoja: Hoja, etiqueta: string): string | null {
	for (const fila of hoja.filas.slice(0, 12)) {
		for (const valor of fila ?? []) {
			const t = texto(valor);
			if (normalizar(t).startsWith(etiqueta)) {
				const resto = t
					.slice(t.indexOf(':') + 1)
					.replace(/["“”]/g, '')
					.trim();
				if (resto) return resto;
			}
		}
	}
	return null;
}

export function analizarHojas(hojas: Hoja[]): CatalogoImportado {
	const advertencias: string[] = [];
	const hojaPrograma = buscarHoja(hojas, (n) => n.includes('PROGRAMA'), '«PROGRAMA ANUAL»');
	const hojaCatalogo = buscarHoja(
		hojas,
		(n) => n.includes('CATALOGO') || n.includes('ALCANCES'),
		'«Catálogo de Conceptos-ALCANCES»'
	);
	const { programa, filas: filasPrograma } = analizarPrograma(hojaPrograma, advertencias);
	const filasCatalogo = analizarCatalogo(hojaCatalogo);
	const programaPorNumero = new Map(
		filasPrograma.map((f) => [f.numero.replace(/^0+(?=\d)/, ''), f])
	);

	const partidas: PartidaImportada[] = filasCatalogo.map((c) => {
		const p = programaPorNumero.get(c.numero.replace(/^0+(?=\d)/, ''));
		if (!p) advertencias.push(`La partida ${c.numero} no aparece en el programa anual.`);
		const periodicidad = periodicidadDeTexto(c.textoFrecuencia) ?? p?.periodicidad ?? null;
		if (!periodicidad) {
			throw new ErrorImportacion(
				`La partida ${c.numero} tiene una frecuencia no reconocida: «${c.textoFrecuencia}»`,
				hojaCatalogo.nombre,
				'FRECUENCIA'
			);
		}
		if (p?.periodicidad && p.periodicidad !== periodicidad) {
			advertencias.push(
				`La partida ${c.numero} tiene frecuencia «${c.textoFrecuencia}» en el catálogo y «${p.textoPeriodicidad}» en el programa; se usa la del catálogo.`
			);
		}
		const material = normalizar(c.material);
		// Lo programado por mes depende de la periodicidad; un mes realizado cuenta lo mismo.
		const meses = (p?.mesesMarcados ?? []).flatMap((mes) => {
			const cantidad = cantidadDelMes(periodicidad, mes);
			return cantidad === null ? [] : [{ mes, cantidad }];
		});
		const realizados = (p?.realizadosMarcados ?? []).map((mes) => ({
			mes,
			cantidad: cantidadDelMes(periodicidad, mes) ?? 1
		}));
		return {
			numero: c.numero,
			actividad: c.actividad || p?.actividad || `Partida ${c.numero}`,
			distribucion: DISTRIBUCION[normalizar(c.distribucion || p?.distribucion)] ?? null,
			periodicidad,
			cantidadAnual: periodicidad === 'cuando_aplique' ? null : (p?.cantidadAnual ?? null),
			entrega: c.entrega || null,
			entregaOma: c.entregaOma || null,
			entregaPropuesta: c.entregaPropuesta || null,
			requiereOdm: c.requiereOdm,
			requierePt: c.requierePt,
			requiereAst: c.requiereAst,
			materialesPor: material === 'ICSI' ? 'icsi' : material ? 'cliente' : null,
			reportesHomologados: c.reportesHomologados || null,
			alcances: c.alcances,
			meses,
			realizados
		};
	});
	for (const p of filasPrograma) {
		if (
			!filasCatalogo.some(
				(c) => c.numero.replace(/^0+(?=\d)/, '') === p.numero.replace(/^0+(?=\d)/, '')
			)
		) {
			advertencias.push(
				`La partida ${p.numero} del programa no está en el catálogo de conceptos; se omite.`
			);
		}
	}
	return {
		usuario: datoTrasEtiqueta(hojaPrograma, 'USUARIO'),
		estacion: datoTrasEtiqueta(hojaPrograma, 'ESTACION'),
		programa,
		partidas,
		firmantesPropuestos: firmantesDeHoja(hojaPrograma),
		advertencias
	};
}

export async function analizarLibroCatalogo(
	datos: Uint8Array | ArrayBuffer
): Promise<CatalogoImportado> {
	let hojas: Hoja[];
	try {
		hojas = await leerLibro(datos);
	} catch (error) {
		throw new ErrorImportacion(
			`No se pudo leer el archivo: ${error instanceof Error ? error.message : String(error)}`,
			'(archivo)'
		);
	}
	return analizarHojas(hojas);
}
