// Contrato y cobranza de un centro de costo. Nada de esta página sale del servidor sin la capacidad
// que lo autoriza: lo que no se puede ver no se consulta, y cada acción comprueba la suya.
import { randomUUID } from 'node:crypto';
import { error, fail } from '@sveltejs/kit';
import { PASOS_COBRANZA, valorDeCampo } from '$lib/dominio/cobranza';
import { filasConcentrado } from '$lib/dominio/concentrado';
import type { CentroCosto } from '$lib/dominio/esquemas';
import { resumirCentro } from '$lib/dominio/estatus';
import type { Capacidad } from '$lib/dominio/permisos';
import { fechaEnZona } from '$lib/dominio/fechas';
import { textoMes } from '$lib/dominio/textos';
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

/**
 * Estatus del centro en el mes en curso, para el resumen: el mismo cálculo del tablero (con el
 * avance del programa anual si lo tiene). Solo se consulta con la capacidad `verContrato`.
 */
async function estatusDelMes(
	repos: Awaited<ReturnType<typeof datos>>,
	centro: CentroCosto,
	hoy: string
) {
	const mes = hoy.slice(0, 7);
	const resumen = await repos.estatus.deCentro(centro.id, { mes, hoy, verContrato: true });
	if (!resumen?.finanzas) return null;
	const corte = `${mes}-01`;
	const programas = await repos.programa.obtenerCumplimiento({ corte, sitioId: centro.id });
	const [fila] = filasConcentrado([centro], programas, {}, corte, hoy);
	const { estatus, kpis } = resumirCentro(resumen, fila.fuente === 'programa' ? fila : null);
	return {
		mes,
		estatus,
		cobranza: kpis.find((kpi) => kpi.clave === 'cobranza') ?? null,
		pasos: resumen.finanzas.mes
	};
}

export const load: PageServerLoad = async ({ locals, url, request }) => {
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
	const visibles = await repos.centrosCosto.listar(centrosVisibles(locals));
	const completo = id === null ? visibles[0] : visibles.find((c) => c.id === id);
	if (id !== null && !completo) error(404, 'No encontrado');
	const puedeEditarContrato = puede(locals, 'editarContrato');
	const detalle = completo
		? await repos.contratoCobranza.obtener(completo.id, anio, hoy, ver)
		: null;
	return {
		centros: visibles.map(({ id, clave, nombre }) => ({ id, clave, nombre })),
		centro: completo ? { id: completo.id, clave: completo.clave, nombre: completo.nombre } : null,
		anio,
		hoy,
		detalle,
		// Insignia y barra del resumen: solo con el contrato a la vista.
		estatus: completo && detalle?.contrato ? await estatusDelMes(repos, completo, hoy) : null,
		puedeEditarContrato,
		puedeEditarCobranza: puede(locals, 'editarCobranza'),
		idOrden: puedeEditarContrato ? randomUUID() : '',
		idAdicional: puedeEditarContrato ? randomUUID() : '',
		// En teléfono, contrato, órdenes y carta llegan plegados (son de consulta ocasional).
		movil: /Mobi|Android/i.test(request.headers.get('user-agent') ?? '')
	};
};

/** Capacidad que exige cada operación; una operación desconocida no la tiene nadie. */
const CAPACIDAD_DE_ACCION: Record<string, Capacidad> = {
	contrato: 'editarContrato',
	nuevaOrden: 'editarContrato',
	editarOrden: 'editarContrato',
	quitarOrden: 'editarContrato',
	// Adicionales: administración los registra; contabilidad solo llena lo cobrado.
	nuevoAdicional: 'editarContrato',
	editarAdicional: 'editarContrato',
	quitarAdicional: 'editarContrato',
	cobroAdicional: 'editarCobranza',
	carta: 'editarContrato',
	programa: 'editarContrato',
	cobranza: 'editarCobranza'
};

const MENSAJE_DE_ACCION: Record<string, string> = {
	contrato: 'Contrato guardado.',
	nuevaOrden: 'Orden de compra agregada.',
	editarOrden: 'Orden de compra guardada.',
	quitarOrden: 'Orden de compra quitada.',
	nuevoAdicional: 'Adicional registrado.',
	editarAdicional: 'Adicional guardado.',
	quitarAdicional: 'Adicional quitado.',
	cobroAdicional: 'Cobro guardado.',
	carta: 'Carta guardada.',
	programa: 'Enlace guardado.',
	cobranza: 'Cobranza guardada.'
};

/** Lugar de la página que muestra el resultado; lo envía el formulario y vuelve tal cual. */
const ANCLA = /^r-[a-z]+(?:-[0-9a-f-]{36})?$/;
/** Hasta doce enteros y dos decimales, sin signos ni separadores de miles. */
const MONTO = /^\d{1,12}(?:\.\d{1,2})?$/;

function montoDe(campo: string, cual = 'el monto'): number | null {
	if (!campo) return null;
	if (!MONTO.test(campo)) {
		throw new ErrorDatos(
			'invalido',
			`Escriba ${cual} con números, sin signos ni comas (por ejemplo, 15000.50).`
		);
	}
	return Number(campo);
}

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
		case 'quitarAdicional':
			return { accion, id: texto('id') };
		case 'nuevoAdicional':
		case 'editarAdicional': {
			const periodoInicio = texto('periodoInicio') || null;
			const periodoFin = texto('periodoFin') || null;
			if (!texto('ordenCompra')) throw new ErrorDatos('invalido', 'Escriba la orden de compra.');
			if (periodoInicio && periodoFin && periodoFin < periodoInicio) {
				throw new ErrorDatos('invalido', 'El fin de la ejecución no puede ser anterior al inicio.');
			}
			return {
				accion,
				id: texto('id'),
				ordenCompra: texto('ordenCompra'),
				descripcion: texto('descripcion') || null,
				fechaSolicitud: texto('fechaSolicitud') || null,
				periodoInicio,
				periodoFin,
				montoPactado: montoDe(texto('montoPactado'))
			};
		}
		case 'cobroAdicional':
			return { accion, id: texto('id'), montoCobrado: montoDe(texto('montoCobrado')) };
		case 'carta':
			return { accion, fecha: texto('fecha') || null, enlace: texto('enlace') || null };
		case 'programa':
			return { accion, enlace: texto('enlace') || null };
		case 'cobranza':
			return {
				accion,
				meses: Array.from({ length: 12 }, (_, i) => {
					const mm = String(i + 1).padStart(2, '0');
					return {
						mes: `${anio}-${mm}-01`,
						...Object.fromEntries(
							PASOS_COBRANZA.map(([paso]) => [paso, formulario.has(`${paso}-${mm}`)])
						),
						montoCobrado: montoDe(
							texto(`monto-${mm}`),
							`el monto de ${textoMes(`${anio}-${mm}`).split(' ')[0]}`
						)
					};
				})
			};
		default:
			return { accion };
	}
}

/** Lo escrito en el alta de un adicional, para no perderlo si el envío falla sin JavaScript. */
const CAMPOS_ADICIONAL = [
	'ordenCompra',
	'descripcion',
	'fechaSolicitud',
	'periodoInicio',
	'periodoFin',
	'montoPactado'
] as const;

export const actions: Actions = {
	guardar: async ({ request, locals, url }) => {
		const formulario = await request.formData();
		const accion = String(formulario.get('accion') ?? '');
		const pedida = String(formulario.get('ancla') ?? '');
		const ancla = ANCLA.test(pedida) ? pedida : undefined;
		const capacidad = CAPACIDAD_DE_ACCION[accion];
		if (!capacidad || !puede(locals, capacidad)) {
			return fail(403, { error: 'No tiene permiso para hacer este cambio.', ancla });
		}
		const sitio = centroDeSeguimiento(locals, url.searchParams.get('centro'));
		const anio = anioDe(url, fechaEnZona());
		try {
			await (await datos()).contratoCobranza.guardar(sitio, cambiosDe(formulario, anio));
			return { mensaje: MENSAJE_DE_ACCION[accion] ?? 'Guardado.', ancla };
		} catch (causa) {
			if (causa instanceof ErrorDatos && causa.tipo === 'no_encontrado') error(404, causa.message);
			const estado = causa instanceof ErrorDatos && causa.tipo === 'conflicto' ? 409 : 400;
			return fail(estado, {
				error: mensajeDeError(causa),
				ancla,
				...(accion === 'nuevoAdicional'
					? {
							enviado: Object.fromEntries(
								CAMPOS_ADICIONAL.map((campo) => [campo, String(formulario.get(campo) ?? '')])
							) as Record<(typeof CAMPOS_ADICIONAL)[number], string>
						}
					: {})
			});
		}
	}
};
