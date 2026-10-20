// Almacenamiento de archivos (fotos y documentos generados) detrás de una interfaz. Hoy guarda en disco
// local, dentro de STORAGE_DIR; SharePoint será otra implementación en un cambio posterior (D6).
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export interface Almacenamiento {
	/** Guarda el archivo en la ruta relativa indicada (p. ej. «fotos/<reporte>/<foto>.jpg»). */
	guardar(ruta: string, datos: Uint8Array): Promise<void>;
	leer(ruta: string): Promise<Buffer>;
	/** Elimina el archivo si existe. */
	eliminar(ruta: string): Promise<void>;
}

const SEGMENTO = /^[\w-][\w.-]*$/;

export class AlmacenamientoLocal implements Almacenamiento {
	private readonly raiz: string;

	constructor(raiz: string) {
		this.raiz = resolve(raiz);
	}

	/** Ruta absoluta dentro de la raíz; rechaza rutas absolutas, «..» y caracteres fuera de [\w.-]. */
	private absoluta(relativa: string): string {
		const segmentos = relativa.split('/');
		if (!segmentos.every((s) => SEGMENTO.test(s) && s !== '..')) {
			throw new Error(`Ruta de almacenamiento inválida: «${relativa}»`);
		}
		const completa = resolve(this.raiz, ...segmentos);
		if (!completa.startsWith(this.raiz + sep)) {
			throw new Error(`Ruta de almacenamiento fuera de la carpeta: «${relativa}»`);
		}
		return completa;
	}

	async guardar(ruta: string, datos: Uint8Array): Promise<void> {
		const destino = this.absoluta(ruta);
		await mkdir(dirname(destino), { recursive: true });
		// Escritura en un temporal y renombrado: un lector nunca ve un archivo a medias.
		const temporal = `${destino}.${randomUUID()}.tmp`;
		await writeFile(temporal, datos);
		await rename(temporal, destino);
	}

	leer(ruta: string): Promise<Buffer> {
		return readFile(this.absoluta(ruta));
	}

	async eliminar(ruta: string): Promise<void> {
		await rm(this.absoluta(ruta), { force: true });
	}
}
