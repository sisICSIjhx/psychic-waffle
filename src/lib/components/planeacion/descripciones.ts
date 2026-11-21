// Descripciones de las partidas en las matrices del programa: recortadas a tres líneas (filas del
// mismo alto) o completas. La elección se comparte entre las vistas anual, mensual y semanal y se
// recuerda en el navegador. Solo se cambia en el navegador; en el servidor siempre son recortadas.
import { writable } from 'svelte/store';
import { guardarPreferencia, leerPreferencia } from '$lib/layout/preferencias';

export const CLAVE_DESCRIPCIONES = 'icsi-descripciones-completas';

export const descripcionesCompletas = writable(false);

/** Lee la preferencia guardada (al montar la matriz). */
export function cargarDescripciones(): void {
	descripcionesCompletas.set(leerPreferencia(CLAVE_DESCRIPCIONES) === 'si');
}

export function alternarDescripciones(): void {
	descripcionesCompletas.update((actual) => {
		guardarPreferencia(CLAVE_DESCRIPCIONES, actual ? null : 'si');
		return !actual;
	});
}
