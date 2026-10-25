import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { ESTADOS_REPORTE } from '$lib/dominio/esquemas';
import InsigniaEstado from './InsigniaEstado.svelte';

describe('InsigniaEstado', () => {
	it('muestra cada estado con texto e icono decorativo, no solo con color', () => {
		const textos = { borrador: 'Borrador', en_revision: 'En revisión', emitido: 'Emitido' };
		for (const estado of ESTADOS_REPORTE) {
			const { container } = render(InsigniaEstado, { estado });
			const insignia = container.querySelector('.insignia-estado') as HTMLElement;
			expect(insignia.classList.contains(`estado-${estado}`)).toBe(true);
			expect(insignia.textContent?.trim()).toBe(
				textos[estado as keyof typeof textos] ?? 'Sustituido'
			);
			expect(insignia.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
		}
	});

	it('distingue los estados también por el icono', () => {
		const iconos = ESTADOS_REPORTE.map((estado) => {
			const { container } = render(InsigniaEstado, { estado });
			return container.querySelector('svg')?.innerHTML;
		});
		expect(new Set(iconos).size).toBe(ESTADOS_REPORTE.length);
	});
});
