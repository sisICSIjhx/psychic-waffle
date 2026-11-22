import { randomUUID } from 'node:crypto';
import { error, fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { ANCLA_VALIDA, anclaDePartida } from '$lib/components/seguimiento/captura';
import { indicadoresDePrograma, porcentajes, sumarIndicadores } from '$lib/dominio/cumplimiento';
import {
	ESTATUS_CENTRO,
	resumirCentro,
	type AvancePrograma,
	type ResumenCentro
} from '$lib/dominio/estatus';
import { fechaEnZona } from '$lib/dominio/fechas';
import { MAX_ARCHIVO_CARPETA } from '$lib/dominio/seguimiento-operativo';
import { textoMes } from '$lib/dominio/textos';
import { centrosVisibles } from '$lib/server/alcance';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puede } from '$lib/server/permisos';
import { centroDeSeguimiento, mesDeSeguimiento } from '$lib/server/seguimiento';
import type { Actions, PageServerLoad } from './$types';

type Repos = Awaited<ReturnType<typeof datos>>;

/**
 * Avance del programa anual de cada centro, acumulado al mes consultado: el mismo cálculo del
 * tablero. Un mes futuro no tiene corte, así que su ejecución se mide solo con las actividades del mes.
 */
async function avancesDePrograma(
	repos: Repos,
	sitioIds: readonly string[],
	mes: string,
	hoy: string
): Promise<Map<string, AvancePrograma>> {
	const avances = new Map<string, AvancePrograma>();
	if (!sitioIds.length || mes > hoy.slice(0, 7)) return avances;
	const corte = `${mes}-01`;
	const programas = await repos.programa.obtenerCumplimiento(
		sitioIds.length === 1 ? { corte, sitioId: sitioIds[0] } : { corte }
	);
	for (const sitioId of sitioIds) {
		const suyos = programas.filter((p) => p.sitio.id === sitioId);
		if (!suyos.length) continue;
		const i = sumarIndicadores(suyos.map((p) => indicadoresDePrograma(p, corte, hoy)));
		avances.set(sitioId, { planeado: i.PR, ejecutado: i.E, avance: porcentajes(i).cumplimiento });
	}
	return avances;
}

/** Estatus, indicadores y «qué falta» de un centro: lo que dibuja su tarjeta. */
function estatusDe(resumen: ResumenCentro, avance: AvancePrograma | null) {
	return { ...resumirCentro(resumen, avance), emergencias: resumen.emergencias };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const solicitado = url.searchParams.get('centro');
	const id = solicitado === null ? null : centroDeSeguimiento(locals, solicitado);
	const hoy = fechaEnZona();
	const mes = mesDeSeguimiento(url.searchParams.get('mes') ?? hoy.slice(0, 7));
	const puedeEditar = puede(locals, 'editarSeguimiento');
	// Lo financiero solo sale de la base si el rol puede verlo: sin el permiso no viaja al navegador.
	const verContrato = puede(locals, 'verContrato');
	const repos = await datos();
	const centros = (await repos.centrosCosto.listar(centrosVisibles(locals))).map(
		({ id, clave, nombre }) => ({ id, clave, nombre })
	);
	// Sin centro en la dirección: con uno solo se abre ese; con varios, la lista «Mis centros de costo».
	const centro =
		id === null ? (centros.length === 1 ? centros[0] : null) : centros.find((c) => c.id === id);
	if (id !== null && !centro) error(404, 'No encontrado');
	const base = {
		centros,
		mes,
		hoy,
		mesActual: hoy.slice(0, 7),
		puedeEditar,
		verCobranza: verContrato
	};

	if (!centro) {
		const resumenes = centros.length
			? await repos.estatus.obtener({
					sitioIds: centros.map((c) => c.id),
					mes,
					hoy,
					verContrato
				})
			: [];
		const avances = await avancesDePrograma(
			repos,
			resumenes.filter((r) => r.origen === 'programa_anual').map((r) => r.sitioId),
			mes,
			hoy
		);
		const misCentros = centros.flatMap((c) => {
			const resumen = resumenes.find((r) => r.sitioId === c.id);
			return resumen ? [{ centro: c, ...estatusDe(resumen, avances.get(c.id) ?? null) }] : [];
		});
		// Como el tablero: primero lo más urgente; a igualdad, más pendientes, menos ejecución y clave.
		const urgencia = (e: (typeof misCentros)[number]) =>
			['atrasado', 'con_pendientes', 'sin_datos', 'al_corriente'].indexOf(e.estatus);
		const ejecucion = (e: (typeof misCentros)[number]) =>
			e.kpis.find((k) => k.clave === 'ejecucion')?.porcentaje ?? 101;
		misCentros.sort(
			(a, b) =>
				urgencia(a) - urgencia(b) ||
				b.falta.length - a.falta.length ||
				ejecucion(a) - ejecucion(b) ||
				a.centro.clave.localeCompare(b.centro.clave, 'es', { numeric: true })
		);
		return {
			...base,
			centro: null,
			misCentros,
			cuentas: ESTATUS_CENTRO.map((estatus) => ({
				estatus,
				cantidad: misCentros.filter((c) => c.estatus === estatus).length
			})),
			seguimiento: null,
			estatus: null,
			personaSesion: null,
			fechaSugerida: '',
			idActividad: '',
			idNocturna: ''
		};
	}

	const [seguimiento, resumen] = await Promise.all([
		repos.seguimiento.obtener(centro.id, mes, puedeEditar),
		repos.estatus.deCentro(centro.id, { mes, hoy, verContrato })
	]);
	const avance =
		resumen?.origen === 'programa_anual'
			? ((await avancesDePrograma(repos, [centro.id], mes, hoy)).get(centro.id) ?? null)
			: null;
	return {
		...base,
		centro,
		misCentros: null,
		cuentas: null,
		seguimiento,
		estatus: resumen ? estatusDe(resumen, avance) : null,
		// Para proponer «Quién entrega»: la cuenta es una persona del directorio.
		personaSesion: puedeEditar ? (locals.usuario?.id ?? null) : null,
		fechaSugerida: hoy.startsWith(mes) ? hoy : `${mes}-01`,
		idActividad: puedeEditar ? randomUUID() : '',
		idNocturna: puedeEditar ? randomUUID() : ''
	};
};

/** Un dato del formulario que falta o no sirve: se dice con las palabras de quien captura. */
function invalido(mensaje: string): never {
	throw new ErrorDatos('invalido', mensaje);
}

async function cambiosDe(formulario: FormData, mes: string) {
	const texto = (nombre: string) => String(formulario.get(nombre) ?? '').trim();
	const accion = texto('accion');
	const actividad = texto('actividad') || null;
	const fecha = texto('fecha') || null;
	const conceptoId = texto('conceptoId');
	// Formulario de una ejecución: el botón pulsado dice qué se marca.
	const marca = texto('marca');
	if (marca === 'fila') return { accion: 'marcarFila', actividad };
	if (marca) {
		const [que, valor] = marca.split(':');
		return que === 'ejecucion'
			? { accion: 'ejecucion', actividad, valor: valor === 'true' }
			: { accion: 'valor', actividad, conceptoId: que, valor: valor === 'true' };
	}
	switch (accion) {
		case 'nuevaActividad': {
			// `veces`: cuántas veces se ejecuta la partida en el mes (por omisión, una).
			if (!texto('nombre')) invalido('Escriba el nombre de la partida.');
			const veces = texto('veces') ? Number(texto('veces')) : 1;
			if (!Number.isInteger(veces) || veces < 1 || veces > 31) {
				invalido('Las veces en el mes van de 1 a 31.');
			}
			return { accion, id: texto('id'), nombre: texto('nombre'), fecha, veces };
		}
		case 'editarActividad':
			if (!texto('nombre')) invalido('Escriba el nombre de la partida.');
			return { accion, actividad, nombre: texto('nombre'), fecha };
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
			// Atención de emergencia: solo la fecha es obligatoria; `asistentes` se repite por persona.
			if (!fecha) invalido('Escriba la fecha de la atención.');
			if (!fecha.startsWith(mes)) {
				invalido(`La fecha debe ser de ${textoMes(mes)}. Para otro mes, cambie el mes arriba.`);
			}
			return {
				accion,
				id: texto('id'),
				fecha,
				horaInicio: texto('horaInicio').slice(0, 5) || null,
				horaFin: texto('horaFin').slice(0, 5) || null,
				asistentes: formulario.getAll('asistentes').map(String).filter(Boolean),
				descripcion: texto('descripcion') || null
			};
		case 'quitarNocturna':
			return { accion, id: texto('id') };
		case 'carpeta': {
			const estado = texto('estado');
			// Un campo que el formulario no trae conserva lo guardado: cada paso envía solo lo suyo.
			const campo = (nombre: string) =>
				formulario.has(nombre) ? { [nombre]: texto(nombre) || null } : {};
			const falta = (nombre: string) => formulario.has(nombre) && !texto(nombre);
			const adjunto = async (nombre: string, nombreDeArchivo: string, nombreEnlace: string) => {
				const enviado = formulario.get(nombre);
				const archivo = enviado instanceof File && enviado.name ? enviado : null;
				if (!archivo) return {};
				if (texto(nombreEnlace)) invalido('Deje solo uno: el archivo o el enlace.');
				if (archivo.size > MAX_ARCHIVO_CARPETA) {
					invalido('El archivo pesa más de 8 MB. Súbalo a SharePoint y pegue el enlace.');
				}
				if (archivo.size === 0) invalido('El archivo está vacío. Seleccione otro.');
				return {
					[nombre]: Buffer.from(await archivo.arrayBuffer()).toString('base64'),
					[nombreDeArchivo]: archivo.name
				};
			};
			if (estado === 'entregada') {
				if (falta('entregaId')) invalido('Seleccione quién entrega la carpeta.');
				if (falta('fecha')) invalido('Escriba la fecha de entrega.');
			}
			if (estado === 'recibida' || estado === 'recibida_comentarios') {
				if (falta('recibe')) invalido('Escriba quién recibe la carpeta.');
				if (falta('fechaRecepcion')) invalido('Escriba la fecha de recepción.');
			}
			if (estado === 'recibida_comentarios' && falta('comentarios')) {
				invalido('Escriba los comentarios de quien recibió.');
			}
			return {
				accion,
				conceptoId,
				version: Number(texto('version')),
				estado,
				...campo('entregaId'),
				...campo('recibe'),
				...campo('fecha'),
				...campo('enlace'),
				...campo('fechaRecepcion'),
				...campo('comentarios'),
				...campo('acuseEnlace'),
				...(await adjunto('archivo', 'archivoNombre', 'enlace')),
				...(await adjunto('acuseArchivo', 'acuseArchivoNombre', 'acuseEnlace')),
				quitarArchivo: formulario.has('quitarArchivo'),
				quitarAcuse: formulario.has('quitarAcuse')
			};
		}
		default:
			return { accion, actividad };
	}
}

const MENSAJE_CARPETA: Record<string, string> = {
	pendiente: 'La carpeta volvió a pendiente.',
	en_proceso: 'Carpeta en preparación.',
	entregada: 'Carpeta entregada.',
	recibida_comentarios: 'Recepción con comentarios guardada. Falta corregir y entregar de nuevo.',
	recibida: 'Carpeta recibida correctamente.'
};

const MENSAJE: Record<string, string> = {
	nuevaActividad: 'Partida agregada. Ya puede marcarla.',
	editarActividad: 'Partida guardada.',
	quitarActividad: 'Partida quitada.',
	marcarMes: 'Todo el mes quedó marcado como hecho.',
	nuevaNocturna: 'Atención registrada.',
	quitarNocturna: 'Atención quitada.'
};

/** Un dato con formato inválido, dicho en palabras de quien captura. */
function mensajeDeFormato(causa: ZodError): string | null {
	const campos = new Set(causa.issues.map((i) => String(i.path[0] ?? '')));
	if (campos.has('enlace') || campos.has('acuseEnlace')) {
		return 'El enlace debe ser de SharePoint y empezar con https://. Cópielo desde la carpeta.';
	}
	if (campos.has('horaInicio') || campos.has('horaFin')) {
		return 'Escriba la hora con horas y minutos, por ejemplo 22:30.';
	}
	if (campos.has('fecha') || campos.has('fechaRecepcion')) return 'Escriba una fecha válida.';
	if (campos.has('valor')) return 'Escriba un valor válido.';
	return null;
}

export const actions: Actions = {
	guardar: async ({ request, locals, url }) => {
		if (!puede(locals, 'editarSeguimiento')) {
			return fail(403, {
				error: 'No tiene permiso para editar el seguimiento.',
				ancla: null,
				accion: null
			});
		}
		const sitio = centroDeSeguimiento(locals, url.searchParams.get('centro'));
		const mes = mesDeSeguimiento(url.searchParams.get('mes'));
		const formulario = await request.formData();
		// La tarjeta que envió: ahí se muestra el resultado, junto a donde se hizo el cambio.
		const enviada = String(formulario.get('ancla') ?? '');
		const ancla = ANCLA_VALIDA.test(enviada) ? enviada : null;
		const accion = String(formulario.get('accion') ?? '').slice(0, 40);
		try {
			const cambios = await cambiosDe(formulario, mes);
			const plantillaId = String(formulario.get('plantillaId') ?? '') || null;
			await (await datos()).seguimiento.guardar(sitio, mes, plantillaId, cambios);
			const mensaje =
				cambios.accion === 'carpeta' && 'estado' in cambios
					? (MENSAJE_CARPETA[cambios.estado] ?? 'Guardado.')
					: (MENSAJE[cambios.accion] ?? 'Guardado.');
			// La partida nueva y la que se quita cambian de lugar: el resultado va a donde quedó.
			if (cambios.accion === 'nuevaActividad' && 'id' in cambios) {
				return { mensaje, ancla: anclaDePartida(`m:${cambios.id}`), accion };
			}
			if (cambios.accion === 'quitarActividad') return { mensaje, ancla: 'actividades', accion };
			return { mensaje, ancla, accion };
		} catch (causa) {
			if (causa instanceof ErrorDatos && causa.tipo === 'no_encontrado') error(404, causa.message);
			const estado = causa instanceof ErrorDatos && causa.tipo === 'conflicto' ? 409 : 400;
			const formato = causa instanceof ZodError ? mensajeDeFormato(causa) : null;
			return fail(estado, { error: formato ?? mensajeDeError(causa), ancla, accion });
		}
	}
};
