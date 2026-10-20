// Preparación de fotografías para el documento: orientación EXIF corregida, lado mayor limitado y
// JPEG de calidad media, para que reportes con muchas fotos mantengan un tamaño manejable.
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

export async function prepararImagen(
	datos: Uint8Array,
	{ ladoMayor = LADO_MAYOR_PX, calidad = CALIDAD_JPEG } = {}
): Promise<ImagenPreparada> {
	const { data, info } = await sharp(datos, { failOn: 'error' })
		.rotate()
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
