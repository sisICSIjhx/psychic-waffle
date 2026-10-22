import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Contrato, Partida, PartidaResumen, Sitio } from '$lib/dominio/esquemas';
import type { ReporteDePartida, TrabajoDePartida } from '$lib/dominio/seleccion';
import CapturaView from './CapturaView.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MESES = ['2026-05-01', '2026-06-01', '2026-10-01', '2026-11-01'];

const contrato: Contrato = {
	id: ID(2),
	clienteId: ID(5),
	numero: 'OC-FICTICIA',
	descripcion: null,
	vigenciaInicio: '2026-05-01',
	vigenciaFin: '2027-04-30',
	cliente: { id: ID(5), clave: 'ficticio', nombre: 'Ficticio', razonSocial: 'FICTICIO' },
	vigente: true
};
const sitio: Sitio = { id: ID(3), clave: 'EM-99999', nombre: 'SITIO FICTICIO' };

function partidaResumen(numero: number, actividad: string): PartidaResumen {
	return {
		id: ID(numero),
		contratoId: ID(2),
		sitioId: ID(3),
		numero: String(numero),
		actividad,
		nombreCorto: null,
		periodicidad: 'mensual',
		distribucion: null,
		cantidadAnual: 12,
		disposicionFotos: 'cuadricula',
		proponeVerificacion: false,
		estadoCatalogo: 'confirmado',
		tieneEquipos: false
	};
}

const PARTIDAS = [
	partidaResumen(3, 'Rótulos de identificación'),
	partidaResumen(7, 'TOMA DE POTENCIALES TUBO-SUELO'),
	partidaResumen(12, 'Verificación de válvulas'),
	partidaResumen(17, 'Calibración de manómetros')
];

const trabajoDe = (
	grupo: TrabajoDePartida['grupo'],
	cambios: Partial<TrabajoDePartida> = {}
): TrabajoDePartida => ({ grupo, vencidos: [], estadoMes: null, borradores: [], ...cambios });

const TRABAJO: Record<string, TrabajoDePartida> = {
	[ID(3)]: trabajoDe('pendientes', { vencidos: ['2026-06-01'], estadoMes: 'pendiente' }),
	[ID(7)]: trabajoDe('pendientes', { estadoMes: 'pendiente' }),
	[ID(12)]: trabajoDe('con_borrador', {
		estadoMes: 'pendiente',
		borradores: [{ id: ID(500), titulo: 'B', periodoMes: '2026-10-01', ocurrencia: null }]
	}),
	[ID(17)]: trabajoDe('otras')
};

const partidaElegida = (equipos: { tag: string }[] = []) =>
	({
		...partidaResumen(7, 'TOMA DE POTENCIALES TUBO-SUELO'),
		equipos: equipos.map((e, i) => ({ id: ID(800 + i), tag: e.tag, descripcion: null }))
	}) as unknown as Partida;

function montar(cambios: Record<string, unknown> = {}) {
	return render(CapturaView, {
		contratos: [contrato],
		contrato,
		sitios: [sitio],
		sitio,
		partidas: PARTIDAS,
		meses: MESES,
		mesReferencia: '2026-10-01',
		mesSugerido: '2026-10-01',
		trabajo: TRABAJO,
		...cambios
	});
}

let enviados: FormData[] = [];
// En la fase de captura, antes de use:enhance: ningún envío llega al servidor de Vite de las pruebas.
const capturarEnvio = (evento: SubmitEvent) => {
	evento.preventDefault();
	evento.stopPropagation();
	enviados.push(new FormData(evento.target as HTMLFormElement));
};

describe('CapturaView', () => {
	beforeEach(() => {
		enviados = [];
		document.addEventListener('submit', capturarEnvio, true);
	});
	afterEach(() => document.removeEventListener('submit', capturarEnvio, true));

	it('resume el contrato y el sitio ya resueltos y permite cambiarlos', async () => {
		montar();
		await expect
			.element(page.getByText('Ficticio · OC-FICTICIA · EM-99999 SITIO FICTICIO'))
			.toBeInTheDocument();
		expect(page.getByLabelText('Contrato').elements()).toHaveLength(0);
		await page.getByRole('button', { name: 'Cambiar' }).click();
		await expect.element(page.getByLabelText('Contrato')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Sitio')).toBeInTheDocument();
	});

	it('con varios contratos también resume el contexto si ya viene elegido', async () => {
		montar({ contratos: [contrato, { ...contrato, id: ID(9), numero: 'OC-OTRA' }] });
		await expect
			.element(page.getByText('Ficticio · OC-FICTICIA · EM-99999 SITIO FICTICIO'))
			.toBeInTheDocument();
		const sinElegir = montar({
			contratos: [contrato, { ...contrato, id: ID(9) }],
			contrato: null,
			sitio: null
		});
		await expect.element(sinElegir.getByLabelText('Contrato')).toBeInTheDocument();
	});

	it('agrupa las partidas por el trabajo pendiente, con su estado y la vencida primero', async () => {
		montar();
		await expect.element(page.getByRole('heading', { name: '1 Partida' })).toBeInTheDocument();
		await page.getByRole('combobox', { name: 'Busque por número o actividad' }).click();
		const grupo = (nombre: string) =>
			[
				...page.getByRole('group', { name: nombre }).element().querySelectorAll('[role=option]')
			].map((o) => (o as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
		expect(grupo('Con borrador')).toEqual([
			expect.stringMatching(
				/^12\.- Verificación de válvulas ✎ ?Pendiente · octubre 2026 · con borrador/
			)
		]);
		expect(grupo('Pendientes')).toEqual([
			expect.stringMatching(/^3\.- Rótulos.*! ?Vencida · junio 2026/),
			expect.stringMatching(/^7\.- TOMA.*● ?Pendiente · octubre 2026/)
		]);
		expect(grupo('Otras partidas')).toEqual([expect.stringMatching(/^17\.- Calibración/)]);
	});

	it('al elegir una partida la pide en la dirección con el contrato y el sitio', async () => {
		montar();
		const campo = page.getByRole('combobox', { name: 'Busque por número o actividad' });
		await campo.fill('7');
		await userEvent.keyboard('{ArrowDown}{Enter}');
		await expect.poll(() => enviados.length).toBe(1);
		expect(Object.fromEntries(enviados[0])).toEqual({
			contrato: ID(2),
			sitio: ID(3),
			partida: ID(7)
		});
	});

	it('propone el mes sugerido y avisa si ya hay un borrador de la partida y periodo', async () => {
		const reportesPartida: ReporteDePartida[] = [
			{
				id: ID(600),
				titulo: 'Borrador de octubre',
				estado: 'borrador',
				periodoMes: '2026-10-01',
				ocurrencia: null,
				tags: null
			}
		];
		montar({ partida: partidaElegida(), reportesPartida });
		await expect.element(page.getByLabelText('Mes del reporte')).toHaveValue('2026-10-01');
		await expect
			.element(page.getByText('Ya existe un borrador de esta partida y periodo.'))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Continuar el borrador' }))
			.toHaveAttribute('href', `/reportes/${ID(600)}`);
		await expect.element(page.getByRole('button', { name: 'Crear reporte' })).toBeEnabled();

		await page.getByLabelText('Mes del reporte').selectOptions('2026-11-01');
		await expect
			.element(page.getByText('Ya existe un borrador de esta partida y periodo.'))
			.not.toBeInTheDocument();
	});

	it('una partida diaria se crea por mes completo o por semana', async () => {
		montar({
			partida: { ...partidaElegida(), periodicidad: 'diaria' } as unknown as Partida,
			tipoOcurrencia: 'semana',
			mesCompletoOpcional: true
		});
		const grupo = page.getByRole('radiogroup', { name: 'Periodo del reporte' });
		await expect
			.element(grupo.getByRole('radio', { name: 'Mes completo' }))
			.toHaveAttribute('aria-checked', 'true');
		expect(page.getByLabelText('Semana').elements()).toHaveLength(0);
		await page.getByRole('button', { name: 'Crear reporte' }).click();
		await expect.poll(() => enviados.length).toBe(1);
		expect(enviados[0].get('ocurrenciaTipo')).toBeNull();

		await grupo.getByRole('radio', { name: 'Por semana' }).click();
		await expect.element(page.getByLabelText('Semana')).toHaveValue('1');
		await page.getByRole('button', { name: 'Crear reporte' }).click();
		await expect.poll(() => enviados.length).toBe(2);
		expect(Object.fromEntries(enviados[1])).toMatchObject({
			ocurrenciaTipo: 'semana',
			ocurrenciaNumero: '1'
		});
	});

	it('con un reporte de otro TAG lo indica y permite crear el nuevo', async () => {
		montar({
			partida: partidaElegida([{ tag: 'PI-0001' }, { tag: 'PI-1001' }]),
			reportesPartida: [
				{
					id: ID(601),
					titulo: 'Emitido de PI-0001',
					estado: 'emitido',
					periodoMes: '2026-10-01',
					ocurrencia: null,
					tags: 'PI-0001'
				}
			]
		});
		await expect
			.element(page.getByText('Ya existe un reporte de esta partida y periodo.'))
			.toBeInTheDocument();
		await expect.element(page.getByText('TAG PI-0001', { exact: true })).toBeInTheDocument();
		await page.getByRole('checkbox', { name: 'PI-1001' }).click();
		await page.getByRole('button', { name: 'Crear reporte' }).click();
		await expect.poll(() => enviados.length).toBe(1);
		expect(enviados[0].getAll('equipoIds')).toEqual([ID(801)]);
	});
});
