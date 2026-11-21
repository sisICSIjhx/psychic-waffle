import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLAVE_TEMA, guardarPreferencia, leerPreferencia, temaInicial } from './preferencias';

describe('preferencias de la interfaz', () => {
	it('usa el tema guardado y, si no hay uno válido, el del sistema', () => {
		expect(temaInicial('light', true)).toBe('light');
		expect(temaInicial('dark', false)).toBe('dark');
		expect(temaInicial(null, true)).toBe('dark');
		expect(temaInicial(null, false)).toBe('light');
		expect(temaInicial('azul', false)).toBe('light');
	});

	it('sin almacenamiento no falla y no recuerda nada', () => {
		expect(() => guardarPreferencia(CLAVE_TEMA, 'light')).not.toThrow();
		expect(leerPreferencia(CLAVE_TEMA)).toBeNull();
	});

	it('el script de app.html aplica el tema con la misma clave antes de pintar', () => {
		const html = readFileSync('src/app.html', 'utf8');
		const cabecera = html.slice(0, html.indexOf('%sveltekit.head%'));
		expect(cabecera).toContain(`localStorage.getItem('${CLAVE_TEMA}')`);
		expect(cabecera).toContain("setAttribute('data-theme', tema)");
		expect(cabecera).toContain('(prefers-color-scheme: dark)');
	});
});
