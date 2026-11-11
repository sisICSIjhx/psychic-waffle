// Editor de una plantilla de seguimiento (cambio centros-costo-plantillas): datos generales y
// conceptos por bloque. La lista completa de conceptos viaja como JSON; la base valida bloque, tipo
// y nivel, y conserva el id de los conceptos que ya existían (D5).
import { error as errorHttp, fail } from '@sveltejs/kit';
import { MODOS_CONTRATO, ORIGENES_ACTIVIDADES } from '$lib/dominio/constantes';
import type { PlantillaSeguimientoEntrada } from '$lib/dominio/esquemas';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puedeEditarCatalogo } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();
const SIN_PERMISO = 'No tiene permiso para editar el catálogo.';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!puedeEditarCatalogo(locals)) errorHttp(403, SIN_PERMISO);
	const plantilla = await (await datos()).centrosCosto
		.obtenerPlantilla(params.id)
		.catch(() => null);
	if (!plantilla) errorHttp(404, 'Plantilla no encontrada');
	return { plantilla };
};

export const actions: Actions = {
	guardar: async ({ request, params, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { error: SIN_PERMISO });
		const formulario = await request.formData();
		const modo = texto(formulario, 'modoContrato');
		const origen = texto(formulario, 'origenActividades');
		let conceptos: PlantillaSeguimientoEntrada['conceptos'];
		try {
			conceptos = JSON.parse(texto(formulario, 'conceptos') || '[]');
		} catch {
			return fail(400, { error: 'No se pudieron leer los conceptos. Recargue la página.' });
		}
		try {
			await (
				await datos()
			).centrosCosto.guardarPlantilla({
				id: params.id,
				nombre: texto(formulario, 'nombre'),
				descripcion: texto(formulario, 'descripcion') || null,
				modoContrato: (MODOS_CONTRATO as readonly string[]).includes(modo)
					? (modo as PlantillaSeguimientoEntrada['modoContrato'])
					: 'obligatorio',
				origenActividades: (ORIGENES_ACTIVIDADES as readonly string[]).includes(origen)
					? (origen as PlantillaSeguimientoEntrada['origenActividades'])
					: 'ninguno',
				conceptos
			});
			return { mensaje: 'Plantilla guardada.' };
		} catch (error) {
			return fail(400, { error: mensajeDeError(error) });
		}
	}
};
