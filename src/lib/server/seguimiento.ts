import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { centrosVisibles, type LocalesAlcance } from './alcance';
import { mesSeguimiento } from './repositorios/seguimiento';

export function centroDeSeguimiento(locals: LocalesAlcance, centro: string | null): string {
	const id = z.uuid().safeParse(centro?.toLowerCase());
	const visibles = centrosVisibles(locals);
	if (!id.success || (visibles !== null && !visibles.includes(id.data))) {
		error(404, 'No encontrado');
	}
	return id.data;
}

export function mesDeSeguimiento(mes: string | null): string {
	const validado = mesSeguimiento.safeParse(mes);
	if (!validado.success) error(400, 'Seleccione un mes válido.');
	return validado.data;
}
