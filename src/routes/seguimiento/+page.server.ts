import { randomUUID } from 'node:crypto';
import { error, fail } from '@sveltejs/kit';
import { fechaEnZona } from '$lib/dominio/fechas';
import { MAX_ARCHIVO_CARPETA } from '$lib/dominio/seguimiento-operativo';
import { centrosVisibles } from '$lib/server/alcance';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puede } from '$lib/server/permisos';
import { centroDeSeguimiento, mesDeSeguimiento } from '$lib/server/seguimiento';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const solicitado = url.searchParams.get('centro');
	const id = solicitado === null ? null : centroDeSeguimiento(locals, solicitado);
	const hoy = fechaEnZona();
	const mes = mesDeSeguimiento(url.searchParams.get('mes') ?? hoy.slice(0, 7));
	const puedeEditar = puede(locals, 'editarSeguimiento');
	const repos = await datos();
	const centros = (await repos.centrosCosto.listar(centrosVisibles(locals))).map(
		({ id, clave, nombre }) => ({ id, clave, nombre })
	);
	const centro = id === null ? centros[0] : centros.find((c) => c.id === id);
	if (id !== null && !centro) error(404, 'No encontrado');
	const seguimiento = centro ? await repos.seguimiento.obtener(centro.id, mes, puedeEditar) : null;
	return {
		centros,
		centro: centro ?? null,
		mes,
		seguimiento,
		puedeEditar,
		fechaSugerida: hoy.startsWith(mes) ? hoy : `${mes}-01`,
		idActividad: puedeEditar ? randomUUID() : '',
		idNocturna: puedeEditar ? randomUUID() : ''
	};
};

async function cambiosDe(formulario: FormData) {
	const texto = (nombre: string) => String(formulario.get(nombre) ?? '').trim();
	const accion = texto('accion');
	const actividad = texto('actividad') || null;
	const fecha = texto('fecha') || null;
	const conceptoId = texto('conceptoId');
	switch (accion) {
		case 'nuevaActividad':
		case 'editarActividad':
			return { accion, id: texto('id'), actividad, nombre: texto('nombre'), fecha };
		case 'ejecucion':
			return { accion, actividad, valor: texto('valor') === 'true' };
		case 'valor': {
			const tipo = texto('tipo');
			const campo = texto('valor');
			const valor =
				tipo === 'casilla'
					? campo === 'true'
					: !campo
						? null
						: tipo === 'cantidad'
							? Number(campo)
							: campo;
			return { accion, actividad, conceptoId, valor };
		}
		case 'nuevaNocturna':
		case 'quitarNocturna':
			return { accion, id: texto('id'), fecha, descripcion: texto('descripcion') };
		case 'carpeta': {
			const adjunto = formulario.get('archivo');
			const archivo = adjunto instanceof File && adjunto.name ? adjunto : null;
			if (archivo && (archivo.size === 0 || archivo.size > MAX_ARCHIVO_CARPETA)) {
				throw new ErrorDatos('invalido', 'Seleccione un archivo válido de hasta 8 MiB.');
			}
			return {
				accion,
				conceptoId,
				fecha,
				version: Number(texto('version')),
				estado: texto('estado'),
				entregaId: texto('entregaId') || null,
				recibe: texto('recibe') || null,
				enlace: texto('enlace') || null,
				archivo: archivo ? Buffer.from(await archivo.arrayBuffer()).toString('base64') : null,
				archivoNombre: archivo?.name ?? null,
				quitarArchivo: formulario.has('quitarArchivo')
			};
		}
		default:
			return { accion, actividad };
	}
}

export const actions: Actions = {
	guardar: async ({ request, locals, url }) => {
		if (!puede(locals, 'editarSeguimiento')) {
			return fail(403, { error: 'No tiene permiso para editar el seguimiento.' });
		}
		const sitio = centroDeSeguimiento(locals, url.searchParams.get('centro'));
		const mes = mesDeSeguimiento(url.searchParams.get('mes'));
		const formulario = await request.formData();
		try {
			const cambios = await cambiosDe(formulario);
			const plantillaId = String(formulario.get('plantillaId') ?? '') || null;
			await (await datos()).seguimiento.guardar(sitio, mes, plantillaId, cambios);
			return { mensaje: cambios.accion === 'marcarMes' ? 'Mes marcado como hecho.' : 'Guardado.' };
		} catch (causa) {
			if (causa instanceof ErrorDatos && causa.tipo === 'no_encontrado') error(404, causa.message);
			const estado = causa instanceof ErrorDatos && causa.tipo === 'conflicto' ? 409 : 400;
			return fail(estado, { error: mensajeDeError(causa) });
		}
	}
};
