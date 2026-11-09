import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { handle } from './hooks.server';

const evento = (url: string) => ({ url: new URL(url) }) as unknown as RequestEvent;

describe('encabezados de seguridad', () => {
	it('se agregan a toda respuesta sin reemplazar los propios', async () => {
		const respuesta = await handle({
			event: evento('http://localhost/'),
			resolve: async () => new Response('ok', { headers: { 'Referrer-Policy': 'no-referrer' } })
		});
		expect(respuesta.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(respuesta.headers.get('X-Frame-Options')).toBe('DENY');
		expect(respuesta.headers.get('Referrer-Policy')).toBe('no-referrer');
		expect(respuesta.headers.get('Strict-Transport-Security')).toBeNull();
	});

	it('HSTS solo sobre HTTPS y también en respuestas con encabezados inmutables', async () => {
		const respuesta = await handle({
			event: evento('https://reportes.ejemplo/'),
			resolve: async () => Response.redirect('https://reportes.ejemplo/otra', 302)
		});
		expect(respuesta.status).toBe(302);
		expect(respuesta.headers.get('Strict-Transport-Security')).toContain('max-age=');
		expect(respuesta.headers.get('X-Frame-Options')).toBe('DENY');
	});
});
