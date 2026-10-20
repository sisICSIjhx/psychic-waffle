import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { AvancePrograma } from '$lib/dominio/esquemas';
import { pendientesVencidos } from '$lib/dominio/planeacion';
import PlaneacionView from './PlaneacionView.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MESES = ['2026-05-01', '2026-06-01', '2026-07-01'];

const partidas: AvancePrograma['partidas'] = [
	{
		id: ID(7),
		numero: '7',
		actividad: 'Toma de potenciales tubo-suelo',
		periodicidad: 'mensual',
		distribucion: 'produccion',
		cantidadAnual: 3,
		celdas: [
			{ mes: MESES[0], programado: 1, realizado: 1, reportes: [ID(90)] },
			{ mes: MESES[1], programado: 1, realizado: 0, reportes: [] },
			{ mes: MESES[2], programado: 1, realizado: 0, reportes: [] }
		],
		totalProgramado: 3,
		totalRealizado: 1,
		diferencia: 0
	}
];

const contrato = {
	id: ID(2),
	clienteId: ID(5),
	numero: 'OC-FICTICIA',
	descripcion: null,
	vigenciaInicio: '2026-05-01',
	vigenciaFin: '2027-04-30',
	cliente: { id: ID(5), clave: 'ficticio', nombre: 'Ficticio', razonSocial: 'FICTICIO' },
	vigente: true
};
const sitio = { id: ID(3), clave: 'EM-99999', nombre: 'SITIO FICTICIO' };

function montar() {
	return render(PlaneacionView, {
		hoy: '2026-07-15',
		contratos: [contrato],
		contrato,
		sitios: [sitio],
		sitio,
		programa: {
			id: ID(1),
			contratoId: ID(2),
			sitioId: ID(3),
			nombre: null,
			periodoInicio: '2026-05-01',
			periodoFin: '2026-07-31',
			meses: MESES
		},
		meses: MESES,
		partidas,
		totalPartidas: 1,
		vencidos: pendientesVencidos(partidas, '2026-07-15'),
		filtro: { periodicidad: 'mensual' }
	});
}

describe('PlaneacionView', () => {
	it('marca el vencido de junio y abre la captura con la partida y el mes elegidos', async () => {
		const { container } = montar();
		const estados = [...container.querySelectorAll('tbody .celda')].map((c) =>
			[...c.classList].find((clase) => clase !== 'celda' && !clase.startsWith('s-'))
		);
		expect(estados).toEqual(['cumplido', 'vencido', 'pendiente']);

		const capturar = page.getByRole('link', { name: 'Capturar partida 7 de JUNIO 2026' });
		await expect
			.element(capturar)
			.toHaveAttribute('href', expect.stringContaining(`partida=${ID(7)}`));
		await expect
			.element(capturar)
			.toHaveAttribute('href', expect.stringContaining('mes=2026-06-01'));
		await expect.element(page.getByText('Pendientes vencidos (1)')).toBeInTheDocument();
	});

	it('enlaza el realizado con los reportes emitidos de la partida en ese mes', async () => {
		montar();
		const realizado = page.getByRole('link', { name: 'R 1' });
		await expect
			.element(realizado)
			.toHaveAttribute(
				'href',
				expect.stringMatching(/partida=.*&desde=2026-05&hasta=2026-05&estado=emitido/)
			);
		await expect.element(page.getByLabelText('Periodicidad')).toHaveValue('mensual');
	});
});
