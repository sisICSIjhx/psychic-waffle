import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AlmacenamientoLocal } from './almacenamiento';
import { detectarFormato, ErrorFoto, LIMITE_FOTO_BYTES, procesarFoto } from './fotos';

const cabeceraHeic = (marca: string) =>
	new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode(`ftyp${marca}`), 0, 0, 0, 0]);

async function esperarErrorFoto(promesa: Promise<unknown>): Promise<string> {
	try {
		await promesa;
	} catch (error) {
		expect(error).toBeInstanceOf(ErrorFoto);
		return (error as Error).message;
	}
	throw new Error('Se esperaba un error de foto');
}

describe('validación de fotografías', () => {
	it('detecta el formato por el contenido', async () => {
		const png = await sharp({
			create: { width: 4, height: 4, channels: 4, background: '#00000000' }
		})
			.png()
			.toBuffer();
		expect(detectarFormato(await sharp(png).jpeg().toBuffer())).toBe('jpeg');
		expect(detectarFormato(png)).toBe('png');
		expect(detectarFormato(cabeceraHeic('heic'))).toBe('heic');
		expect(detectarFormato(cabeceraHeic('avif'))).toBeNull();
		expect(detectarFormato(new TextEncoder().encode('%PDF-1.7'))).toBeNull();
	});

	it('rechaza otros formatos, archivos vacíos y fotos de más de 15 MB', async () => {
		expect(await esperarErrorFoto(procesarFoto(new TextEncoder().encode('%PDF-1.7')))).toContain(
			'JPEG, PNG o HEIC'
		);
		expect(await esperarErrorFoto(procesarFoto(new Uint8Array()))).toContain('vacío');
		const grande = new Uint8Array(LIMITE_FOTO_BYTES + 1);
		grande.set([0xff, 0xd8, 0xff]);
		expect(await esperarErrorFoto(procesarFoto(grande))).toContain('15 MB');
		const dañada = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
		expect(await esperarErrorFoto(procesarFoto(dañada))).toContain('dañada');
	});

	it('corrige la orientación y limita el lado mayor a 1600 px', async () => {
		// 3000 × 1500 con orientación EXIF 6 (girada 90°): la optimizada queda vertical.
		const girada = await sharp({
			create: { width: 3000, height: 1500, channels: 3, background: '#336699' }
		})
			.jpeg()
			.withMetadata({ orientation: 6 })
			.toBuffer();
		const { optimizada, tipoMime, extension } = await procesarFoto(girada);
		expect([optimizada.ancho, optimizada.alto]).toEqual([800, 1600]);
		expect(tipoMime).toBe('image/jpeg');
		expect(extension).toBe('jpg');
		expect(detectarFormato(optimizada.datos)).toBe('jpeg');
	});

	it('convierte las fotos HEIC con el decodificador y conserva el tipo original', async () => {
		const ancho = 40;
		const alto = 20;
		const procesada = await procesarFoto(cabeceraHeic('heic'), {
			decodificador: async () => ({
				ancho,
				alto,
				datos: new Uint8Array(ancho * alto * 4).fill(200)
			})
		});
		expect(procesada).toMatchObject({ formato: 'heic', tipoMime: 'image/heic', extension: 'heic' });
		expect([procesada.optimizada.ancho, procesada.optimizada.alto]).toEqual([40, 20]);
		expect(detectarFormato(procesada.optimizada.datos)).toBe('jpeg');
	});
});

describe('almacenamiento local', () => {
	let carpeta: string;
	beforeAll(async () => {
		carpeta = await mkdtemp(join(tmpdir(), 'almacen-'));
	});
	afterAll(() => rm(carpeta, { recursive: true, force: true }));

	it('guarda, lee y elimina dentro de su carpeta', async () => {
		const almacen = new AlmacenamientoLocal(carpeta);
		await almacen.guardar('fotos/r1/a.jpg', new Uint8Array([1, 2, 3]));
		expect([...(await almacen.leer('fotos/r1/a.jpg'))]).toEqual([1, 2, 3]);
		await almacen.eliminar('fotos/r1/a.jpg');
		await almacen.eliminar('fotos/r1/a.jpg');
		await expect(almacen.leer('fotos/r1/a.jpg')).rejects.toThrow();
	});

	it('rechaza rutas que salen de la carpeta o absolutas', async () => {
		const almacen = new AlmacenamientoLocal(carpeta);
		for (const ruta of ['../fuera.txt', 'fotos/../../fuera.txt', '/etc/passwd', 'C:/x', 'a//b']) {
			await expect(almacen.guardar(ruta, new Uint8Array([1]))).rejects.toThrow(/inválida/);
		}
	});
});
