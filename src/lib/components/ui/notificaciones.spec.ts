import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificaciones, PLAZO_DESHACER } from './notificaciones';

describe('notificaciones con deshacer', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	function nueva() {
		const alDeshacer = vi.fn();
		const alVencer = vi.fn();
		const id = notificaciones.mostrar({
			mensaje: 'Se quitó la Ilustración 2.1.2',
			textoDeshacer: 'Deshacer',
			alDeshacer,
			alVencer
		});
		return { id, alDeshacer, alVencer };
	}

	it('«Deshacer» dentro del plazo cancela la acción final', () => {
		const { id, alDeshacer, alVencer } = nueva();
		expect(get(notificaciones).map((n) => n.id)).toContain(id);
		vi.advanceTimersByTime(PLAZO_DESHACER - 1000);
		notificaciones.deshacer(id);
		vi.advanceTimersByTime(PLAZO_DESHACER);
		expect(alDeshacer).toHaveBeenCalledTimes(1);
		expect(alVencer).not.toHaveBeenCalled();
		expect(get(notificaciones).map((n) => n.id)).not.toContain(id);
	});

	it('al vencer el plazo ejecuta la acción final una sola vez', () => {
		const { id, alDeshacer, alVencer } = nueva();
		vi.advanceTimersByTime(PLAZO_DESHACER);
		expect(alVencer).toHaveBeenCalledTimes(1);
		notificaciones.deshacer(id);
		expect(alDeshacer).not.toHaveBeenCalled();
		expect(get(notificaciones)).toEqual([]);
	});

	it('confirmar ejecuta la acción final antes del plazo y descartar no ejecuta nada', () => {
		const primera = nueva();
		notificaciones.confirmar(primera.id);
		expect(primera.alVencer).toHaveBeenCalledTimes(1);

		const segunda = nueva();
		notificaciones.descartar(segunda.id);
		vi.advanceTimersByTime(PLAZO_DESHACER);
		expect(segunda.alVencer).not.toHaveBeenCalled();
		expect(segunda.alDeshacer).not.toHaveBeenCalled();
	});
});
