import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertirError, ErrorDatos } from './cliente';

const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ rpc })) }));

const { crearClienteSupabase } = await import('./supabase');

describe('conversión de errores de datos', () => {
	it('traduce los códigos propios y de PostgreSQL y lee el detalle JSON', () => {
		const conflicto = convertirError({
			code: 'IC409',
			message: 'Hay una versión más reciente',
			detail: '{"versionActual":3}'
		});
		expect(conflicto).toBeInstanceOf(ErrorDatos);
		expect(conflicto).toMatchObject({
			tipo: 'conflicto',
			codigo: 'IC409',
			detalle: { versionActual: 3 }
		});
		expect(convertirError({ code: '23505', message: 'duplicado' }).tipo).toBe('invalido');
		expect(convertirError({ code: 'IC404', message: 'x', details: 'no es json' }).detalle).toEqual(
			{}
		);
		expect(convertirError(new Error('caída')).tipo).toBe('desconocido');
	});
});

describe('implementación Supabase', () => {
	beforeEach(() => rpc.mockReset());

	it('llama la función api_* por rpc con el argumento «p»', async () => {
		rpc.mockResolvedValue({ data: [{ id: 'x' }], error: null });
		const cliente = crearClienteSupabase('https://ejemplo.supabase.co', 'clave-de-servicio');
		await expect(cliente.llamar('api_listar_clientes', { a: 1 })).resolves.toEqual([{ id: 'x' }]);
		expect(rpc).toHaveBeenCalledWith('api_listar_clientes', { p: { a: 1 } });
	});

	it('convierte el error de rpc y no permite funciones ajenas a la API', async () => {
		rpc.mockResolvedValue({
			data: null,
			error: { code: 'IC422', message: 'Sitio duplicado', details: '{"motivo":"sitio_duplicado"}' }
		});
		const cliente = crearClienteSupabase('https://ejemplo.supabase.co', 'clave-de-servicio');
		await expect(cliente.llamar('api_guardar_sitio', {})).rejects.toMatchObject({
			tipo: 'invalido',
			detalle: { motivo: 'sitio_duplicado' }
		});
		await expect(cliente.llamar('pg_terminate_backend')).rejects.toThrow(/no permitida/);
		expect(() => crearClienteSupabase('', '')).toThrow(/Faltan/);
	});
});
