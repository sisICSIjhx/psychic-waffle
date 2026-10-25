import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { CeldaPrograma, CumplimientoPrograma } from '$lib/dominio/esquemas';
import CumplimientoView from '$lib/components/views/CumplimientoView.svelte';
import IndicadoresCumplimiento from './IndicadoresCumplimiento.svelte';
import ReportesQueFaltan from './ReportesQueFaltan.svelte';
import TendenciaCumplimiento from './TendenciaCumplimiento.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOY = '2026-10-21';

const celda = (mes: string, cambios: Partial<CeldaPrograma> = {}): CeldaPrograma => ({
	mes,
	programado: 1,
	realizado: 0,
	reportes: [],
	ejecucionesReportes: 0,
	realizadoSinReporte: 0,
	salida: 0,
	entrada: 0,
	noEjecutado: 0,
	ajustes: [],
	reportesAbiertos: [],
	...cambios
});

const programa = (n: number, clave: string, celdas: CeldaPrograma[]): CumplimientoPrograma => ({
	contrato: {
		id: ID(1),
		clienteId: ID(2),
		numero: 'OC-PROAGRO',
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30',
		cliente: { id: ID(2), clave: 'proagro', nombre: 'Proagro', razonSocial: 'PROAGRO' },
		actualizadoEn: '2026-05-01T00:00:00Z'
	},
	sitio: { id: ID(10 + n), clave, nombre: '', actualizadoEn: '2026-05-01T00:00:00Z' },
	avance: {
		programa: {
			id: ID(20 + n),
			contratoId: ID(1),
			sitioId: ID(10 + n),
			nombre: null,
			periodoInicio: '2026-05-01',
			periodoFin: '2027-04-30',
			meses: []
		},
		partidas: [
			{
				id: ID(30 + n),
				numero: String(n),
				actividad: `Partida ${n}`,
				periodicidad: 'mensual',
				distribucion: null,
				cantidadAnual: null,
				celdas,
				totalProgramado: 0,
				totalRealizado: 0,
				diferencia: null
			}
		]
	}
});

const indicadores = (cambios = {}) => ({
	PR: 10,
	E: 7,
	R: 2,
	N: 2,
	P: 1,
	extras: 0,
	conReporte: 5,
	...cambios
});

describe('IndicadoresCumplimiento y semáforos', () => {
	it('muestra porcentaje, icono y texto; sin datos muestra «—» sin semáforo', async () => {
		const { rerender } = render(IndicadoresCumplimiento, { indicadores: indicadores() });
		await expect.element(page.getByText('77 %').first()).toBeInTheDocument();
		await expect.element(page.getByText('71 %')).toBeInTheDocument();
		await expect.element(page.getByText('Cerca de la meta').first()).toBeInTheDocument();
		await rerender({ indicadores: indicadores({ E: 0, N: 0, R: 0, conReporte: 0 }) });
		expect(page.getByText('Sin datos').elements()).toHaveLength(3);
		expect(page.getByText(/meta$/).elements()).toHaveLength(0);
	});
});

describe('TendenciaCumplimiento', () => {
	it('deja sin punto el mes sin datos y muestra «—» en la tabla', async () => {
		const { container } = render(TendenciaCumplimiento, {
			meses: [
				{ mes: '2026-05-01', cumplimiento: 100, efectividad: 100 },
				{ mes: '2026-06-01', cumplimiento: null, efectividad: null }
			]
		});
		expect(container.querySelectorAll('circle')).toHaveLength(1);
		const junio = [...container.querySelectorAll('tbody tr')].find((f) =>
			f.textContent?.includes('Junio')
		);
		expect([...junio!.querySelectorAll('td')].map((c) => c.textContent)).toEqual(['—', '—']);
	});
});

describe('ReportesQueFaltan', () => {
	it('enlaza «Capturar» con contrato, sitio, partida y mes, «Continuar borrador» y «Ver los N»', async () => {
		const elemento = (n: number, cambios = {}) => ({
			contratoId: ID(1),
			sitioId: ID(11),
			sitio: 'EM-30167',
			partidaId: ID(30 + n),
			numero: String(n),
			actividad: `Partida ${n}`,
			mes: '2026-06-01',
			cantidad: 1,
			reporteId: null,
			...cambios
		});
		render(ReportesQueFaltan, {
			abiertos: [elemento(7, { mes: '2026-10-01', reporteId: ID(60) })],
			vencidos: Array.from({ length: 12 }, (_, i) => elemento(i + 1)),
			ejecutadosSinReporte: []
		});
		await expect
			.element(page.getByRole('link', { name: 'Continuar borrador' }))
			.toHaveAttribute('href', `/reportes/${ID(60)}`);
		const capturar = page.getByRole('link', { name: 'Capturar' }).first();
		await expect
			.element(capturar)
			.toHaveAttribute(
				'href',
				`/captura?contrato=${ID(1)}&sitio=${ID(11)}&partida=${ID(31)}&mes=2026-06-01`
			);
		await expect.element(page.getByText('Ver los 12')).toBeInTheDocument();
		await expect.element(page.getByText('Ejecutados sin reporte (0)')).toBeInTheDocument();
	});
});

describe('CumplimientoView', () => {
	const props = (cambios = {}) => ({
		hoy: HOY,
		corte: '2026-10-01',
		programas: [
			programa(1, 'EM-30184', [celda('2026-06-01', { ejecucionesReportes: 1 })]),
			programa(2, 'EM-30185', [celda('2026-06-01')])
		],
		...cambios
	});

	it('muestra el aviso de datos al día, la tabla con subtotal y el enlace a la planeación', async () => {
		render(CumplimientoView, props());
		await expect.element(page.getByText(/Datos al día de hoy/)).toBeInTheDocument();
		await expect.element(page.getByText('Subtotal OC-PROAGRO')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: /EM-30185/ }))
			.toHaveAttribute('href', `/planeacion?contrato=${ID(1)}&sitio=${ID(12)}`);
		await expect.element(page.getByText('Vencidos sin reporte (1)')).toBeInTheDocument();
	});

	it('sin programas explica el caso y ofrece la planeación y el catálogo', async () => {
		render(CumplimientoView, props({ programas: [], corteLimitado: true }));
		await expect
			.element(page.getByText(/No hay programas que contengan octubre 2026/))
			.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'planeación' })).toBeInTheDocument();
		await expect
			.element(page.getByText(/no puede ser posterior al mes en curso/))
			.toBeInTheDocument();
	});
});
