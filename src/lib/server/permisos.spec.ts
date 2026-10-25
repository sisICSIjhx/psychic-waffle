import { describe, expect, it } from 'vitest';
import { contextoBitacora, puedeEditarCatalogo } from './permisos';

const usuario = (rol: 'administrador' | 'capturista') => ({
	id: '00000000-0000-4000-8000-000000000001',
	nombre: 'Persona Ficticia',
	rol
});

describe('permisos del catálogo', () => {
	it('sin autenticación todos editan y la bitácora queda sin usuario', () => {
		expect(puedeEditarCatalogo({})).toBe(true);
		expect(contextoBitacora({})).toEqual({
			usuarioId: null,
			usuarioTexto: null,
			origen: 'interfaz'
		});
	});

	it('con autenticación solo editan los administradores', () => {
		expect(puedeEditarCatalogo({ autenticacion: true, usuario: usuario('administrador') })).toBe(
			true
		);
		expect(puedeEditarCatalogo({ autenticacion: true, usuario: usuario('capturista') })).toBe(
			false
		);
		expect(puedeEditarCatalogo({ autenticacion: true, usuario: null })).toBe(false);
	});

	it('toma el usuario de la sesión aunque el formulario traiga otro', () => {
		const formulario = new FormData();
		formulario.set('usuarioId', '00000000-0000-4000-8000-000000000999');
		const locals = { autenticacion: true, usuario: usuario('administrador') };
		expect(contextoBitacora(locals)).toEqual({
			usuarioId: '00000000-0000-4000-8000-000000000001',
			usuarioTexto: 'Persona Ficticia',
			origen: 'interfaz'
		});
	});
});
