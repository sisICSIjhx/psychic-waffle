// Contrato y cobranza de un centro de costo. Nada de esta página sale del servidor sin la capacidad
// que lo autoriza: lo que no se puede ver no se consulta, y cada acción comprueba la suya.
import { randomUUID } from 'node:crypto';
import { error, fail } from '@sveltejs/kit';
import { PASOS_COBRANZA, valorDeCampo } from '$lib/dominio/cobranza';
import type { Capacidad } from '$lib/dominio/permisos';
import { fechaEnZona } from '$lib/dominio/fechas';
import { centrosVisibles } from '$lib/server/alcance';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puede } from '$lib/server/permisos';
import { anioCobranza } from '$lib/server/repositorios/contrato-cobranza';
import { centroDeSeguimiento } from '$lib/server/seguimiento';
import type { Actions, PageServerLoad } from './$types';

function anioDe(url: URL, hoy: string): number {
	const anio = anioCobranza.safeParse(url.searchParams.get('anio') ?? hoy.slice(0, 4));
	if (!anio.success) error(400, 'Seleccione un año válido.');
	return anio.data;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const ver = {
		contrato: puede(locals, 'verContrato'),
		programa: puede(locals, 'verEnlacePrograma')
	};
	if (!ver.contrato && !ver.programa) {
		error(
			403,
			locals.autenticacion
				? 'No tiene permiso para consultar el contrato y la cobranza.'
				: 'Active el inicio de sesión para registrar contratos y cobranza.'
		);
	}
	const solicitado = url.searchParams.get('centro');
	const id = solicitado === null ? null : centroDeSeguimiento(locals, solicitado);
	const hoy = fechaEnZona();
	const anio = anioDe(url, hoy);
	const repos = await datos();
	const centros = (await repos.centrosCosto.listar(centrosVisibles(locals))).map(
		({ id, clave, nombre }) => ({ id, clave, nombre })
	);
	const centro = id === null ? centros[0] : centros.find((c) => c.id === id);
	if (id !== null && !centro) error(404, 'No encontrado');
	const puedeEditarContrato = puede(locals, 'editarContrato');
	return {
		centros,
		centro: centro ?? null,
		anio,
		detalle: centro ? await repos.contratoCobranza.obtener(centro.id, anio, hoy, ver) : null,
		puedeEditarContrato,
		puedeEditarCobranza: puede(locals, 'editarCobranza'),
		idOrden: puedeEditarContrato ? randomUUID() : ''
	};
};

/** Capacidad que exige cada operación; una operación desconocida no la tiene nadie. */
const CAPACIDAD_DE_ACCION: Record<string, Capacidad> = {
	contrato: 'editarContrato',
	nuevaOrden: 'editarContrato',
	editarOrden: 'editarContrato',
	quitarOrden: 'editarContrato',
	carta: 'editarContrato',
	programa: 'editarContrato',
	cobranza: 'editarCobranza'
};

function cambiosDe(formulario: FormData, anio: number) {
	const texto = (nombre: string) => String(formulario.get(nombre) ?? '').trim();
	const accion = texto('accion');
	// Cada concepto llega como `tipo:<id>` (su tipo) y `valor:<id>` (ausente en una casilla sin marcar).
	const valores = () =>
		[...formulario.keys()]
			.filter((clave) => clave.startsWith('tipo:'))
			.map((clave) => {
				const conceptoId = clave.slice(5);
				const campo = formulario.get(`valor:${conceptoId}`);
				return {
					conceptoId,
					valor: valorDeCampo(texto(clave), typeof campo === 'string' ? campo : null)
				};
			});
	switch (accion) {
		case 'contrato':
			return { accion, valores: valores() };
		case 'nuevaOrden':
		case 'editarOrden':
			return { accion, id: texto('id'), valores: valores() };
		case 'quitarOrden':
			return { accion, id: texto('id') };
		case 'carta':
			return { accion, fecha: texto('fecha') || null, enlace: texto('enlace') || null };
		case 'programa':
			return { accion, enlace: texto('enlace') || null };
		case 'cobranza':
			return {
				accion,
				meses: Array.from({ length: 12 }, (_, i) => {
					const mm = String(i + 1).padStart(2, '0');
					const monto = texto(`monto-${mm}`);
					return {
						mes: `${anio}-${mm}-01`,
						...Object.fromEntries(
							PASOS_COBRANZA.map(([paso]) => [paso, formulario.has(`${paso}-${mm}`)])
						),
						montoCobrado: monto ? Number(monto) : null
					};
				})
			};
		default:
			return { accion };
	}
}

export const actions: Actions = {
	guardar: async ({ request, locals, url }) => {
		const formulario = await request.formData();
		const capacidad = CAPACIDAD_DE_ACCION[String(formulario.get('accion') ?? '')];
		if (!capacidad || !puede(locals, capacidad)) {
			return fail(403, { error: 'No tiene permiso para hacer este cambio.' });
		}
		const sitio = centroDeSeguimiento(locals, url.searchParams.get('centro'));
		const anio = anioDe(url, fechaEnZona());
		try {
			await (await datos()).contratoCobranza.guardar(sitio, cambiosDe(formulario, anio));
			return { mensaje: 'Guardado.' };
		} catch (causa) {
			if (causa instanceof ErrorDatos && causa.tipo === 'no_encontrado') error(404, causa.message);
			const estado = causa instanceof ErrorDatos && causa.tipo === 'conflicto' ? 409 : 400;
			return fail(estado, { error: mensajeDeError(causa) });
		}
	}
};
