import { describe, expect, it } from 'vitest';
import { elegirOrigenDatos } from './datos';

describe('origen de los datos', () => {
	it('usa Supabase con ambas variables y PGlite sin ninguna', () => {
		expect(elegirOrigenDatos('https://x.supabase.co', 'clave')).toBe('supabase');
		expect(elegirOrigenDatos('', undefined)).toBe('pglite');
		expect(elegirOrigenDatos(undefined, '  ')).toBe('pglite');
	});

	it('se detiene si la configuración de Supabase está incompleta', () => {
		expect(() => elegirOrigenDatos('https://x.supabase.co', '')).toThrow(
			/SUPABASE_SERVICE_ROLE_KEY/
		);
		expect(() => elegirOrigenDatos('', 'clave')).toThrow(/PUBLIC_SUPABASE_URL/);
	});
});
