import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Ajuste, AvancePrograma, CeldaPrograma } from '$lib/dominio/esquemas';
import { pendientesVencidos } from '$lib/dominio/planeacion';
import DialogoAjuste from '$lib/components/planeacion/DialogoAjuste.svelte';
import PlaneacionView from './PlaneacionView.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MESES = ['2026-05-01', '2026-06-01', '2026-07-01'];
const HOY = '2026-07-15';

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

const ajuste = (cambios: Partial<Ajuste> = {}): Ajuste => ({
	id: ID(80),
	programaId: ID(1),
	partidaId: ID(7),
	tipo: 'reprogramado',
	mesOrigen: '2026-05-01',
	mesDestino: '2026-07-01',
	cantidad: 1,
	motivo: 'clima',
	nota: null,
	registradoEn: '2026-05-20T00:00:00Z',
	anuladoEn: null,
	ejecuciones: 0,
	borradores: 0,
	bloqueantes: 0,
	...cambios
});

const partida = (
	n: number,
	celdas: CeldaPrograma[],
	cambios: Partial<AvancePrograma['partidas'][number]> = {}
): AvancePrograma['partidas'][number] => ({
	id: ID(n),
	numero: String(n),
	actividad: n === 7 ? 'Toma de potenciales tubo-suelo' : `Partida ${n}`,
	periodicidad: 'mensual',
	distribucion: 'produccion',
	cantidadAnual: 3,
	celdas,
	totalProgramado: 3,
	totalRealizado: 1,
	diferencia: 0,
	...cambios
});

// Mayo: una ejecución con seis reportes (uno por TAG) más un realizado del Excel; junio vencido;
// julio pendiente.
const partidas: AvancePrograma['partidas'] = [
	partida(7, [
		celda('2026-05-01', {
			realizado: 2,
			reportes: [ID(90), ID(91), ID(92), ID(93), ID(94), ID(95)],
			ejecucionesReportes: 1,
			realizadoSinReporte: 1
		}),
		celda('2026-06-01'),
		celda('2026-07-01')
	])
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
const programa = {
	id: ID(1),
	contratoId: ID(2),
	sitioId: ID(3),
	nombre: null,
	periodoInicio: '2026-05-01',
	periodoFin: '2026-07-31',
	meses: MESES
};

function montar(cambios: Record<string, unknown> = {}) {
	const lista = (cambios.partidas as AvancePrograma['partidas']) ?? partidas;
	return render(PlaneacionView, {
		hoy: HOY,
		contratos: [contrato],
		contrato,
		sitios: [sitio],
		sitio,
		programa,
		meses: MESES,
		partidas: lista,
		totalPartidas: lista.length,
		vencidos: pendientesVencidos(lista, HOY),
		filtro: { periodicidad: 'mensual' },
		...cambios
	});
}

/** Elige la celda de la partida 7 en el mes dado; el panel lateral muestra sus acciones. */
const elegirCelda = (mes: string) =>
	page.getByRole('button', { name: new RegExp(`^Partida 7, ${mes}`) }).click();

const clases = (contenedor: HTMLElement) =>
	[...contenedor.querySelectorAll('tbody .celda')].map((c) =>
		[...c.classList].find((clase) => clase !== 'celda' && !clase.startsWith('s-'))
	);

describe('PlaneacionView: matriz anual', () => {
	it('muestra ambos estados en cada tarjeta y abre la captura de junio desde el panel', async () => {
		const { container } = montar();
		expect(clases(container)).toEqual(['ejecutado', 'vencido', 'pendiente']);
		const celdas = [...container.querySelectorAll('tbody .celda')];
		const texto = (selector: string) =>
			celdas.map((c) => c.querySelector(selector)?.textContent?.trim());
		expect(texto('.linea-celda.estado')).toEqual(['Ejecutado', 'Vencido', 'Pendiente']);
		expect(texto('.linea-celda.documento')).toEqual(['Con reporte', 'Sin reporte', 'Sin reporte']);
		expect(celdas[1].querySelector('.sr-only')?.textContent).toBe(
			'Partida 7, junio 2026: programado 1, ejecutado 0, Vencido, Sin reporte'
		);
		// «Visualizar» solo enlaza donde hay reportes; sin reporte queda inactivo.
		expect(celdas.map((c) => c.querySelector('a.visualizar') !== null)).toEqual([
			true,
			false,
			false
		]);
		await expect
			.element(page.getByRole('list', { name: 'Leyenda de la matriz' }))
			.toHaveTextContent(/Ejecutado.*Pendiente.*Programado.*Vencido.*Reprogramado.*No ejecutado/);
		const indicadores = page.getByRole('region', { name: 'Indicadores del ciclo' });
		await expect.element(indicadores).toHaveTextContent(/Total programado\s*3 en el ciclo/);
		await expect.element(indicadores).toHaveTextContent(/Ejecutadas\s*1 33%/);
		await expect.element(indicadores).toHaveTextContent(/Pendientes\s*1 33%/);

		await elegirCelda('junio 2026');
		const panel = page.getByRole('complementary', { name: 'Toma de potenciales tubo-suelo' });
		await expect.element(panel).toHaveTextContent(/Programado\s*1\s*Realizado\s*0/);
		await expect.element(panel).toHaveTextContent('Periodicidad: Mensual');
		await expect
			.element(page.getByText('Mensual: el programa anual marca junio 2026 con 1 ejecución.'))
			.toBeInTheDocument();
		const capturar = page.getByRole('link', { name: 'Capturar partida 7 de junio 2026' });
		await expect
			.element(capturar)
			.toHaveAttribute('href', expect.stringContaining(`partida=${ID(7)}`));
		await expect
			.element(capturar)
			.toHaveAttribute('href', expect.stringContaining('mes=2026-06-01'));
		await page.getByRole('button', { name: /^Vencidas/ }).click();
		await expect
			.element(page.getByRole('heading', { name: '1 vencimiento · Junio 2026' }))
			.toBeInTheDocument();
	});

	it('enlaza los reportes emitidos y distingue lo realizado sin reporte', async () => {
		const { container } = montar();
		await elegirCelda('mayo 2026');
		await expect
			.element(
				page.getByRole('link', { name: 'Ver 6 reportes emitidos de la partida 7 en mayo 2026' })
			)
			.toHaveAttribute(
				'href',
				expect.stringMatching(/partida=.*&desde=2026-05&hasta=2026-05&estado=emitido/)
			);
		const mayo = container.querySelector('tbody .celda') as HTMLElement;
		expect(mayo.querySelector('.sr-only')?.textContent).toContain('ejecutado 2');
		await expect
			.element(
				page.getByRole('link', { name: 'Visualizar los reportes de la partida 7 de mayo 2026' })
			)
			.toHaveAttribute('href', expect.stringMatching(/^\/historial\?.*estado=emitido/));
		await expect.element(page.getByLabelText('Periodicidad')).toHaveValue('mensual');
	});

	it('anota lo reprogramado y solo ofrece «Ajustar» donde falta algo o hay ajustes', async () => {
		const reprogramado = ajuste();
		const { container } = montar({
			partidas: [
				partida(7, [
					celda('2026-05-01', { salida: 1, ajustes: [reprogramado] }),
					celda('2026-06-01', { ejecucionesReportes: 1, realizado: 1 }),
					celda('2026-07-01', { entrada: 1, programado: 0, ajustes: [reprogramado] })
				])
			]
		});
		expect(clases(container)).toEqual(['reprogramado', 'ejecutado', 'pendiente']);
		const celdas = [...container.querySelectorAll('tbody .celda')];
		expect(celdas[0].textContent).toContain('→ jul');
		expect(celdas[2].textContent).toContain('+1 desde may');
		const ajustable: boolean[] = [];
		for (const mes of ['mayo 2026', 'junio 2026', 'julio 2026']) {
			await elegirCelda(mes);
			ajustable.push(
				page.getByRole('button', { name: `Ajustes de la partida 7 en ${mes}` }).elements().length >
					0
			);
		}
		expect(ajustable).toEqual([true, false, true]);
		await expect
			.element(page.getByRole('link', { name: 'Capturar partida 7 de julio 2026' }))
			.toHaveAttribute('href', expect.stringContaining(`reprogramacion=${reprogramado.id}`));
		await expect
			.element(
				page.getByText(
					'Mensual: el programa anual no marca julio 2026. Con los ajustes, el mes espera 1 ejecución.'
				)
			)
			.toBeInTheDocument();
	});

	it('explica el programado de una partida semanal por las semanas marcadas', async () => {
		montar({
			partidas: [
				partida(
					7,
					[celda('2026-05-01'), celda('2026-06-01', { programado: 5 }), celda('2026-07-01')],
					{
						periodicidad: 'semanal'
					}
				)
			]
		});
		await elegirCelda('junio 2026');
		await expect
			.element(
				page.getByText(
					'Semanal: el programa anual marca 5 semanas en junio 2026; una ejecución por semana.'
				)
			)
			.toBeInTheDocument();
	});

	it('el diálogo de ajuste empieza en «Cancelar», ofrece meses posteriores y exige nota con «Otro»', async () => {
		montar();
		await page.getByRole('button', { name: /^Vencidas/ }).click();
		await page
			.getByRole('button', {
				name: 'Reprogramar o marcar no ejecutada la partida 7 de junio 2026'
			})
			.click();
		const dialogo = page.getByRole('dialog', { name: 'Partida 7 · Junio 2026' });
		await expect.element(dialogo).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
		const destinos = [
			...(page.getByLabelText('Mes destino').element() as HTMLSelectElement).options
		].map((o) => o.value);
		expect(destinos).toEqual(['2026-07-01']);
		const confirmar = page.getByRole('button', { name: 'Reprogramar', exact: true }).last();
		await expect.element(confirmar).toBeDisabled();
		await page.getByLabelText('Motivo').selectOptions('otro');
		await expect.element(confirmar).toBeDisabled();
		await page.getByLabelText('Nota (obligatoria con «Otro»)').fill('Paro de la planta');
		await expect.element(confirmar).toBeEnabled();
		await userEvent.keyboard('{Escape}');
		await expect.element(dialogo).not.toBeInTheDocument();
	});
});

describe('PlaneacionView: búsqueda y filtro de la matriz', () => {
	it('busca por número o actividad sin acentos y filtra por estado', async () => {
		const { container } = montar({
			partidas: [
				partidas[0],
				partida(8, [
					celda('2026-05-01', { ejecucionesReportes: 1, realizado: 1 }),
					celda('2026-06-01', { ejecucionesReportes: 1, realizado: 1 }),
					celda('2026-07-01', { reportesAbiertos: [{ id: ID(61), estado: 'borrador' }] })
				])
			]
		});
		const filas = () =>
			[...container.querySelectorAll('tbody .columna-numero')].map((n) => n.textContent);
		expect(filas()).toEqual(['7', '8']);
		await page.getByLabelText('Buscar partidas').fill('potencíales');
		expect(filas()).toEqual(['7']);
		await page.getByLabelText('Buscar partidas').fill('zzz');
		await expect
			.element(page.getByText('Ninguna partida coincide con la búsqueda o el filtro.'))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Mostrar todas' }).click();
		expect(filas()).toEqual(['7', '8']);
		await page.getByTitle('Filtrar por estado').click();
		await page.getByRole('button', { name: 'Vencido', exact: true }).click();
		expect(filas()).toEqual(['7']);
		// El borrador de julio se visualiza en el editor.
		await page.getByTitle('Filtrar por estado').click();
		await page.getByRole('button', { name: 'Todas las partidas' }).click();
		await expect
			.element(
				page.getByRole('link', { name: 'Visualizar el reporte de la partida 8 de julio 2026' })
			)
			.toHaveAttribute('href', `/reportes/${ID(61)}`);
	});
});

describe('DialogoAjuste', () => {
	it('sin faltante solo ofrece anular, avisa de los borradores y muestra el error del servidor', async () => {
		const target = document.body.appendChild(document.createElement('div'));
		const { rerender } = render(DialogoAjuste, {
			target,
			props: {
				programaId: ID(1),
				partida: { id: ID(7), numero: '7', actividad: 'Partida 7' },
				celda: celda('2026-05-01', {
					salida: 1,
					ajustes: [ajuste({ borradores: 1 }), ajuste({ id: ID(81), bloqueantes: 1 })]
				}),
				meses: MESES,
				error: 'El ajuste ya estaba anulado'
			}
		});
		await rerender({ abierto: true });
		const dialogo = page.getByRole('dialog');
		await expect.element(dialogo).toHaveTextContent('No falta nada por ejecutar en mayo 2026.');
		expect(
			page.getByRole('button', { name: /Reprogramar|Marcar no ejecutado/ }).elements()
		).toHaveLength(0);
		const anular = page.getByRole('button', { name: 'Anular' });
		await expect.element(anular.first()).toBeEnabled();
		await expect.element(anular.last()).toBeDisabled();
		await expect.element(dialogo).toHaveTextContent('su borrador deja de estar ligado');
		await expect.element(dialogo).toHaveTextContent('tiene reportes en revisión o emitidos');
		await expect.element(page.getByRole('alert')).toHaveTextContent('El ajuste ya estaba anulado');
	});
});

describe('PlaneacionView: vistas mensual y semanal', () => {
	it('anual por omisión; el selector conserva los filtros y marca la vista actual', async () => {
		montar();
		await expect
			.element(page.getByRole('link', { name: 'Anual' }))
			.toHaveAttribute('aria-current', 'page');
		const mensual = page.getByRole('link', { name: 'Mensual' });
		await expect.element(mensual).toHaveAttribute('href', expect.stringContaining('vista=mensual'));
		await expect
			.element(mensual)
			.toHaveAttribute('href', expect.stringContaining('periodicidad=mensual'));
		await expect.element(page.getByRole('table')).toBeInTheDocument();
	});

	it('la lista mensual agrupa por urgencia, ofrece «Continuar borrador» y no pasa del periodo', async () => {
		montar({
			vista: 'mensual',
			formato: 'lista',
			mesVista: '2026-07-01',
			partidas: [
				partida(1, [celda('2026-07-01', { ejecucionesReportes: 1, realizado: 1 })]),
				partida(2, [
					celda('2026-07-01', { reportesAbiertos: [{ id: ID(60), estado: 'borrador' }] })
				]),
				partida(3, [celda('2026-07-01', { noEjecutado: 1 })])
			]
		});
		await expect
			.element(page.getByRole('link', { name: 'Mensual' }))
			.toHaveAttribute('aria-current', 'page');
		const filas = [...document.querySelectorAll('.filas .numero')].map((n) => n.textContent);
		expect(filas).toEqual(['2', '3', '1']);
		expect(
			[...document.querySelectorAll('.grupo-lista')].map((g) => g.textContent?.trim())
		).toEqual(['Pendientes 1', 'No ejecutadas 1', 'Ejecutadas 1']);
		await expect
			.element(page.getByRole('link', { name: 'Continuar borrador' }))
			.toHaveAttribute('href', `/reportes/${ID(60)}`);
		await expect.element(page.getByRole('link', { name: /Junio 2026/ })).toBeInTheDocument();
		expect(page.getByRole('link', { name: /Agosto/ }).elements()).toHaveLength(0);
		// El selector de formato vuelve a la matriz sin perder el mes ni los filtros.
		await expect
			.element(page.getByRole('link', { name: 'Lista' }))
			.toHaveAttribute('aria-current', 'page');
		const matriz = page.getByRole('link', { name: 'Matriz' });
		await expect.element(matriz).toHaveAttribute('href', expect.stringContaining('mes=2026-07-01'));
		await expect.element(matriz).not.toHaveAttribute('href', expect.stringContaining('formato'));
	});

	it('la vista semanal muestra por días la semana de hoy y navega semana a semana', async () => {
		const { container } = montar({
			vista: 'semanal',
			mesVista: '2026-07-01',
			partidas: [
				partida(7, [celda('2026-05-01'), celda('2026-06-01'), celda('2026-07-01')]),
				partida(9, [celda('2026-07-01', { programado: 31, ejecucionesReportes: 2 })], {
					periodicidad: 'diaria'
				})
			],
			ejecucionesMes: [
				{
					id: ID(71),
					partidaId: ID(9),
					estado: 'emitido',
					ocurrencia: null,
					reprogramacionId: null,
					diasEjecucion: [{ desde: '2026-07-13', hasta: '2026-07-14' }]
				}
			]
		});
		// HOY es el miércoles 15 de julio: semana 29 del año, del lunes 13 al domingo 19.
		await expect
			.element(page.getByRole('heading', { name: 'Programa semanal · Semana 29' }))
			.toBeInTheDocument();
		expect(
			[...container.querySelectorAll('.por-dias th.semana span[aria-hidden]')].map((t) =>
				t.textContent?.replace(/\s+/g, ' ').trim()
			)
		).toEqual(['lun 13', 'mar 14', 'mié 15 (hoy)', 'jue 16', 'vie 17', 'sáb 18', 'dom 19']);
		await expect
			.element(page.getByRole('link', { name: 'Semana anterior' }))
			.toHaveAttribute('href', expect.stringMatching(/mes=2026-07-01&semana=2$/));
		await expect
			.element(page.getByRole('link', { name: 'Semana siguiente' }))
			.toHaveAttribute('href', expect.stringMatching(/mes=2026-07-01&semana=4$/));
		const estados = (fila: number) =>
			[...container.querySelectorAll('.por-dias tbody tr')[fila].querySelectorAll('.celda')].map(
				(c) => c.querySelector('.linea-celda.estado')?.textContent ?? '—'
			);
		// Mensual pendiente: lo que falta se ofrece hoy; diaria: cada día según su reporte y fecha.
		expect(estados(0)).toEqual(['—', '—', 'Pendiente', '—', '—', '—', '—']);
		expect(estados(1)).toEqual([
			'Ejecutado',
			'Ejecutado',
			'Pendiente',
			'Programado',
			'Programado',
			'Programado',
			'Programado'
		]);
		await expect
			.element(
				page.getByText(
					'Partida 7, miércoles 15 de julio de 2026: Pendiente, Sin reporte, lo que falta en el mes'
				)
			)
			.toBeInTheDocument();
	});

	it('la vista mensual muestra por omisión las semanas del mes en matriz', async () => {
		const { container } = montar({
			vista: 'mensual',
			mesVista: '2026-05-01',
			partidas: [
				partida(7, [celda('2026-05-01'), celda('2026-06-01'), celda('2026-07-01')]),
				partida(8, [celda('2026-05-01', { programado: 5, ejecucionesReportes: 1, realizado: 1 })], {
					periodicidad: 'semanal'
				})
			],
			ejecucionesMes: [
				{
					id: ID(70),
					partidaId: ID(8),
					estado: 'emitido',
					ocurrencia: { tipo: 'semana', numero: 2 },
					reprogramacionId: null,
					diasEjecucion: [{ desde: '2026-05-05', hasta: '2026-05-05' }]
				}
			]
		});
		// Mayo de 2026 empieza en viernes: la semana 18 del año va del 1 al 3.
		expect(
			[...container.querySelectorAll('.matriz.semanal thead th.semana')].map((t) => t.textContent)
		).toEqual(['Semana 18', 'Semana 19', 'Semana 20', 'Semana 21', 'Semana 22']);
		await expect
			.element(page.getByRole('columnheader', { name: 'del 1 al 3 de mayo de 2026' }))
			.toBeInTheDocument();
		expect(page.getByRole('link', { name: /Mes anterior/ }).elements()).toHaveLength(0);
		await expect
			.element(page.getByRole('link', { name: /Mes siguiente: Junio 2026/ }))
			.toHaveAttribute('href', expect.stringMatching(/vista=mensual&mes=2026-06-01$/));
		await expect
			.element(page.getByRole('link', { name: 'Lista' }))
			.toHaveAttribute('href', expect.stringMatching(/mes=2026-05-01&formato=lista$/));
		// Mensual con el mes terminado: lo que falta queda vencido en la última semana.
		await expect
			.element(
				page.getByText(
					'Partida 7, semana 5 (del 25 al 31 de mayo de 2026): Vencido, Sin reporte, lo que falta en el mes'
				)
			)
			.toBeInTheDocument();
		await expect
			.element(
				page.getByRole('link', {
					name: 'Visualizar el reporte de la partida 8, semana 2 de mayo 2026'
				})
			)
			.toHaveAttribute('href', `/reportes/${ID(70)}`);
		const semanal = [...container.querySelectorAll('.matriz.semanal tbody tr')][1];
		expect(
			[...semanal.querySelectorAll('.celda')].map(
				(c) => c.querySelector('.linea-celda.estado')?.textContent ?? '—'
			)
		).toEqual(['Vencido', 'Ejecutado', 'Vencido', 'Vencido', 'Vencido']);
	});
});
