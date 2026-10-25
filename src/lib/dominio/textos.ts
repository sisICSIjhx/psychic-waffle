// Textos de la interfaz: plurales y meses en formato de oración («mayo 2026»). El documento DOCX
// conserva su propio formato en mayúsculas (documento.ts).
import { partesMes } from './captura.ts';

const NOMBRES_MES = [
	'enero',
	'febrero',
	'marzo',
	'abril',
	'mayo',
	'junio',
	'julio',
	'agosto',
	'septiembre',
	'octubre',
	'noviembre',
	'diciembre'
] as const;

/** «1 foto», «3 fotos»; el plural se indica cuando no basta con agregar «s». */
export function plural(cantidad: number, singular: string, enPlural = `${singular}s`): string {
	return `${cantidad} ${cantidad === 1 ? singular : enPlural}`;
}

/**
 * Mes «AAAA-MM…» como «mayo 2026». Con `inicial` empieza con mayúscula (al inicio de una frase,
 * una opción o un encabezado) y con `corto` usa tres letras («may 2026»).
 */
export function textoMes(mes: string, { inicial = false, corto = false } = {}): string {
	const { anio, mes: numero } = partesMes(mes);
	const nombre = corto ? NOMBRES_MES[numero - 1].slice(0, 3) : NOMBRES_MES[numero - 1];
	const texto = `${nombre} ${anio}`;
	return inicial ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

/** Rango de días de un periodo: «del 1 al 31 de mayo de 2026» o «el 18 de mayo de 2026». */
export function textoRango({ desde, hasta }: { desde: string; hasta: string }): string {
	const dia = (fecha: string) => Number(fecha.slice(8, 10));
	const { anio, mes } = partesMes(hasta);
	const cola = `de ${NOMBRES_MES[mes - 1]} de ${anio}`;
	return desde === hasta
		? `el ${dia(desde)} ${cola}`
		: `del ${dia(desde)} al ${dia(hasta)} ${cola}`;
}

/** Tiempo transcurrido para el estado del guardado: «hace un momento», «hace 5 s», «hace 3 min». */
export function textoHaceTiempo(desde: number, ahora: number): string {
	const segundos = Math.max(0, Math.floor((ahora - desde) / 1000));
	if (segundos < 5) return 'hace un momento';
	if (segundos < 60) return `hace ${segundos} s`;
	const minutos = Math.floor(segundos / 60);
	if (minutos < 60) return `hace ${minutos} min`;
	const fecha = new Date(desde);
	const hora = `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
	return `a las ${hora}`;
}
