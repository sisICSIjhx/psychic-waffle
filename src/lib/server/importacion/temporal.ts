// Importaciones en espera de confirmación: entre el ensayo y la aplicación, la carga analizada se
// guarda en STORAGE_DIR/importaciones/<id>.json (ignorado por Git) y caduca a las 2 horas.
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CargaImportacion } from '../repositorios/catalogo.ts';
import type { CargaPrograma } from '../repositorios/programa.ts';

const CADUCIDAD_MS = 2 * 60 * 60 * 1000;
const ID_VALIDO = /^[0-9a-f-]{36}$/;

/** Carga pendiente con su tipo de libro; las guardadas antes de existir el tipo son de catálogo. */
export type CargaPendiente =
	| ({ tipo: 'catalogo' } & CargaImportacion)
	| ({ tipo: 'programa' } & CargaPrograma);

async function limpiarCaducadas(carpeta: string) {
	const ahora = Date.now();
	for (const nombre of await readdir(carpeta).catch(() => [])) {
		const ruta = join(carpeta, nombre);
		const info = await stat(ruta).catch(() => null);
		if (info && ahora - info.mtimeMs > CADUCIDAD_MS) await rm(ruta, { force: true });
	}
}

export async function guardarImportacionPendiente(
	almacenamiento: string,
	carga: CargaPendiente
): Promise<string> {
	const carpeta = join(almacenamiento, 'importaciones');
	await mkdir(carpeta, { recursive: true });
	await limpiarCaducadas(carpeta);
	const id = randomUUID();
	await writeFile(join(carpeta, `${id}.json`), JSON.stringify(carga), 'utf8');
	return id;
}

/** Recupera y elimina la carga pendiente; null si no existe o caducó. */
export async function tomarImportacionPendiente(
	almacenamiento: string,
	id: string,
	contratoId: string
): Promise<CargaPendiente | null> {
	if (!ID_VALIDO.test(id)) return null;
	const ruta = join(almacenamiento, 'importaciones', `${id}.json`);
	const info = await stat(ruta).catch(() => null);
	if (!info || Date.now() - info.mtimeMs > CADUCIDAD_MS) return null;
	const leida = JSON.parse(await readFile(ruta, 'utf8')) as Partial<CargaPendiente>;
	await rm(ruta, { force: true });
	const carga = { ...leida, tipo: leida.tipo ?? 'catalogo' } as CargaPendiente;
	return carga.contratoId === contratoId ? carga : null;
}
