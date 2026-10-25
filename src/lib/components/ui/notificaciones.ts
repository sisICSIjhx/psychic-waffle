// Notificaciones breves con «Deshacer». La acción final (por ejemplo, quitar de verdad una foto) se
// ejecuta al vencer el plazo o al confirmarla antes; «Deshacer» la cancela.
import { writable } from 'svelte/store';

export const PLAZO_DESHACER = 10_000;

export interface Notificacion {
	id: number;
	mensaje: string;
	/** Texto del botón para deshacer; sin él, la notificación solo informa. */
	textoDeshacer?: string;
}

export interface NuevaNotificacion {
	mensaje: string;
	textoDeshacer?: string;
	alDeshacer?: () => void;
	/** Acción final: al vencer el plazo o al confirmar. */
	alVencer?: () => void;
	plazo?: number;
}

interface Entrada {
	alDeshacer?: () => void;
	alVencer?: () => void;
	temporizador: ReturnType<typeof setTimeout>;
}

function crearNotificaciones() {
	const { subscribe, update } = writable<Notificacion[]>([]);
	const entradas = new Map<number, Entrada>();
	let siguiente = 1;

	function retirar(id: number): Entrada | null {
		const entrada = entradas.get(id);
		if (!entrada) return null;
		clearTimeout(entrada.temporizador);
		entradas.delete(id);
		update((lista) => lista.filter((n) => n.id !== id));
		return entrada;
	}

	return {
		subscribe,
		/** Muestra una notificación y devuelve su id. */
		mostrar({
			mensaje,
			textoDeshacer,
			alDeshacer,
			alVencer,
			plazo = PLAZO_DESHACER
		}: NuevaNotificacion): number {
			const id = siguiente++;
			const temporizador = setTimeout(() => retirar(id)?.alVencer?.(), plazo);
			entradas.set(id, { alDeshacer, alVencer, temporizador });
			update((lista) => [...lista, { id, mensaje, textoDeshacer }]);
			return id;
		},
		/** Retira la notificación sin ejecutar la acción final. */
		deshacer(id: number) {
			retirar(id)?.alDeshacer?.();
		},
		/** Ejecuta ya la acción final, por ejemplo antes de descargar o de salir. */
		confirmar(id: number) {
			retirar(id)?.alVencer?.();
		},
		/** Retira sin ejecutar nada, por ejemplo cuando se desmonta quien la creó. */
		descartar(id: number) {
			retirar(id);
		}
	};
}

export const notificaciones = crearNotificaciones();
