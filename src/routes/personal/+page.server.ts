import { datos } from '$lib/server/datos';
import { puedeAdministrarPersonal } from '$lib/server/permisos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	personal: await (await datos()).personal.listar(),
	puedeEditar: puedeAdministrarPersonal(locals)
});
