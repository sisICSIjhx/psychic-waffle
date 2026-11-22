// Icono (24 × 24, trazo 2.25) y clase de insignia de cada estatus: la forma cambia con el estatus
// para no depender del color. Los usan la insignia y las píldoras del filtro del tablero.
import type { EstatusCentro } from '$lib/dominio/estatus';

export const CLASE_ESTATUS: Record<EstatusCentro, string> = {
	atrasado: 'err',
	con_pendientes: 'warn',
	al_corriente: 'ok',
	sin_datos: ''
};

export const TRAZOS_ESTATUS: Record<EstatusCentro, string[]> = {
	// Triángulo de alerta.
	atrasado: [
		'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
		'M12 9v4M12 17h.01'
	],
	// Reloj.
	con_pendientes: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'],
	// Marca.
	al_corriente: ['M20 6 9 17l-5-5'],
	// Círculo con guion.
	sin_datos: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M8 12h8']
};
