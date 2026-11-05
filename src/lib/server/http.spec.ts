import { describe, expect, it } from 'vitest';
import { cuerpoSinCopia, disposicionAdjunto } from './http';

describe('disposicionAdjunto', () => {
	it('conserva un nombre ASCII y agrega la versión codificada', () => {
		expect(disposicionAdjunto('P13_Manometros_2026-06.docx')).toBe(
			`attachment; filename="P13_Manometros_2026-06.docx"; filename*=UTF-8''P13_Manometros_2026-06.docx`
		);
	});

	it('quita comillas, barras y saltos de línea que romperían el encabezado', () => {
		const valor = disposicionAdjunto('a"b\\\r\nSet-Cookie: x=1/c.docx');
		expect(valor).not.toMatch(/[\r\n]/);
		expect(valor).toContain('filename="abSet-Cookie: x=1c.docx"');
	});

	it('los acentos van en filename* y el nombre ASCII queda sin ellos', () => {
		const valor = disposicionAdjunto('Revisión ñ.docx');
		expect(valor).toContain('filename="Revision n.docx"');
		expect(valor).toContain(`filename*=UTF-8''${encodeURIComponent('Revisión ñ.docx')}`);
	});

	it('usa el respaldo si el nombre queda vacío', () => {
		expect(disposicionAdjunto('"\r\n')).toContain('filename="documento.docx"');
	});
});

describe('cuerpoSinCopia', () => {
	it('comparte la memoria del búfer', () => {
		const datos = Buffer.from('hola');
		const cuerpo = cuerpoSinCopia(datos);
		datos[0] = 0x48;
		expect(Buffer.from(cuerpo).toString()).toBe('Hola');
	});
});
