// Utilidades para respuestas HTTP del servidor.

/**
 * Content-Disposition de descarga seguro: el nombre ASCII sin comillas, barras invertidas ni saltos
 * de línea y, para conservar los acentos, `filename*` codificado (RFC 6266 y RFC 5987). El nombre
 * sale de la base de datos y no debe poder romper ni inyectar encabezados.
 */
export function disposicionAdjunto(nombre: string, respaldo = 'documento.docx'): string {
	// eslint-disable-next-line no-control-regex -- se eliminan justamente los caracteres de control
	const limpio = nombre.replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim() || respaldo;
	const ascii = limpio.normalize('NFD').replace(/[^\x20-\x7e]/g, '') || respaldo;
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(limpio)}`;
}

/** Cuerpo de respuesta sobre la misma memoria del búfer, sin copiarlo. */
export function cuerpoSinCopia(datos: Buffer): Uint8Array<ArrayBuffer> {
	// Los búferes de Node (lectura de disco, JSZip) viven sobre un ArrayBuffer, no uno compartido.
	return new Uint8Array(datos.buffer as ArrayBuffer, datos.byteOffset, datos.byteLength);
}
