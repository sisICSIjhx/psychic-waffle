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
