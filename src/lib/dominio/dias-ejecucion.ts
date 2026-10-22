// Días de ejecución de un reporte: segmentos {desde, hasta} del mes del periodo, en orden y sin
// traslapes. Un día suelto se guarda con desde = hasta, así «15, 16» y «15-16» se distinguen y el
// documento respeta la forma capturada. Funciones puras: no importan captura.ts ni textos.ts.
import { diasDelMes, MESES } from './documento.ts';

export interface SegmentoDias {
	/** AAAA-MM-DD */
	desde: string;
	/** AAAA-MM-DD */
	hasta: string;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const diaDe = (fecha: string) => Number(fecha.slice(8, 10));
const nombreMes = (mes: number) => MESES[mes - 1].toLocaleLowerCase('es-MX');
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** «mayo de 2026» del periodo «AAAA-MM-01». */
export function textoMesAnio(periodoMes: string): string {
	return `${nombreMes(Number(periodoMes.slice(5, 7)))} de ${periodoMes.slice(0, 4)}`;
}

/**
 * Analiza el texto del campo: días o rangos («-» o «al») separados por comas, punto y coma, espacios
 * o «y», con un sufijo opcional « / MES / AAAA» que debe ser el mes del reporte. Ordena sin fusionar.
 */
export function analizarDias(
	texto: string,
	periodoMes: string
): { segmentos: SegmentoDias[]; errores: string[] } {
	const anio = Number(periodoMes.slice(0, 4));
	const mes = Number(periodoMes.slice(5, 7));
	const totalDias = diasDelMes(anio, mes);
	const fecha = (dia: number) => `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
	const errores: string[] = [];
	let cuerpo = texto.trim();
	if (!cuerpo) return { segmentos: [], errores };

	// Sufijo « / MES / AAAA» (espacios irregulares), solo si es el mes del reporte.
	const sufijo = /\/\s*([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s*\/\s*(\d{4})\s*$/.exec(cuerpo);
	if (sufijo) {
		const indice = MESES.map(normalizar).indexOf(normalizar(sufijo[1]));
		if (indice + 1 !== mes || Number(sufijo[2]) !== anio) {
			return { segmentos: [], errores: [`Los días deben ser de ${textoMesAnio(periodoMes)}.`] };
		}
		cuerpo = cuerpo.slice(0, sufijo.index).trim();
	}

	const fichas = cuerpo
		.replace(/\s*(?:-|–|\bal\b)\s*/gi, '-')
		.split(/[\s,;]+|\by\b/i)
		.map((f) => f.trim())
		.filter(Boolean);
	const segmentos: SegmentoDias[] = [];
	const mesCapital = textoMesAnio(periodoMes).replace(/^./, (c) => c.toUpperCase());
	for (const ficha of fichas) {
		const rango = /^(\d{1,2})(?:-(\d{1,2}))?$/.exec(ficha);
		if (!rango) {
			errores.push(`No se reconoce «${ficha}»; escriba días o rangos, por ejemplo 15, 16, 20-25.`);
			continue;
		}
		const desde = Number(rango[1]);
		const hasta = rango[2] === undefined ? desde : Number(rango[2]);
		const inexistente = [desde, hasta].find((d) => d < 1 || d > totalDias);
		if (inexistente !== undefined) {
			errores.push(`${mesCapital} no tiene día ${dosDigitos(inexistente)}.`);
			continue;
		}
		if (hasta < desde) {
			errores.push(
				`El rango ${dosDigitos(desde)}-${dosDigitos(hasta)} está invertido; escriba ${dosDigitos(hasta)}-${dosDigitos(desde)}.`
			);
			continue;
		}
		segmentos.push({ desde: fecha(desde), hasta: fecha(hasta) });
	}
	segmentos.sort((a, b) => a.desde.localeCompare(b.desde) || a.hasta.localeCompare(b.hasta));
	const repetidos = new Set<number>();
	for (let i = 1; i < segmentos.length; i++) {
		const anterior = segmentos[i - 1];
		const actual = segmentos[i];
		if (actual.desde <= anterior.hasta) {
			for (
				let d = diaDe(actual.desde);
				d <= Math.min(diaDe(actual.hasta), diaDe(anterior.hasta));
				d++
			) {
				repetidos.add(d);
			}
		}
	}
	for (const d of [...repetidos].sort((a, b) => a - b))
		errores.push(`El día ${dosDigitos(d)} se repite.`);
	return errores.length ? { segmentos: [], errores } : { segmentos, errores };
}

/** Forma normalizada del campo: «15, 16, 20-25». */
export function textoDias(segmentos: SegmentoDias[]): string {
	return segmentos
		.map((s) =>
			s.desde === s.hasta
				? dosDigitos(diaDe(s.desde))
				: `${dosDigitos(diaDe(s.desde))}-${dosDigitos(diaDe(s.hasta))}`
		)
		.join(', ');
}

/** Agrega un día como segmento propio, en su orden; si ya está cubierto, no cambia nada. */
export function agregarDia(segmentos: SegmentoDias[], dia: string): SegmentoDias[] {
	if (segmentos.some((s) => s.desde <= dia && dia <= s.hasta)) return segmentos;
	return [...segmentos, { desde: dia, hasta: dia }].sort((a, b) => a.desde.localeCompare(b.desde));
}

/** Días distintos («AAAA-MM-DD») que cubren los segmentos. */
export function diasCubiertos(segmentos: SegmentoDias[]): string[] {
	const dias: string[] = [];
	for (const s of segmentos) {
		for (let d = diaDe(s.desde); d <= diaDe(s.hasta); d++) {
			const dia = `${s.desde.slice(0, 8)}${dosDigitos(d)}`;
			if (!dias.includes(dia)) dias.push(dia);
		}
	}
	return dias;
}

/** Días que quedan fuera del rango del periodo. */
export function diasFueraDe(
	segmentos: SegmentoDias[],
	rango: { desde: string; hasta: string }
): SegmentoDias[] {
	return diasCubiertos(segmentos)
		.filter((d) => d < rango.desde || d > rango.hasta)
		.map((d) => ({ desde: d, hasta: d }));
}

/** Iguales si tienen los mismos segmentos en el mismo orden. */
export function mismosDias(a: SegmentoDias[], b: SegmentoDias[]): boolean {
	return (
		a.length === b.length && a.every((s, i) => s.desde === b[i].desde && s.hasta === b[i].hasta)
	);
}
