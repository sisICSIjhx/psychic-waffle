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
			// Una ejecución con seis reportes (uno por TAG) más un realizado del Excel.
			{
				mes: MESES[0],
				programado: 1,
				realizado: 2,
				reportes: [ID(90), ID(91), ID(92), ID(93), ID(94), ID(95)],
				ejecucionesReportes: 1,
				realizadoSinReporte: 1
			},
			{
				mes: MESES[1],
				programado: 1,
				realizado: 0,
				reportes: [],
				ejecucionesReportes: 0,
				realizadoSinReporte: 0
			},
			{
				mes: MESES[2],
				programado: 1,
				realizado: 0,
				reportes: [],
				ejecucionesReportes: 0,
				realizadoSinReporte: 0
			}
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
	vigente: true,
	actualizadoEn: '2026-05-01T00:00:00Z'
};
const sitio = {
	id: ID(3),
	clave: 'EM-99999',
	nombre: 'SITIO FICTICIO',
	actualizadoEn: '2026-05-01T00:00:00Z'
};

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
		// El estado no depende solo del color: cada celda lleva símbolo y texto.
		const celdas = [...container.querySelectorAll('tbody .celda')];
		expect(celdas.map((c) => c.querySelector('.simbolo')?.textContent)).toEqual(['✓', '!', '●']);
		expect(celdas.map((c) => c.querySelector('.sr-only')?.textContent)).toEqual([
			'Cumplido:',
			'Vencido:',
			'Pendiente:'
		]);
		await expect
			.element(page.getByRole('list', { name: 'Leyenda de la matriz' }))
			.toHaveTextContent(/Cumplido.*Pendiente.*Vencido.*Realizado sin programar/);

		const capturar = page.getByRole('link', { name: 'Capturar partida 7 de junio 2026' });
		await expect
			.element(capturar)
			.toHaveAttribute('href', expect.stringContaining(`partida=${ID(7)}`));
		await expect
			.element(capturar)
			.toHaveAttribute('href', expect.stringContaining('mes=2026-06-01'));
		await expect.element(page.getByText('Pendientes vencidos (1)')).toBeInTheDocument();
	});

	it('enlaza solo los reportes emitidos y distingue lo realizado sin reporte', async () => {
		const { container } = montar();
		const realizado = page.getByRole('link', {
			name: 'Ver 6 reportes emitidos de la partida 7 en mayo 2026'
		});
		await expect
			.element(realizado)
			.toHaveAttribute(
				'href',
				expect.stringMatching(/partida=.*&desde=2026-05&hasta=2026-05&estado=emitido/)
			);
		// R 2 de mayo: una ejecución con seis reportes y una marca del Excel o un realizado manual.
		const mayo = container.querySelector('tbody .celda') as HTMLElement;
		expect(mayo.innerText.replace(/\s+/g, ' ')).toContain('R 2');
		expect(mayo.innerText).toContain('1 sin reporte');
		await expect.element(page.getByLabelText('Periodicidad')).toHaveValue('mensual');
	});
});
