import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearClientePglite } from './bd/pglite';
import { ErrorCambio, ejecutarCambio, leerCambio, leerConfirmacion } from './edicion-catalogo';
import { crearRepositorios, type Repositorios } from './repositorios/index';

let repos: Repositorios;

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
}, 60_000);

afterAll(() => repos.cerrar());

const formulario = (campos: Record<string, string>) => {
	const datos = new FormData();
	for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
	return datos;
};

async function base() {
	const cliente = await repos.catalogo.guardarCliente({
		clave: 'ficticio',
		nombre: 'Ficticio',
		razonSocial: 'CLIENTE FICTICIO'
	});
	const contrato = await repos.catalogo.guardarContrato({
		clienteId: cliente.id,
		numero: 'OC-PROVISIONAL',
		descripcion: null,
		vigenciaInicio: '2026-03-01',
		vigenciaFin: '2027-02-28'
	});
	const sitio = await repos.catalogo.guardarSitio({ clave: 'EM-90001', nombre: 'AREA IV' });
	await repos.catalogo.asociarSitio(contrato.id, sitio.id);
	const firmante = await repos.catalogo.guardarFirmante({
		contratoId: contrato.id,
		funcion: 'recibio',
		nombre: 'Persona Ficticia',
		cargo: 'Supervisor',
		empresa: 'Empresa',
		vigenteDesde: '2026-03-01'
	});
	return { contrato, sitio, firmante };
}

describe('edición del catálogo desde el formulario', () => {
	it('lee solo los campos del tipo y rechaza un tipo desconocido o un motivo corto', () => {
		expect(
			leerCambio(formulario({ tipo: 'quitarSitio', sitioId: 'x', numero: 'ignorado' })).campos
		).toEqual({ tipo: 'quitarSitio', sitioId: 'x' });
		expect(() => leerCambio(formulario({ tipo: 'borrarTodo' }))).toThrow(ErrorCambio);
		expect(() => leerConfirmacion(formulario({ motivo: 'error' }))).toThrow(
			/Faltan al menos 5 caracteres/
		);
		expect(
			leerConfirmacion(formulario({ motivo: '  Número provisional  ', actualizarBorradores: 'on' }))
		).toEqual({ motivo: 'Número provisional', actualizarBorradores: true });
		expect(
			leerConfirmacion(formulario({ motivo: 'Número provisional' })).actualizarBorradores
		).toBe(false);
	});

	it('ensaya y aplica cada tipo de cambio con los campos del formulario', async () => {
		const { contrato, sitio, firmante } = await base();
		const ensayar = (campos: Record<string, string>) =>
			ejecutarCambio(repos.catalogo, contrato.id, leerCambio(formulario(campos)), {
				ensayo: true
			});
		const contratoCampos = {
			tipo: 'contrato',
			actualizadoEn: contrato.actualizadoEn,
			numero: 'OC-DEFINITIVA',
			descripcion: '',
			vigenciaInicio: contrato.vigenciaInicio,
			vigenciaFin: contrato.vigenciaFin
		};
		expect((await ensayar(contratoCampos)).cambios).toEqual([
			{ campo: 'numero', antes: 'OC-PROVISIONAL', despues: 'OC-DEFINITIVA' }
		]);
		expect(
			(
				await ensayar({
					tipo: 'sitio',
					sitioId: sitio.id,
					actualizadoEn: sitio.actualizadoEn,
					clave: sitio.clave,
					nombre: 'AREA VI'
				})
			).cambios
		).toEqual([{ campo: 'nombre', antes: 'AREA IV', despues: 'AREA VI' }]);
		expect((await ensayar({ tipo: 'quitarSitio', sitioId: sitio.id })).cambios[0].campo).toBe(
			'sitio'
		);
		expect(
			(
				await ensayar({
					tipo: 'corregirFirmante',
					firmanteId: firmante.id,
					actualizadoEn: firmante.actualizadoEn,
					nombre: firmante.nombre,
					cargo: 'Supervisora',
					empresa: firmante.empresa,
					vigenteDesde: firmante.vigenteDesde,
					vigenteHasta: ''
				})
			).cambios
		).toEqual([{ campo: 'cargo', antes: 'Supervisor', despues: 'Supervisora' }]);
		expect(
			(
				await ensayar({
					tipo: 'cambiarFirmante',
					firmanteId: firmante.id,
					actualizadoEn: firmante.actualizadoEn,
					desde: '2026-11-15',
					nombre: 'Otra Persona Ficticia',
					cargo: '',
					empresa: ''
				})
			).impacto.desdeMes
		).toBe('2026-12-01');

		// Nada de lo ensayado quedó en la bitácora (solo las 4 altas).
		expect((await repos.catalogo.listarCambios(contrato.id)).total).toBe(4);
		const aplicado = await ejecutarCambio(
			repos.catalogo,
			contrato.id,
			leerCambio(formulario(contratoCampos)),
			{ ensayo: false, motivo: 'Número provisional corregido' }
		);
		expect(aplicado.aplicado?.cambioId).toBeDefined();
		expect((await repos.catalogo.listarCambios(contrato.id)).total).toBe(5);
	});
});
