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

const clases = (contenedor: HTMLElement) =>
	[...contenedor.querySelectorAll('tbody .celda')].map((c) =>
		[...c.classList].find((clase) => clase !== 'celda' && !clase.startsWith('s-'))
	);

describe('PlaneacionView: matriz anual', () => {
	it('muestra ambos estados con símbolo y texto y abre la captura de junio', async () => {
		const { container } = montar();
		expect(clases(container)).toEqual(['ejecutado', 'vencido', 'pendiente']);
		const celdas = [...container.querySelectorAll('tbody .celda')];
		expect(celdas.map((c) => c.querySelector('.simbolo')?.textContent)).toEqual(['✓', '!', '●']);
		expect(celdas[1].querySelector('.sr-only')?.textContent).toBe(
			'Partida 7, junio 2026: programado 1, ejecutado 0, Vencido, Sin reporte'
		);
		expect(celdas[0].querySelector('.marca')?.textContent).toBe('Con rep.');
		const leyenda = page.getByRole('group', { name: 'Leyenda de la matriz' });
		await expect.element(leyenda).toHaveTextContent(/Ejecución:.*Ejecutado.*Pendiente.*Vencido/);
		await expect
			.element(leyenda)
			.toHaveTextContent(
				/Documental:.*Con reporte \(estado final\).*Reporte en borrador.*Sin reporte/
			);

		const capturar = page.getByRole('link', { name: 'Capturar partida 7 de junio 2026' });
		await expect
			.element(capturar)
			.toHaveAttribute('href', expect.stringContaining(`partida=${ID(7)}`));
		await expect
			.element(capturar)
			.toHaveAttribute('href', expect.stringContaining('mes=2026-06-01'));
		await expect.element(page.getByText('Pendientes vencidos (1)')).toBeInTheDocument();
	});

	it('enlaza los reportes emitidos y distingue lo realizado sin reporte', async () => {
		const { container } = montar();
		await expect
			.element(
				page.getByRole('link', { name: 'Ver 6 reportes emitidos de la partida 7 en mayo 2026' })
			)
			.toHaveAttribute(
				'href',
				expect.stringMatching(/partida=.*&desde=2026-05&hasta=2026-05&estado=emitido/)
			);
		const mayo = container.querySelector('tbody .celda') as HTMLElement;
		expect(mayo.innerText.replace(/\s+/g, ' ')).toContain('R 2');
		expect(mayo.innerText).toContain('1 sin reporte');
		await expect.element(page.getByLabelText('Periodicidad')).toHaveValue('mensual');
	});

	it('anota lo reprogramado y solo ofrece «⋯» donde falta algo o hay ajustes', async () => {
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
		expect(celdas.map((c) => !!c.querySelector('.ajustar'))).toEqual([true, false, true]);
		await expect
			.element(page.getByRole('link', { name: 'Capturar partida 7 de julio 2026' }))
			.toHaveAttribute('href', expect.stringContaining(`reprogramacion=${reprogramado.id}`));
	});

	it('el diálogo de ajuste empieza en «Cancelar», ofrece meses posteriores y exige nota con «Otro»', async () => {
		montar();
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

	it('la vista mensual ordena por urgencia, ofrece «Continuar borrador» y no pasa del periodo', async () => {
		montar({
			vista: 'mensual',
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
		await expect
			.element(page.getByRole('link', { name: 'Continuar borrador' }))
			.toHaveAttribute('href', `/reportes/${ID(60)}`);
		await expect.element(page.getByRole('link', { name: /Junio 2026/ })).toBeInTheDocument();
		expect(page.getByRole('link', { name: /Agosto/ }).elements()).toHaveLength(0);
	});

	it('la vista semanal muestra la semana parcial y no sale del periodo', async () => {
		montar({
			vista: 'semanal',
			mesVista: '2026-05-01',
			semana: 1,
			partidas: [partida(7, [celda('2026-05-01'), celda('2026-06-01'), celda('2026-07-01')])]
		});
		await expect
			.element(page.getByText(/Semana 1 de mayo 2026 \(del 1 al 3 de mayo de 2026\)/))
			.toBeInTheDocument();
		expect(page.getByRole('link', { name: /Semana anterior/ }).elements()).toHaveLength(0);
		await expect
			.element(page.getByRole('link', { name: /Semana siguiente/ }))
			.toHaveAttribute('href', expect.stringContaining('semana=2'));
		await expect
			.element(page.getByRole('cell', { name: 'Pendiente en el mes' }))
			.toBeInTheDocument();
	});
});
