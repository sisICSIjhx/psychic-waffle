import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { EstatusCentro, Kpi, Pendiente } from '$lib/dominio/estatus';
import BarraKpi from './BarraKpi.svelte';
import InsigniaEstatus from './InsigniaEstatus.svelte';
import ListaQueFalta from './ListaQueFalta.svelte';
import TarjetaCentro from './TarjetaCentro.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const kpi = (cambios: Partial<Kpi> = {}): Kpi => ({
	clave: 'documentos',
	etiqueta: 'Documentos',
	valor: 8,
	total: 10,
	porcentaje: 80,
	semaforo: 'amarillo',
	detalle: '8 de 10 documentos',
	...cambios
});

describe('InsigniaEstatus', () => {
	it('cada estatus lleva icono, texto y su clase de color', async () => {
		const casos: [EstatusCentro, string, string][] = [
			['atrasado', 'Atrasado', 'err'],
			['con_pendientes', 'Con pendientes', 'warn'],
			['al_corriente', 'Al corriente', 'ok'],
			['sin_datos', 'Sin datos', '']
		];
		const iconos = new Set<string>();
		for (const [estatus, texto, clase] of casos) {
			const { container, unmount } = render(InsigniaEstatus, { estatus, grande: true });
			const insignia = container.querySelector('.status-badge')!;
			expect(insignia.textContent?.trim()).toBe(texto);
			expect(insignia.classList.contains('grande')).toBe(true);
			if (clase) expect(insignia.classList.contains(clase)).toBe(true);
			expect(insignia.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
			iconos.add(insignia.querySelector('svg')!.innerHTML);
			unmount();
		}
		// La forma del icono distingue los cuatro estatus sin depender del color.
		expect(iconos.size).toBe(4);
	});
});

describe('BarraKpi', () => {
	it('con total muestra la cifra, la barra con nombre accesible y el semáforo en texto', async () => {
		const { container } = render(BarraKpi, { kpi: kpi() });
		await expect.element(page.getByText('Documentos', { exact: true })).toBeInTheDocument();
		expect(container.querySelector('.valor')?.textContent?.replace(/s+/g, ' ').trim()).toBe(
			'cerca de la meta: 8 de 10'
		);
		const barra = container.querySelector('progress')!;
		expect([barra.max, barra.value, barra.getAttribute('aria-label')]).toEqual([
			10,
			8,
			'Documentos: 8 de 10'
		]);
		expect(container.querySelector('.sr-only')?.textContent).toBe('cerca de la meta:');
		await expect.element(page.getByText('8 de 10 documentos')).toBeInTheDocument();
	});

	it('con dinero muestra el porcentaje y sin denominador «Sin datos» sin barra', async () => {
		const { container, rerender } = render(BarraKpi, {
			kpi: kpi({
				clave: 'cobranza',
				etiqueta: 'Cobranza',
				valor: 62000,
				total: 100000,
				porcentaje: 62,
				semaforo: null,
				esMonto: true,
				detalle: 'Mes con factura'
			})
		});
		await expect.element(page.getByText('62 %')).toBeInTheDocument();
		expect(container.querySelector('progress')?.value).toBe(62);
		expect(container.textContent).not.toContain('62000');
		// Informativo: sin trazo de semáforo.
		expect(container.querySelector('.valor svg')).toBeNull();

		await rerender({ kpi: kpi({ valor: 0, total: 0, porcentaje: null, semaforo: null }) });
		await expect.element(page.getByText('Sin datos')).toBeInTheDocument();
		expect(container.querySelector('progress')).toBeNull();
	});

	it('la ejecución dice si es del ciclo o del mes y el detalle se puede ocultar', async () => {
		const ejecucion = kpi({ clave: 'ejecucion', etiqueta: 'Ejecución', alcance: 'ciclo' });
		const { container, rerender } = render(BarraKpi, { kpi: ejecucion, mostrarDetalle: false });
		await expect.element(page.getByText('Ejecución del ciclo')).toBeInTheDocument();
		expect(container.querySelector('.detalle')).toBeNull();
		await rerender({ kpi: { ...ejecucion, alcance: 'mes' } });
		await expect.element(page.getByText('Ejecución del mes')).toBeInTheDocument();
	});
});

describe('ListaQueFalta', () => {
	it('cada pendiente con destino es un enlace; sin destino, texto; vacía, su mensaje', async () => {
		const { container, rerender } = render(ListaQueFalta, {
			elementos: [
				{ texto: 'Faltan 2 actividades por ejecutar', href: '/seguimiento?centro=x#actividades' },
				{ texto: 'Falta la factura del mes', href: null }
			],
			vacio: 'Nada pendiente este mes.'
		});
		await expect
			.element(page.getByRole('link', { name: 'Faltan 2 actividades por ejecutar' }))
			.toHaveAttribute('href', '/seguimiento?centro=x#actividades');
		expect(page.getByRole('link').elements()).toHaveLength(1);
		expect(container.querySelectorAll('li')).toHaveLength(2);
		expect(page.getByRole('list', { name: 'Qué falta' }).elements()).toHaveLength(1);

		await rerender({ elementos: [], vacio: 'Nada pendiente este mes.' });
		await expect.element(page.getByText('Nada pendiente este mes.')).toBeInTheDocument();
		expect(container.querySelector('ul')).toBeNull();
	});
});

describe('TarjetaCentro', () => {
	const centro = { id: ID(1), clave: 'EM-00001', nombre: 'Centro de ejemplo' };
	const falta: Pendiente[] = [
		{ texto: 'Faltan 2 actividades por ejecutar', destino: 'seguimiento', ancla: 'actividades' },
		{
			texto: 'Carpeta de seguridad sin entregar',
			destino: 'seguimiento',
			ancla: 'carpetas',
			conceptoId: ID(9)
		},
		{ texto: 'Falta la factura del mes', destino: 'cobranza', ancla: 'cobranza' }
	];
	const kpis: Kpi[] = [
		kpi({ clave: 'ejecucion', etiqueta: 'Ejecución', alcance: 'mes', valor: 6 }),
		kpi(),
		kpi({ clave: 'cobranza', etiqueta: 'Cobranza', esMonto: true, porcentaje: 62, semaforo: null }),
		kpi({ clave: 'contrato', etiqueta: 'Contrato', valor: 2, total: 4, porcentaje: 50 })
	];
	const base = {
		centro,
		mes: '2026-11',
		estatus: 'atrasado' as const,
		kpis,
		falta,
		emergencias: 1
	};
	const seguimiento = `/seguimiento?centro=${ID(1)}&mes=2026-11`;

	it('en el tablero enlaza cada pendiente al lugar donde se resuelve y abre el seguimiento', async () => {
		const { container } = render(TarjetaCentro, {
			...base,
			variante: 'tablero',
			verCobranza: true,
			principal: true
		});
		await expect
			.element(page.getByRole('heading', { level: 3, name: 'EM-00001' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Atrasado')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Faltan 2 actividades por ejecutar' }))
			.toHaveAttribute('href', `${seguimiento}#actividades`);
		await expect
			.element(page.getByRole('link', { name: 'Carpeta de seguridad sin entregar' }))
			.toHaveAttribute('href', `${seguimiento}#carpeta-${ID(9)}`);
		await expect
			.element(page.getByRole('link', { name: 'Falta la factura del mes' }))
			.toHaveAttribute('href', `/cobranza?centro=${ID(1)}#cobranza`);
		await expect
			.element(page.getByRole('link', { name: 'Atenciones de emergencia: 1' }))
			.toHaveAttribute('href', `${seguimiento}#emergencias`);
		const abrir = page.getByRole('link', {
			name: 'Abrir seguimiento de EM-00001 · Centro de ejemplo'
		});
		await expect.element(abrir).toHaveAttribute('href', seguimiento);
		await expect.element(abrir).toHaveClass(/primario/);
		await expect
			.element(page.getByRole('link', { name: /^Contrato y cobranza de/ }))
			.toHaveAttribute('href', `/cobranza?centro=${ID(1)}`);
		// «Contrato» va en «Más indicadores»; los demás, a la vista.
		expect(container.querySelector('details [data-kpi="contrato"]')).not.toBeNull();
		expect(container.querySelector('details [data-kpi="ejecucion"]')).toBeNull();
	});

	it('sin acceso al contrato no hay filas ni enlaces financieros, y tampoco huecos', async () => {
		const { container } = render(TarjetaCentro, {
			...base,
			// Lo que entrega el servidor a un rol sin `verContrato`: sin indicadores ni pendientes de dinero.
			kpis: kpis.slice(0, 2),
			falta: falta.slice(0, 2),
			variante: 'tablero',
			verCobranza: false
		});
		await expect
			.element(page.getByRole('link', { name: /^Abrir seguimiento/ }))
			.toHaveClass(/contorno/);
		expect(container.textContent).not.toMatch(/cobranza|contrato/i);
		expect(container.querySelector('details')).toBeNull();
		expect(
			[...container.querySelectorAll('[data-kpi]')].map((e) => e.getAttribute('data-kpi'))
		).toEqual(['ejecucion', 'documentos']);
	});

	it('como ficha usa anclas de la página y no trae botones', async () => {
		const { container } = render(TarjetaCentro, { ...base, variante: 'ficha', verCobranza: false });
		await expect
			.element(page.getByRole('heading', { level: 2, name: 'Estatus de noviembre 2026' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Faltan 2 actividades por ejecutar' }))
			.toHaveAttribute('href', '#actividades');
		await expect
			.element(page.getByRole('link', { name: 'Carpeta de seguridad sin entregar' }))
			.toHaveAttribute('href', `#carpeta-${ID(9)}`);
		// Un pendiente de cobranza sin acceso al contrato se lee, pero no enlaza.
		expect(page.getByRole('link', { name: 'Falta la factura del mes' }).elements()).toHaveLength(0);
		await expect.element(page.getByText('Falta la factura del mes')).toBeInTheDocument();
		expect(container.querySelector('.boton')).toBeNull();
	});

	it('compacta es un solo enlace con la insignia y el primer pendiente', async () => {
		render(TarjetaCentro, { ...base, variante: 'compacta' });
		const enlaces = page.getByRole('link').elements();
		expect(enlaces).toHaveLength(1);
		expect(enlaces[0].getAttribute('href')).toBe(seguimiento);
		expect(enlaces[0].textContent).toContain('EM-00001');
		expect(enlaces[0].textContent).toContain('Atrasado');
		expect(enlaces[0].textContent).toContain('Faltan 2 actividades por ejecutar');
		expect(enlaces[0].textContent).toContain('y 2 pendientes más');
	});

	it('sin datos lo dice, sin barras; al corriente no deja pendientes', async () => {
		const { container, rerender } = render(TarjetaCentro, {
			centro,
			mes: '2026-11',
			estatus: 'sin_datos',
			kpis: [kpi({ valor: 0, total: 0, porcentaje: null, semaforo: null })],
			falta: [],
			emergencias: 0,
			variante: 'tablero'
		});
		await expect.element(page.getByText('Sin datos')).toBeInTheDocument();
		await expect
			.element(page.getByText(/Todavía no hay nada capturado este mes/))
			.toBeInTheDocument();
		expect(container.querySelector('progress')).toBeNull();
		expect(container.querySelector('[data-kpi]')).toBeNull();

		await rerender({ estatus: 'al_corriente', kpis: [kpi({ valor: 10, semaforo: 'verde' })] });
		await expect.element(page.getByText('Nada pendiente este mes.')).toBeInTheDocument();
		expect(container.querySelectorAll('progress')).toHaveLength(1);

		await rerender({ estatus: 'sin_datos', kpis: [], centro: { ...centro, sinPlantilla: true } });
		await expect
			.element(page.getByText(/todavía no está configurado para el seguimiento/))
			.toBeInTheDocument();
	});
});
