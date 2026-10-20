// Conversión de prueba DOCX → PDF con LibreOffice. Sirve para comparar fidelidad; no es la
// emisión oficial. Si el conversor no está configurado, lo informa sin afectar al DOCX.
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);

export type ResultadoPdf =
	| { disponible: true; pdf: Buffer }
	| { disponible: false; motivo: string };

export async function convertirPdf(
	docx: Uint8Array,
	nombre = 'reporte.docx',
	{ soffice = process.env.SOFFICE_PATH ?? '', tiempoMaximoMs = 120_000 } = {}
): Promise<ResultadoPdf> {
	if (!soffice.trim()) {
		return {
			disponible: false,
			motivo: 'La conversión a PDF no está disponible: falta SOFFICE_PATH.'
		};
	}
	try {
		await access(soffice);
	} catch {
		return {
			disponible: false,
			motivo: 'La conversión a PDF no está disponible: no se encontró LibreOffice.'
		};
	}

	const carpeta = await mkdtemp(join(tmpdir(), 'icsi-pdf-'));
	try {
		const entrada = join(carpeta, basename(nombre).replace(/[^\w.+-]/g, '_'));
		await writeFile(entrada, docx);
		await ejecutar(
			soffice,
			['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', carpeta, entrada],
			{ timeout: tiempoMaximoMs, windowsHide: true }
		);
		const pdf = await readFile(entrada.replace(/\.docx$/i, '.pdf'));
		return { disponible: true, pdf };
	} catch (error) {
		const detalle = error instanceof Error ? error.message : String(error);
		return { disponible: false, motivo: `La conversión a PDF falló: ${detalle}` };
	} finally {
		await rm(carpeta, { recursive: true, force: true });
	}
}
