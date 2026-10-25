// Preparación de fotografías para el documento: orientación EXIF corregida, giro elegido en el editor,
// lado mayor limitado y JPEG de calidad media, para que reportes con muchas fotos mantengan un tamaño
// manejable.
import sharp from 'sharp';

export const LADO_MAYOR_PX = 1600;
export const CALIDAD_JPEG = 80;

export interface ImagenPreparada {
	datos: Buffer;
	/** px */
	ancho: number;
	/** px */
	alto: number;
}

/** Píxeles sin comprimir (RGBA), como los entrega el decodificador de HEIC. */
export interface PixelesRgba {
	ancho: number;
	alto: number;
}

export async function prepararImagen(
	datos: Uint8Array,
	{
		ladoMayor = LADO_MAYOR_PX,
		calidad = CALIDAD_JPEG,
		rgba,
		giro = 0
	}: { ladoMayor?: number; calidad?: number; rgba?: PixelesRgba; giro?: 0 | 90 | 180 | 270 } = {}
): Promise<ImagenPreparada> {
	const entrada = rgba
		? sharp(datos, { raw: { width: rgba.ancho, height: rgba.alto, channels: 4 } })
		: sharp(datos, { failOn: 'error' });
	// sharp admite una sola rotación por canalización además de la EXIF (autoOrient).
	const orientada = giro ? entrada.autoOrient().rotate(giro) : entrada.rotate();
	const { data, info } = await orientada
		.resize({ width: ladoMayor, height: ladoMayor, fit: 'inside', withoutEnlargement: true })
		.flatten({ background: '#ffffff' })
		.jpeg({ quality: calidad, mozjpeg: true })
		.toBuffer({ resolveWithObject: true });
	return { datos: data, ancho: info.width, alto: info.height };
}

/** Ejecuta `tarea` sobre cada elemento con un máximo de `limite` en paralelo, conservando el orden. */
export async function enParalelo<T, R>(
	elementos: readonly T[],
	limite: number,
	tarea: (elemento: T, indice: number) => Promise<R>
): Promise<R[]> {
	const resultados = new Array<R>(elementos.length);
	let siguiente = 0;
	async function trabajador() {
		while (siguiente < elementos.length) {
			const indice = siguiente++;
			resultados[indice] = await tarea(elementos[indice], indice);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limite, elementos.length) }, trabajador));
	return resultados;
}
