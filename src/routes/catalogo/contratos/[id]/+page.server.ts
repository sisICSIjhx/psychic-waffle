import { error as errorHttp, fail } from '@sveltejs/kit';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { almacenamiento, datos } from '$lib/server/datos';
import {
	ErrorCambio,
	ejecutarCambio,
	leerCambio,
	leerConfirmacion
} from '$lib/server/edicion-catalogo';
import { mensajeDeError } from '$lib/server/errores';
import { analizarHojas, ErrorImportacion } from '$lib/server/importacion/catalogo';
import {
	advertenciasDelEnsayo,
	analizarProgramaAnual,
	cargaDePrograma,
	tipoDeLibro
} from '$lib/server/importacion/programa';
import { leerLibro, type Hoja } from '$lib/server/importacion/xlsx';
import {
	guardarImportacionPendiente,
	tomarImportacionPendiente
} from '$lib/server/importacion/temporal';
import { contextoBitacora, puedeEditarCatalogo } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();
const opcional = (formulario: FormData, campo: string) => texto(formulario, campo) || null;
const TAMANO_MAXIMO_LIBRO = 10 * 1024 * 1024;
const SIN_PERMISO = 'No tiene permiso para editar el catálogo.';

/** Falla de una edición del catálogo con lo que la interfaz necesita para mostrarla junto al campo. */
function falloDeCambio(accion: string, tipo: string, error: unknown) {
	const detalle = error instanceof ErrorDatos ? error.detalle : {};
	const estado = error instanceof ErrorDatos && error.tipo === 'conflicto' ? 409 : 400;
	return fail(estado, {
		accion,
		tipo,
		error: error instanceof ErrorCambio ? error.message : mensajeDeError(error),
		motivo: typeof detalle.motivo === 'string' ? detalle.motivo : null,
		detalle: JSON.parse(JSON.stringify(detalle)) as Record<string, unknown>
	});
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const repos = await datos();
	const contrato = (await repos.catalogo.listarContratos()).find((c) => c.id === params.id);
	if (!contrato) errorHttp(404, 'Contrato no encontrado');
	const sitios = await repos.catalogo.listarSitios(contrato.id);
	const sitio = sitios.find((s) => s.id === url.searchParams.get('sitio')) ?? sitios[0] ?? null;
	const estado = url.searchParams.get('estado') === 'por_confirmar' ? 'por_confirmar' : undefined;
	const paginaCambios = Math.max(1, Number(url.searchParams.get('cambios')) || 1);
	const [partidas, equipos, firmantes, programas, resumenSitios, cambios] = await Promise.all([
		sitio
			? repos.catalogo.listarPartidas({
					contratoId: contrato.id,
					sitioId: sitio.id,
					estadoCatalogo: estado
				})
			: Promise.resolve([]),
		sitio ? repos.catalogo.listarEquipos(sitio.id) : Promise.resolve([]),
		repos.catalogo.listarFirmantes(contrato.id),
		sitio
			? repos.programa.listarProgramas({ contratoId: contrato.id, sitioId: sitio.id })
			: Promise.resolve([]),
		repos.catalogo.resumenSitios(contrato.id),
		repos.catalogo.listarCambios(contrato.id, paginaCambios)
	]);
	return {
		contrato,
		sitios,
		sitio,
		estado: (estado ?? 'todas') as 'todas' | 'por_confirmar',
		partidas,
		equipos,
		firmantes,
		programas,
		resumenSitios,
		cambios,
		historialAbierto: url.searchParams.has('cambios'),
		permisos: { editarCatalogo: puedeEditarCatalogo(locals) }
	};
};

export const actions: Actions = {
	asociarSitio: async ({ request, params, locals }) => {
		if (!puedeEditarCatalogo(locals))
			return fail(403, { accion: 'asociarSitio', error: SIN_PERMISO });
		const formulario = await request.formData();
		const repos = await datos();
		const contexto = contextoBitacora(locals);
		try {
			let sitioId: string;
			try {
				sitioId = (
					await repos.catalogo.guardarSitio(
						{ clave: texto(formulario, 'clave'), nombre: texto(formulario, 'nombre') },
						{ ...contexto, contratoId: params.id }
					)
				).id;
			} catch (error) {
				// Un sitio ya registrado (aunque esté escrito de otra forma) se asocia en lugar de duplicarse.
				const existente =
					error instanceof ErrorDatos ? (error.detalle.existente as { id?: string }) : null;
				if (!existente?.id) throw error;
				sitioId = existente.id;
			}
			await repos.catalogo.asociarSitio(params.id, sitioId, contexto);
			return { accion: 'asociarSitio', mensaje: 'Sitio asociado al contrato.' };
		} catch (error) {
			return fail(400, { accion: 'asociarSitio', error: mensajeDeError(error) });
		}
	},

	guardarEquipo: async ({ request, params }) => {
		const formulario = await request.formData();
		try {
			const repos = await datos();
			const sitioId = texto(formulario, 'sitioId');
			const id = opcional(formulario, 'id');
			// Solo se agregan o editan equipos de un sitio de este contrato.
			const sitioDelContrato = (await repos.catalogo.listarSitios(params.id)).some(
				(s) => s.id === sitioId
			);
			const equipoDelSitio =
				!id || (await repos.catalogo.listarEquipos(sitioId)).some((e) => e.id === id);
			if (!sitioDelContrato || !equipoDelSitio) {
				return fail(400, {
					accion: 'guardarEquipo',
					error: 'El equipo no pertenece a un sitio de este contrato.'
				});
			}
			const equipo = await repos.catalogo.guardarEquipo({
				...(id ? { id } : {}),
				sitioId,
				tag: texto(formulario, 'tag'),
				tipo: opcional(formulario, 'tipo'),
				marca: opcional(formulario, 'marca'),
				modelo: opcional(formulario, 'modelo'),
				rango: opcional(formulario, 'rango'),
				numeroSerie: opcional(formulario, 'numeroSerie')
			});
			return {
				accion: 'guardarEquipo',
				mensaje: `Equipo ${equipo.tag} ${id ? 'actualizado' : 'registrado'}.`
			};
		} catch (error) {
			return fail(400, { accion: 'guardarEquipo', error: mensajeDeError(error) });
		}
	},

	// Solo altas: las correcciones de un firmante pasan por ensayarCambio y aplicarCambio.
	registrarFirmante: async ({ request, params, locals }) => {
		if (!puedeEditarCatalogo(locals)) {
			return fail(403, { accion: 'registrarFirmante', error: SIN_PERMISO });
		}
		const formulario = await request.formData();
		try {
			const repos = await datos();
			await repos.catalogo.guardarFirmante(
				{
					contratoId: params.id,
					funcion: texto(formulario, 'funcion') as 'elaboro' | 'aprobo' | 'recibio',
					nombre: texto(formulario, 'nombre'),
					cargo: texto(formulario, 'cargo'),
					empresa: texto(formulario, 'empresa'),
					vigenteDesde: texto(formulario, 'vigenteDesde'),
					vigenteHasta: opcional(formulario, 'vigenteHasta')
				},
				contextoBitacora(locals)
			);
			return { accion: 'registrarFirmante', mensaje: 'Firmante registrado.' };
		} catch (error) {
			return fail(400, { accion: 'registrarFirmante', error: mensajeDeError(error) });
		}
	},

	// Calcula la corrección y su impacto sin aplicarla, para el diálogo de confirmación.
	ensayarCambio: async ({ request, params, locals }) => {
		if (!puedeEditarCatalogo(locals)) {
			return fail(403, { accion: 'ensayarCambio', tipo: '', error: SIN_PERMISO });
		}
		const formulario = await request.formData();
		let cambio;
		try {
			cambio = leerCambio(formulario);
			const resultado = await ejecutarCambio((await datos()).catalogo, params.id, cambio, {
				...contextoBitacora(locals),
				ensayo: true
			});
			return {
				accion: 'ensayarCambio',
				tipo: cambio.tipo,
				campos: cambio.campos,
				resultado: JSON.parse(JSON.stringify(resultado)) as typeof resultado
			};
		} catch (error) {
			return falloDeCambio('ensayarCambio', cambio?.tipo ?? '', error);
		}
	},

	// Aplica la corrección confirmada; el motivo se valida aquí y otra vez en la base.
	aplicarCambio: async ({ request, params, locals }) => {
		if (!puedeEditarCatalogo(locals)) {
			return fail(403, { accion: 'aplicarCambio', tipo: '', error: SIN_PERMISO });
		}
		const formulario = await request.formData();
		let cambio;
		try {
			cambio = leerCambio(formulario);
			const confirmacion = leerConfirmacion(formulario);
			const resultado = await ejecutarCambio((await datos()).catalogo, params.id, cambio, {
				...contextoBitacora(locals),
				...confirmacion,
				ensayo: false
			});
			return {
				accion: 'aplicarCambio',
				tipo: cambio.tipo,
				mensaje: 'Cambio guardado y registrado en el historial.',
				efectos: {
					borradoresActualizados: resultado.aplicado?.borradoresActualizados ?? [],
					borradoresConAviso: resultado.aplicado?.borradoresConAviso ?? []
				}
			};
		} catch (error) {
			return falloDeCambio('aplicarCambio', cambio?.tipo ?? '', error);
		}
	},

	confirmarPartida: async ({ request }) => {
		const formulario = await request.formData();
		try {
			const partida = await (await datos()).catalogo.confirmarPartida(texto(formulario, 'id'));
			return { accion: 'confirmarPartida', mensaje: `Partida ${partida.numero} confirmada.` };
		} catch (error) {
			return fail(400, { accion: 'confirmarPartida', error: mensajeDeError(error) });
		}
	},

	importarEnsayo: async ({ request, params }) => {
		const formulario = await request.formData();
		const archivo = formulario.get('archivo');
		const sitioId = texto(formulario, 'sitioId');
		if (!(archivo instanceof File) || archivo.size === 0 || !/\.xlsx$/i.test(archivo.name)) {
			return fail(400, { accion: 'importar', error: 'Seleccione un archivo de Excel (.xlsx).' });
		}
		if (archivo.size > TAMANO_MAXIMO_LIBRO) {
			return fail(400, { accion: 'importar', error: 'El archivo supera los 10 MB.' });
		}
		try {
			let hojas: Hoja[];
			try {
				hojas = await leerLibro(new Uint8Array(await archivo.arrayBuffer()));
			} catch (error) {
				throw new ErrorImportacion(
					`No se pudo leer el archivo: ${error instanceof Error ? error.message : String(error)}`,
					'(archivo)'
				);
			}
			const repos = await datos();
			if (tipoDeLibro(hojas) === 'programa') {
				const contrato = (await repos.catalogo.listarContratos()).find((c) => c.id === params.id);
				const sitio = (await repos.catalogo.listarSitios(params.id)).find((s) => s.id === sitioId);
				if (!contrato || !sitio) {
					return fail(400, { accion: 'importar', error: 'Elija un sitio del contrato.' });
				}
				const analisis = analizarProgramaAnual(hojas, { claveSitio: sitio.clave });
				const carga = cargaDePrograma(analisis, contrato.id, sitio.id);
				const resultado = await repos.programa.importarPrograma(carga, true);
				const token = await guardarImportacionPendiente(almacenamiento(), {
					tipo: 'programa',
					...carga
				});
				return {
					accion: 'importar',
					tipo: 'programa' as const,
					token,
					nombreArchivo: archivo.name,
					sitio: analisis.sitio,
					resultadoPrograma: resultado,
					advertenciasPrograma: advertenciasDelEnsayo(analisis, resultado, contrato)
				};
			}
			const catalogo = analizarHojas(hojas);
			const carga = {
				contratoId: params.id,
				sitioId,
				programa: catalogo.programa,
				partidas: catalogo.partidas
			};
			const resultado = await repos.catalogo.importarCatalogo(carga, true);
			const token = await guardarImportacionPendiente(almacenamiento(), {
				tipo: 'catalogo',
				...carga
			});
			return {
				accion: 'importar',
				tipo: 'catalogo' as const,
				token,
				nombreArchivo: archivo.name,
				resultado,
				advertencias: catalogo.advertencias,
				firmantesPropuestos: catalogo.firmantesPropuestos,
				encabezado: {
					usuario: catalogo.usuario,
					estacion: catalogo.estacion,
					programa: catalogo.programa
				}
			};
		} catch (error) {
			return fail(400, { accion: 'importar', error: mensajeDeError(error) });
		}
	},

	importarAplicar: async ({ request, params }) => {
		const formulario = await request.formData();
		const carga = await tomarImportacionPendiente(
			almacenamiento(),
			texto(formulario, 'token'),
			params.id
		);
		if (!carga) {
			return fail(400, {
				accion: 'importar',
				error: 'La importación caducó o ya se aplicó; vuelva a cargar el archivo.'
			});
		}
		try {
			const repos = await datos();
			if (carga.tipo === 'programa') {
				const { resumen } = await repos.programa.importarPrograma(carga, false);
				return {
					accion: 'importarAplicada',
					mensaje: `Programa importado: ${resumen.crear} partidas creadas, ${resumen.actualizar} actualizadas y ${resumen.sinCambios} sin cambios.`
				};
			}
			const { resumen } = await repos.catalogo.importarCatalogo(carga, false);
			return {
				accion: 'importarAplicada',
				mensaje: `Importación aplicada: ${resumen.crear} creadas, ${resumen.actualizar} actualizadas y ${resumen.sinCambios} sin cambios.`
			};
		} catch (error) {
			return fail(400, { accion: 'importar', error: mensajeDeError(error) });
		}
	}
};
