import { describe, expect, it } from 'vitest';
import { alcanceDe, centrosVisibles, exigirCentro, filtrarPor, recursoDeRuta } from './alcance';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const ID = '00000000-0000-4000-8000-000000000123';

const repos = (centrosDeRecurso: string[] = []) => ({
	centrosCosto: {
		contratosCentros: async () => [
			{ contratoId: 'k1', clienteId: 'c1', sitioIds: [A] },
			{ contratoId: 'k2', clienteId: 'c1', sitioIds: [B] },
			{ contratoId: 'k3', clienteId: 'c2', sitioIds: [A, B] },
			{ contratoId: 'k4', clienteId: 'c3', sitioIds: [] }
		],
		centrosDeRecurso: async () => centrosDeRecurso
	}
});

const limitado = (centros: string[] | null) => ({
	autenticacion: true,
	usuario: { centrosCosto: centros }
});

describe('centrosVisibles', () => {
	it('sin inicio de sesión activado se ven todos, como antes', () => {
		expect(centrosVisibles(undefined)).toBeNull();
		expect(centrosVisibles({ autenticacion: false, usuario: null })).toBeNull();
	});

	it('activado: los del usuario, todos si su rol los abarca y ninguno sin usuario', () => {
		expect(centrosVisibles(limitado([A]))).toEqual([A]);
		expect(centrosVisibles(limitado(null))).toBeNull();
		expect(centrosVisibles({ autenticacion: true, usuario: null })).toEqual([]);
	});
});

describe('alcanceDe y filtrarPor', () => {
	it('un contrato es visible con alguno de sus centros; un proyecto, con algún contrato', async () => {
		const alcance = await alcanceDe(repos() as never, limitado([A]));
		expect(alcance).not.toBeNull();
		expect([...alcance!.contratos].sort()).toEqual(['k1', 'k3']);
		expect([...alcance!.clientes].sort()).toEqual(['c1', 'c2']);
		const contratos = [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }, { id: 'k4' }];
		expect(filtrarPor(alcance, 'contratos', contratos, (c) => c.id)).toEqual([
			{ id: 'k1' },
			{ id: 'k3' }
		]);
	});

	it('sin centros asignados no se ve nada', async () => {
		const alcance = await alcanceDe(repos() as never, limitado([]));
		expect(filtrarPor(alcance, 'sitios', [{ id: A }], (s) => s.id)).toEqual([]);
		expect(alcance?.contratos.size).toBe(0);
	});

	it('con alcance null la lista queda igual', async () => {
		const alcance = await alcanceDe(repos() as never, limitado(null));
		expect(alcance).toBeNull();
		expect(filtrarPor(alcance, 'sitios', [{ id: A }], (s) => s.id)).toEqual([{ id: A }]);
	});
});

describe('exigirCentro', () => {
	it('deja pasar un recurso de sus centros y responde 404 a uno ajeno o con id no válido', async () => {
		await expect(exigirCentro(repos([A]) as never, limitado([A]), 'partida', ID)).resolves.toBe(
			undefined
		);
		await expect(
			exigirCentro(repos([B]) as never, limitado([A]), 'partida', ID)
		).rejects.toMatchObject({ status: 404 });
		await expect(
			exigirCentro(repos([A]) as never, limitado([A]), 'programa', 'no-es-un-id')
		).rejects.toMatchObject({ status: 404 });
		await expect(exigirCentro(repos([]) as never, undefined, 'programa', ID)).resolves.toBe(
			undefined
		);
	});
});

describe('recursoDeRuta', () => {
	it('reconoce los detalles con id y sus subrutas', () => {
		expect(recursoDeRuta(`/reportes/${ID}`)).toEqual({ tipo: 'reporte', id: ID });
		expect(recursoDeRuta(`/reportes/${ID}/fotos/${ID}`)).toEqual({ tipo: 'reporte', id: ID });
		expect(recursoDeRuta(`/reportes/${ID.toUpperCase()}/documento`)).toEqual({
			tipo: 'reporte',
			id: ID
		});
		expect(recursoDeRuta(`/catalogo/partidas/${ID}`)).toEqual({ tipo: 'partida', id: ID });
		expect(recursoDeRuta(`/catalogo/contratos/${ID}`)).toEqual({ tipo: 'contrato', id: ID });
		expect(recursoDeRuta(`/equipos/${ID}`)).toEqual({ tipo: 'equipo', id: ID });
	});

	it('ignora listas, altas y rutas que solo se parecen', () => {
		expect(recursoDeRuta('/reportes')).toBeNull();
		expect(recursoDeRuta('/equipos/nuevo')).toBeNull();
		expect(recursoDeRuta('/catalogo/partidas/nueva')).toBeNull();
		expect(recursoDeRuta(`/reportes/${ID}x`)).toBeNull();
		expect(recursoDeRuta(`/historial/${ID}`)).toBeNull();
	});
});
