// Plantilla DOCX vigente empaquetada por Vite (`?inline`), para que el build de producción no dependa
// de la ruta del archivo en src/. Los scripts locales, que no pasan por Vite, usan la ruta en disco
// que resuelve generar.ts.
import plantillaV2 from './FOR-ICSI-RMT-01.v2.docx?inline';

let enCache: Uint8Array | null = null;

export async function plantillaVigente(): Promise<Uint8Array> {
	// Vite entrega un data URL en base64.
	enCache ??= Buffer.from(plantillaV2.slice(plantillaV2.indexOf(',') + 1), 'base64');
	return enCache;
}
