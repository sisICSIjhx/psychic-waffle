import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { CeldaPrograma, CumplimientoPrograma } from '$lib/dominio/esquemas';
import type { EstatusCentro, Kpi } from '$lib/dominio/estatus';
import CumplimientoView from '$lib/components/views/CumplimientoView.svelte';
import IndicadoresCumplimiento from './IndicadoresCumplimiento.svelte';
import ReportesQueFaltan from './ReportesQueFaltan.svelte';
import TendenciaCumplimiento from './TendenciaCumplimiento.svelte';
import type { TarjetaTablero } from './tablero';

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
		expect(container.querySelectorAll('svg[role=img] circle')).toHaveLength(1);
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

	// Tablero de estatus (cambio kpi-estatus-centros): tarjetas por centro de costo.
	const kpi = (clave: Kpi['clave'], valor: number, total: number, cambios = {}): Kpi => ({
		clave,
		etiqueta:
			clave === 'ejecucion' ? 'Ejecución' : clave === 'cobranza' ? 'Cobranza' : 'Documentos',
		valor,
		total,
		porcentaje: total ? (100 * valor) / total : null,
		semaforo: null,
		detalle: '',
		...cambios
	});
	const tarjeta = (
		n: number,
		clave: string,
		estatus: EstatusCentro,
		cambios: Partial<TarjetaTablero> = {}
	): TarjetaTablero => ({
		centro: { id: ID(40 + n), clave, nombre: `Centro ${n}`, sinPlantilla: false },
		estatus,
		kpis: [kpi('ejecucion', n, 10, { alcance: 'mes' }), kpi('documentos', 1, 4)],
		falta: [
			{ texto: 'Faltan 2 actividades por ejecutar', destino: 'seguimiento', ancla: 'actividades' },
			{ texto: 'Falta 1 ODT', destino: 'seguimiento', ancla: 'actividades' }
		],
		pendientes: 2,
		emergencias: 0,
		contratoId: null,
		...cambios
	});
	const tarjetas = [
		tarjeta(1, 'EM-00001', 'atrasado', {
			kpis: [
				kpi('ejecucion', 1, 10, { alcance: 'ciclo' }),
				kpi('cobranza', 62, 100, { esMonto: true })
			],
			contratoId: ID(1)
		}),
		tarjeta(2, 'EM-00002', 'atrasado'),
		tarjeta(3, 'EM-00003', 'con_pendientes'),
		tarjeta(4, 'OMA EJEMPLO', 'sin_datos', { kpis: [], falta: [], pendientes: 0 })
	];
	const tablero = (cambios = {}, concentrado = {}) =>
		props({
			corte: '2026-10-01',
			concentrado: { tarjetas, estatus: null, busqueda: '', ...concentrado },
			...cambios
		});
	const claves = (container: Element) =>
		[...container.querySelectorAll('.tarjeta-centro h3')].map((h) => h.textContent);

	it('el tablero resume los centros, los ordena y enlaza el filtro por estatus y el mes', async () => {
		const { container } = render(CumplimientoView, tablero({ verCobranza: true }));
		await expect
			.element(
				page.getByText(
					'4 centros de costo en octubre 2026: 2 atrasados, 1 con pendientes, 0 al corriente y 1 sin datos.'
				)
			)
			.toBeInTheDocument();
		expect(claves(container)).toEqual(['EM-00001', 'EM-00002', 'EM-00003', 'OMA EJEMPLO']);
		// Solo la primera atrasada lleva la acción principal.
		expect(container.querySelectorAll('.tarjeta-centro .boton.primario')).toHaveLength(1);
		expect(
			container.querySelector('.tarjeta-centro .boton.primario')?.getAttribute('aria-label')
		).toContain('EM-00001');

		const filtro = (nombre: string) =>
			container.querySelector(`[data-filtro="${nombre}"]`) as HTMLElement;
		expect(filtro('atrasado').getAttribute('href')).toBe(
			'/cumplimiento?corte=2026-10&estatus=atrasado'
		);
		expect(filtro('atrasado').textContent?.replace(/\s+/g, ' ').trim()).toBe('Atrasados 2');
		// Un estatus sin centros se ve atenuado y no es enlace.
		expect([filtro('al_corriente').tagName, filtro('al_corriente').getAttribute('href')]).toEqual([
			'SPAN',
			null
		]);
		await expect
			.element(page.getByRole('link', { name: /^Todos/ }))
			.toHaveAttribute('aria-current', 'true');

		// Octubre es el mes en curso: se puede ir atrás, no adelante.
		await expect
			.element(page.getByRole('link', { name: 'Ir a septiembre 2026' }))
			.toHaveAttribute('href', '/cumplimiento?corte=2026-09');
		expect(page.getByRole('link', { name: /^Ir a noviembre/ }).elements()).toHaveLength(0);
		// El mes de corte ya no es un campo de los filtros del programa: viaja oculto.
		expect(container.querySelector('#filtro-corte')).toBeNull();
		expect(
			(container.querySelector('.filtros input[name="corte"]') as HTMLInputElement).value
		).toBe('2026-10');
	});

	it('con un estatus elegido muestra solo esos centros y permite quitar el filtro', async () => {
		const { container } = render(CumplimientoView, tablero({}, { estatus: 'con_pendientes' }));
		expect(claves(container)).toEqual(['EM-00003']);
		expect(
			container.querySelector('[data-filtro="con_pendientes"]')?.getAttribute('aria-current')
		).toBe('true');
		await expect.element(page.getByRole('status')).toHaveTextContent('1 centro de costo.');
		await expect
			.element(page.getByRole('link', { name: 'Quitar filtros' }))
			.toHaveAttribute('href', '/cumplimiento?corte=2026-10');
		// Sin atrasados a la vista no hay acción principal.
		expect(container.querySelector('.tarjeta-centro .boton.primario')).toBeNull();
	});

	it('la búsqueda filtra al escribir, sin acentos, y dice cuando nada coincide', async () => {
		const { container } = render(CumplimientoView, tablero({}, { busqueda: 'oma' }));
		const campo = page.getByRole('searchbox', { name: 'Buscar centro de costo' });
		await expect.element(campo).toHaveValue('oma');
		expect(claves(container)).toEqual(['OMA EJEMPLO']);

		await campo.fill('em-0000');
		await expect.element(page.getByRole('status')).toHaveTextContent('3 centros de costo.');
		expect(container.querySelectorAll('.tarjeta-centro')).toHaveLength(3);

		await campo.fill('xyz');
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Ningún centro coincide con «xyz». Revise la clave o quite el filtro.');
		expect(container.querySelectorAll('.tarjeta-centro')).toHaveLength(0);
	});

	it('la tabla repite el tablero y solo trae lo financiero con acceso al contrato', async () => {
		const encabezados = (container: Element) =>
			[...container.querySelectorAll('.como-tabla thead th')].map((th) => th.textContent);
		const conContrato = render(CumplimientoView, tablero({ verCobranza: true }));
		expect(encabezados(conContrato.container)).toEqual([
			'Centro de costo',
			'Estatus',
			'Ejecución',
			'Documentos',
			'Carpetas',
			'Cobranza',
			'Qué falta',
			'Abrir'
		]);
		const fila = conContrato.container.querySelector('.como-tabla tbody tr')!;
		expect([...fila.querySelectorAll('td.numero')].map((td) => td.textContent)).toEqual([
			'1 de 10',
			'—',
			'—',
			'62 %'
		]);
		expect(fila.querySelector('.falta')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'Faltan 2 actividades por ejecutar y 1 más'
		);
		expect([...fila.querySelectorAll('.abrir a')].map((a) => a.getAttribute('href'))).toEqual([
			`/seguimiento?centro=${ID(41)}&mes=2026-10`,
			`/cumplimiento?contrato=${ID(1)}&sitio=${ID(41)}&corte=2026-10`,
			`/cobranza?centro=${ID(41)}`
		]);
		conContrato.unmount();

		const sinContrato = render(CumplimientoView, tablero({ verCobranza: false }));
		expect(encabezados(sinContrato.container)).not.toContain('Cobranza');
		expect(sinContrato.container.querySelector('.tablero')?.innerHTML).not.toContain('/cobranza');
	});

	it('sin centros asignados lo explica y no ofrece filtros', async () => {
		const { container } = render(CumplimientoView, tablero({ programas: [] }, { tarjetas: [] }));
		await expect
			.element(page.getByText(/Aún no tiene centros de costo asignados/))
			.toBeInTheDocument();
		expect(container.querySelector('.pildoras')).toBeNull();
		expect(container.querySelector('#buscar-centro')).toBeNull();
	});

	it('con un contrato elegido no hay tablero y se puede volver a él', async () => {
		const { container } = render(CumplimientoView, props());
		await expect
			.element(page.getByRole('link', { name: 'Ver el estatus de los centros de costo' }))
			.toHaveAttribute('href', '/cumplimiento?corte=2026-10');
		expect(container.querySelector('.tablero')).toBeNull();
		expect(container.querySelector('#filtro-corte')).not.toBeNull();
	});
});
