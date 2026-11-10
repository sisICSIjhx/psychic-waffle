import { error as errorHttp } from '@sveltejs/kit';
import { datos } from '$lib/server/datos';
import { puedeAdministrarPersonal, puedeVerPersonal } from '$lib/server/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!puedeVerPersonal(locals)) errorHttp(403, 'No tiene permiso para consultar el personal');
	return {
		personal: await (await datos()).personal.listar(),
		puedeEditar: puedeAdministrarPersonal(locals)
	};
};
