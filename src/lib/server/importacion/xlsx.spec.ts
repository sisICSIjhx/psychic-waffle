import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { revisarTamanoDescomprimido } from './xlsx';

describe('libros desmedidos', () => {
	it('rechaza un paquete que declara más contenido del permitido sin descomprimirlo', async () => {
		const zip = new JSZip();
		zip.file('xl/workbook.xml', 'x'.repeat(4096));
		const leido = await JSZip.loadAsync(
			await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
		);
		expect(() => revisarTamanoDescomprimido(leido, 1024)).toThrow(/demasiado grande/);
		expect(() => revisarTamanoDescomprimido(leido, 8192)).not.toThrow();
	});
});
