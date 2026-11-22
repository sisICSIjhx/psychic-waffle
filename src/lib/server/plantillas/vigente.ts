// Plantillas vigentes (DOCX y XLSX) empaquetadas por Vite (`?inline`), para que el build de producción
// no dependa de la ruta de los archivos en src/. Los scripts locales, que no pasan por Vite, usan la
// ruta en disco que resuelven generar.ts y fotografico.ts.
import plantillaV2 from './FOR-ICSI-RMT-01.v2.docx?inline';
import plantillaFotografico from './REPORTE-FOTOGRAFICO.v1.xlsx?inline';

let enCache: Uint8Array | null = null;
let fotograficoEnCache: Uint8Array | null = null;

// Vite entrega un data URL en base64.
const bytesDe = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

export async function plantillaVigente(): Promise<Uint8Array> {
	enCache ??= bytesDe(plantillaV2);
	return enCache;
}

/** Plantilla XLSX del reporte fotográfico de estimación (documentos/fotografico.ts). */
export async function plantillaFotograficoVigente(): Promise<Uint8Array> {
	fotograficoEnCache ??= bytesDe(plantillaFotografico);
	return fotograficoEnCache;
}
