// Validación y preparación de las fotografías que se cargan en un reporte: JPEG, PNG o HEIC de hasta
// 15 MB. Se conserva el original y se prepara la versión optimizada para el documento (orientación
// corregida, lado mayor de 1600 px y JPEG de calidad 80).
import { prepararImagen, type ImagenPreparada } from './documentos/imagenes.ts';

export const LIMITE_FOTO_BYTES = 15 * 1024 * 1024;
export const FORMATOS_ACEPTADOS = 'JPEG, PNG o HEIC';
/** Tope de píxeles para no descomprimir imágenes desmedidas (unos 100 megapíxeles). */
export const MAXIMO_PIXELES = 100_000_000;

export type FormatoFoto = 'jpeg' | 'png' | 'heic';

const TIPO_MIME: Record<FormatoFoto, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	heic: 'image/heic'
};
const EXTENSION: Record<FormatoFoto, string> = { jpeg: 'jpg', png: 'png', heic: 'heic' };

/** Marcas «ftyp» de HEIF/HEIC con códec HEVC (las de AVIF no se aceptan). */
const MARCAS_HEIC = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

/** Formato según el contenido, no según la extensión ni el tipo declarado por el navegador. */
export function detectarFormato(datos: Uint8Array): FormatoFoto | null {
	if (datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) {
		return 'jpeg';
	}
	const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	if (datos.length >= 8 && png.every((b, i) => datos[i] === b)) return 'png';
	if (datos.length >= 12) {
		const ascii = (inicio: number, fin: number) =>
			String.fromCharCode(...datos.subarray(inicio, fin));
		if (ascii(4, 8) === 'ftyp' && MARCAS_HEIC.has(ascii(8, 12))) return 'heic';
	}
	return null;
}

export class ErrorFoto extends Error {}

export interface ImagenRgba {
	ancho: number;
	alto: number;
	datos: Uint8Array;
}

/** Decodifica la primera imagen de un HEIC; revisa sus medidas antes de descomprimirla. */
export type DecodificadorHeic = (datos: Uint8Array) => Promise<ImagenRgba>;

const decodificarHeic: DecodificadorHeic = async (datos) => {
	// Carga diferida: el decodificador (WebAssembly) solo se necesita para fotos HEIC.
	const { default: decodificar } = await import('heic-decode');
	const imagenes = await decodificar.all({ buffer: datos });
	try {
		const [imagen] = imagenes;
		if (!imagen) throw new ErrorFoto('El archivo HEIC no contiene imágenes.');
		if (imagen.width * imagen.height > MAXIMO_PIXELES) {
			throw new ErrorFoto('La foto tiene demasiados píxeles; redúzcala antes de cargarla.');
		}
		const { width, height, data } = await imagen.decode();
		return {
			ancho: width,
			alto: height,
			datos: new Uint8Array(data.buffer, data.byteOffset, data.length)
		};
	} finally {
		imagenes.dispose();
	}
};

export interface FotoProcesada {
	formato: FormatoFoto;
	tipoMime: string;
	extension: string;
	optimizada: ImagenPreparada;
}

/**
 * Valida la foto y prepara su versión optimizada. Lanza ErrorFoto con un mensaje para el usuario si
 * el archivo no es una imagen aceptada, excede el tamaño o no se puede leer.
 */
export async function procesarFoto(
	datos: Uint8Array,
	{ decodificador = decodificarHeic }: { decodificador?: DecodificadorHeic } = {}
): Promise<FotoProcesada> {
	if (datos.length === 0) throw new ErrorFoto('El archivo está vacío.');
	if (datos.length > LIMITE_FOTO_BYTES) {
		throw new ErrorFoto(
			`La foto pesa ${(datos.length / 1048576).toFixed(1)} MB; el máximo es 15 MB por foto.`
		);
	}
	const formato = detectarFormato(datos);
	if (!formato) {
		throw new ErrorFoto(`Formato no aceptado. Cargue fotografías ${FORMATOS_ACEPTADOS}.`);
	}
	try {
		let optimizada: ImagenPreparada;
		if (formato === 'heic') {
			const imagen = await decodificador(datos);
			optimizada = await prepararImagen(imagen.datos, {
				rgba: { ancho: imagen.ancho, alto: imagen.alto }
			});
		} else {
			optimizada = await prepararImagen(datos);
		}
		return { formato, tipoMime: TIPO_MIME[formato], extension: EXTENSION[formato], optimizada };
	} catch (error) {
		if (error instanceof ErrorFoto) throw error;
		throw new ErrorFoto('No se pudo leer la imagen; puede estar dañada o incompleta.');
	}
}
