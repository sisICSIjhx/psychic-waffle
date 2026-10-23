// Reglas puras de la captura: periodos y ocurrencias, prellenado desde el catálogo, validaciones para
// enviar a revisión y aplicación explícita de los cambios del catálogo a un borrador.
import {
	diasDelMes,
	MESES,
	semanasDelMes,
	tituloReporte,
	type Ocurrencia,
	type Periodo
} from './documento.ts';
import { diasFueraDe, textoDias } from './dias-ejecucion.ts';
import type {
	Contrato,
	ESTADOS_REPORTE,
	FirmantesVigentes,
	FirmasReporte,
	Partida,
	PERIODICIDADES,
	Reporte,
	ReporteGuardado,
	ReporteNuevo,
	Sitio
} from './esquemas.ts';

export type Periodicidad = (typeof PERIODICIDADES)[number];

export const ETIQUETA_PERIODICIDAD: Record<Periodicidad, string> = {
	diaria: 'Diaria',
	semanal: 'Semanal',
	quincenal: 'Quincenal',
	mensual: 'Mensual',
	bimestral: 'Bimestral',
	trimestral: 'Trimestral',
	cuatrimestral: 'Cuatrimestral',
	semestral: 'Semestral',
	anual: 'Anual',
	cuando_aplique: 'Cuando aplique'
};

export const ETIQUETA_OCURRENCIA: Record<Ocurrencia['tipo'], string> = {
	semana: 'Semana',
	quincena: 'Quincena',
	dia: 'Día'
};

export type EstadoReporte = (typeof ESTADOS_REPORTE)[number];

export const ETIQUETA_ESTADO_REPORTE: Record<EstadoReporte, string> = {
	borrador: 'Borrador',
	en_revision: 'En revisión',
	emitido: 'Emitido',
	sustituido: 'Sustituido'
};

export type ModoPeriodo = 'mes' | 'semana' | 'quincena';

/**
 * Cómo se puede reportar una partida dentro del mes: las diarias por mes completo o por semana; las
 * semanales por semana; las quincenales por quincena; el resto por mes. La ocurrencia «día» sigue
 * siendo válida en los datos, pero la captura ya no la ofrece.
 */
export function modosDePeriodo(periodicidad: Periodicidad): ModoPeriodo[] {
	if (periodicidad === 'diaria') return ['mes', 'semana'];
	if (periodicidad === 'semanal') return ['semana'];
	if (periodicidad === 'quincenal') return ['quincena'];
	return ['mes'];
}

/** Ocurrencia que ofrece la captura (en las diarias, la semana opcional); null si es mensual. */
export function tipoOcurrencia(periodicidad: Periodicidad): Ocurrencia['tipo'] | null {
	const modo = modosDePeriodo(periodicidad).find((m) => m !== 'mes');
	return modo === 'semana' || modo === 'quincena' ? modo : null;
}

/** Números de ocurrencia válidos en el mes («AAAA-MM-01»). */
export function ocurrenciasDelMes(tipo: Ocurrencia['tipo'], mes: string): number[] {
	const { anio, mes: numeroMes } = partesMes(mes);
	const total =
		tipo === 'dia'
			? diasDelMes(anio, numeroMes)
			: tipo === 'semana'
				? semanasDelMes(anio, numeroMes)
				: 2;
	return Array.from({ length: total }, (_, i) => i + 1);
}

export function partesMes(mes: string): { anio: number; mes: number } {
	const coincidencia = /^(\d{4})-(\d{2})/.exec(mes);
	if (!coincidencia) throw new RangeError(`Mes inválido: «${mes}»`);
	return { anio: Number(coincidencia[1]), mes: Number(coincidencia[2]) };
}

/** Meses («AAAA-MM-01») que toca la vigencia del contrato, en orden. */
export function mesesDeVigencia(inicio: string, fin: string): string[] {
	const desde = partesMes(inicio);
	const hasta = partesMes(fin);
	const meses: string[] = [];
	for (let anio = desde.anio, mes = desde.mes; anio * 12 + mes <= hasta.anio * 12 + hasta.mes; ) {
		meses.push(`${anio}-${String(mes).padStart(2, '0')}-01`);
		mes++;
		if (mes > 12) {
			mes = 1;
			anio++;
		}
	}
	return meses;
}

export function periodoDeReporte(reporte: Pick<Reporte, 'periodoMes' | 'ocurrencia'>): Periodo {
	return { ...partesMes(reporte.periodoMes), ocurrencia: reporte.ocurrencia };
}

/** Texto de un alcance del catálogo: el primer renglón es el título y el resto la descripción. */
export function separarAlcance(texto: string): { titulo: string; descripcion: string } {
	const [titulo = '', ...resto] = texto.replace(/\r\n?/g, '\n').split('\n');
	return { titulo: titulo.trim(), descripcion: resto.join('\n').trim() };
}

function firmasDeVigentes(vigentes: FirmantesVigentes): FirmasReporte {
	const firmas: FirmasReporte = {};
	for (const funcion of ['elaboro', 'aprobo', 'recibio'] as const) {
		const firmante = vigentes[funcion];
		if (firmante) {
			firmas[funcion] = {
				nombre: firmante.nombre,
				cargo: firmante.cargo,
				empresa: firmante.empresa
			};
		}
	}
	return firmas;
}

export interface SeleccionReporte {
	partida: Partida;
	contrato: Contrato;
	sitio: Sitio;
	firmantes: FirmantesVigentes;
	/** AAAA-MM-01 */
	periodoMes: string;
	ocurrencia: Ocurrencia | null;
	equipoIds: string[];
}

/** Contenido que el reporte toma de la partida (lo que «aplicar cambios del catálogo» renueva). */
export function contenidoDeCatalogo(partida: Partida) {
	return {
		objetivo: partida.objetivo ?? '',
		introduccion: partida.descripcion ?? '',
		conclusiones: partida.conclusionesBase ?? '',
		tipoMantenimiento: partida.tipoMantenimiento.trim() || 'Preventivo',
		// Solo los alcances ejecutables; las notas y normas no forman parte del reporte.
		alcances: partida.alcances
			.filter((a) => a.tipo === 'alcance')
			.map((a) => ({ ...separarAlcance(a.texto), partidaAlcanceId: a.id ?? null })),
		herramientas: partida.herramientas.map((h) => ({
			cantidad: h.cantidad,
			descripcion: h.descripcion
		}))
	};
}

/**
 * Huella del contenido que el reporte copia de la partida. Ignora los identificadores, que cambian
 * cada vez que se guarda la partida aunque el texto sea el mismo.
 */
export function huellaCatalogo(partida: Partida): string {
	const c = contenidoDeCatalogo(partida);
	const texto = JSON.stringify([
		c.objetivo,
		c.introduccion,
		c.conclusiones,
		c.tipoMantenimiento,
		c.alcances.map((a) => [a.titulo, a.descripcion]),
		c.herramientas.map((h) => [h.cantidad, h.descripcion])
	]);
	// cyrb53: suficiente para detectar cambios; no es una función criptográfica.
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < texto.length; i++) {
		const codigo = texto.charCodeAt(i);
		h1 = Math.imul(h1 ^ codigo, 2654435761);
		h2 = Math.imul(h2 ^ codigo, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}-${texto.length}`;
}

/** Reporte nuevo con el encabezado y el contenido copiados del catálogo y del contrato. */
export function prellenarReporte(seleccion: SeleccionReporte): ReporteNuevo {
	const { partida, contrato, sitio, periodoMes, ocurrencia } = seleccion;
	const modos = modosDePeriodo(partida.periodicidad);
	const modo = ocurrencia?.tipo ?? 'mes';
	if (!(modos as string[]).includes(modo)) {
		if (modos.length > 1) {
			throw new RangeError(`La partida ${partida.numero} se reporta por mes completo o por semana`);
		}
		if (modos[0] === 'mes') {
			throw new RangeError(`La partida ${partida.numero} no lleva semana, quincena ni día`);
		}
		throw new RangeError(
			`La partida ${partida.numero} requiere elegir ${ETIQUETA_OCURRENCIA[modos[0]]}`
		);
	}
	const equiposPartida = new Set(partida.equipos.map((e) => e.id));
	const ajenos = seleccion.equipoIds.filter((id) => !equiposPartida.has(id));
	if (ajenos.length) throw new RangeError('Hay equipos que no pertenecen a la partida');
	if (partida.equipos.length && !seleccion.equipoIds.length) {
		throw new RangeError('Elija al menos un TAG de la partida');
	}
	const periodo: Periodo = { ...partesMes(periodoMes), ocurrencia };
	const contenido = contenidoDeCatalogo(partida);
	return {
		partidaId: partida.id,
		periodoMes,
		ocurrencia,
		diasEjecucion: [],
		titulo: tituloReporte({
			numeroPartida: partida.numero,
			actividad: partida.actividad,
			periodo
		}),
		usuario: contrato.cliente?.razonSocial ?? '',
		contratoTexto: contrato.numero,
		sitioTexto: `${sitio.clave} ${sitio.nombre}`.trim(),
		periodicidad: ETIQUETA_PERIODICIDAD[partida.periodicidad],
		actividad: partida.actividad,
		numeroPartida: partida.numero,
		nombreCorto: partida.nombreCorto,
		disposicionFotos: partida.disposicionFotos,
		incluyeVerificacion: partida.proponeVerificacion,
		firmantes: firmasDeVigentes(seleccion.firmantes),
		equipoIds: seleccion.equipoIds,
		catalogoHuella: huellaCatalogo(partida),
		...contenido
	};
}

export interface Observacion {
	campo: string;
	mensaje: string;
}

/**
 * Textos de relleno de las plantillas anteriores: un valor que solo dice «N/A», «XX», guiones o
 * «Pendiente», y la palabra «Cambiar» en cualquier parte de usuario, contrato, sitio, periodicidad o
 * tipo. En el título solo cuenta «(Cambiar)» o un título que diga únicamente «Cambiar», porque
 * «CAMBIAR FILTROS» puede ser una actividad legítima.
 */
const RELLENO_VALOR = /^\s*(n\s*\/\s*a|x{2,}|-+|_+|\.+|pendiente|por definir)\s*$/i;
const RELLENO = new RegExp(`\\bcambiar\\b|${RELLENO_VALOR.source}`, 'i');
const RELLENO_TITULO = new RegExp(
	`\\(\\s*cambiar\\s*\\)|^\\s*cambiar\\s*$|${RELLENO_VALOR.source}`,
	'i'
);

/**
 * Primer y último día («AAAA-MM-DD») en que puede ejecutarse el reporte del periodo: el mes completo
 * o, si la partida es diaria, semanal o quincenal, el día, la semana (de lunes a domingo, dentro del
 * mes) o la quincena elegidos. Devuelve null si la ocurrencia no existe en el mes.
 */
export function rangoDelPeriodo(
	periodoMes: string,
	ocurrencia: Ocurrencia | null
): { desde: string; hasta: string } | null {
	const { anio, mes } = partesMes(periodoMes);
	const dias = diasDelMes(anio, mes);
	const fecha = (dia: number) =>
		`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
	if (!ocurrencia) return { desde: fecha(1), hasta: fecha(dias) };
	const n = ocurrencia.numero;
	if (!ocurrenciasDelMes(ocurrencia.tipo, periodoMes).includes(n)) return null;
	if (ocurrencia.tipo === 'dia') return { desde: fecha(n), hasta: fecha(n) };
	if (ocurrencia.tipo === 'quincena') {
		return n === 1
			? { desde: fecha(1), hasta: fecha(15) }
			: { desde: fecha(16), hasta: fecha(dias) };
	}
	// Días del mes antes del primer lunes que caen en la semana 1 (0 si el mes inicia en lunes).
	const desplazamiento = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7;
	return {
		desde: fecha(Math.max(1, (n - 1) * 7 - desplazamiento + 1)),
		hasta: fecha(Math.min(dias, n * 7 - desplazamiento))
	};
}

const textoDia = (fecha: string) =>
	`${Number(fecha.slice(8, 10))} de ${MESES[Number(fecha.slice(5, 7)) - 1].toLocaleLowerCase('es-MX')}`;

/** Datos mínimos de un reporte para validarlo, tal como los tiene el editor o la base. */
export type ReporteValidable = Pick<
	Reporte,
	| 'periodoMes'
	| 'ocurrencia'
	| 'diasEjecucion'
	| 'titulo'
	| 'usuario'
	| 'contratoTexto'
	| 'sitioTexto'
	| 'periodicidad'
	| 'tipoMantenimiento'
	| 'objetivo'
	| 'conclusiones'
	| 'incluyeVerificacion'
	| 'firmantes'
> & {
	alcances: Pick<Reporte['alcances'][number], 'titulo' | 'estadoVerificacion' | 'observaciones'>[];
	equipos: unknown[];
};

const ETIQUETA_FIRMA = { elaboro: 'Elaboró', aprobo: 'Aprobó', recibio: 'Recibió' } as const;

/**
 * Observaciones que impiden enviar a revisión o emitir. `requiereTag` indica que la partida tiene
 * equipos y el reporte debe registrar al menos uno.
 */
export function validarParaRevision(
	reporte: ReporteValidable,
	{ requiereTag = false } = {}
): Observacion[] {
	const observaciones: Observacion[] = [];
	const agregar = (campo: string, mensaje: string) => observaciones.push({ campo, mensaje });

	const rango = rangoDelPeriodo(reporte.periodoMes, reporte.ocurrencia);
	if (!rango) {
		agregar('ocurrencia', 'La semana, quincena o día del reporte no existe en su mes.');
	} else if (!reporte.diasEjecucion?.length) {
		agregar('diasEjecucion', 'Capture los días de ejecución.');
	} else {
		const fuera = diasFueraDe(reporte.diasEjecucion, rango);
		if (fuera.length) {
			const anio = rango.desde.slice(0, 4);
			const periodo =
				rango.desde === rango.hasta
					? `el ${textoDia(rango.desde)} de ${anio}`
					: rango.desde.slice(5, 7) === rango.hasta.slice(5, 7)
						? `del ${Number(rango.desde.slice(8, 10))} al ${textoDia(rango.hasta)} de ${anio}`
						: `del ${textoDia(rango.desde)} al ${textoDia(rango.hasta)} de ${anio}`;
			agregar(
				'diasEjecucion',
				`Días fuera del periodo del reporte (${periodo}): ${textoDias(fuera)}.`
			);
		}
	}

	const encabezado = {
		titulo: 'Título',
		usuario: 'Usuario',
		contratoTexto: 'Contrato / OC',
		sitioTexto: 'Sitio',
		periodicidad: 'Periodicidad',
		tipoMantenimiento: 'Tipo de mantenimiento'
	} as const;
	for (const [campo, etiqueta] of Object.entries(encabezado) as [
		keyof typeof encabezado,
		string
	][]) {
		const valor = reporte[campo]?.trim() ?? '';
		if (!valor) agregar(campo, `Falta «${etiqueta}».`);
		else if ((campo === 'titulo' ? RELLENO_TITULO : RELLENO).test(valor))
			agregar(campo, `«${etiqueta}» tiene un texto de relleno.`);
	}
	if (requiereTag && reporte.equipos.length === 0) {
		agregar('equipos', 'Elija al menos un TAG de la partida.');
	}
	for (const funcion of ['elaboro', 'aprobo', 'recibio'] as const) {
		if (!reporte.firmantes[funcion]?.nombre?.trim()) {
			agregar(
				`firmantes.${funcion}`,
				`Falta el nombre de quien firma «${ETIQUETA_FIRMA[funcion]}».`
			);
		}
	}
	if (!reporte.objetivo.trim()) agregar('objetivo', 'Falta el objetivo.');
	if (reporte.alcances.length === 0) agregar('alcances', 'El reporte no tiene alcances.');
	reporte.alcances.forEach((alcance, i) => {
		const numero = `2.${i + 1}`;
		if (!alcance.titulo.trim())
			agregar(`alcances.${i}.titulo`, `El alcance ${numero} no tiene título.`);
		if (!reporte.incluyeVerificacion) return;
		if (alcance.estadoVerificacion === 'pendiente') {
			agregar(`alcances.${i}.estado`, `Indique el estado de verificación del alcance ${numero}.`);
		} else if (alcance.estadoVerificacion === 'con_observacion' && !alcance.observaciones.trim()) {
			agregar(
				`alcances.${i}.observaciones`,
				`El alcance ${numero} está «Con observación»: capture la observación.`
			);
		}
	});
	if (!reporte.conclusiones.trim()) {
		agregar('conclusiones', 'Las conclusiones y recomendaciones no pueden quedar vacías.');
	}
	return observaciones;
}

/** Secciones del editor del reporte, en el orden del documento. */
export const SECCIONES_EDITOR = [
	'encabezado',
	'firmas',
	'objetivo',
	'alcance',
	'herramientas',
	'conclusiones'
] as const;
export type SeccionEditor = (typeof SECCIONES_EDITOR)[number];

export interface DestinoObservacion {
	seccion: SeccionEditor;
	/** Alcance al que pertenece la observación, si aplica. */
	alcanceId: string | null;
	/** `id` del elemento del editor que recibe el foco. */
	campoId: string;
}

const CAMPOS_ENCABEZADO: Record<string, string> = {
	ocurrencia: 'fecha',
	diasEjecucion: 'fecha',
	fechaEjecucion: 'fecha',
	titulo: 'titulo',
	tipoMantenimiento: 'tipo',
	usuario: 'dato-usuario',
	contratoTexto: 'dato-contrato',
	sitioTexto: 'dato-sitio',
	periodicidad: 'dato-periodicidad',
	equipos: 'tags'
};
const CAMPOS_ALCANCE = {
	titulo: 'titulo-alcance',
	estado: 'estado',
	observaciones: 'observaciones'
} as const;

/**
 * Sección y campo del editor al que lleva una observación de `validarParaRevision`. Las rutas de
 * alcance traen el índice (`alcances.<i>.titulo`), así que el `id` se toma del mismo reporte que se
 * validó. Devuelve null si la ruta no corresponde a ningún campo.
 */
export function destinoDeObservacion(
	observacion: Observacion,
	reporte: { alcances: readonly { id?: string }[] }
): DestinoObservacion | null {
	const { campo } = observacion;
	if (Object.hasOwn(CAMPOS_ENCABEZADO, campo)) {
		return { seccion: 'encabezado', alcanceId: null, campoId: CAMPOS_ENCABEZADO[campo] };
	}
	const firma = /^firmantes\.(elaboro|aprobo|recibio)$/.exec(campo);
	if (firma) return { seccion: 'firmas', alcanceId: null, campoId: `firma-${firma[1]}-nombre` };
	if (campo === 'objetivo' || campo === 'conclusiones') {
		return { seccion: campo, alcanceId: null, campoId: campo };
	}
	if (campo === 'alcances')
		return { seccion: 'alcance', alcanceId: null, campoId: 'agregar-alcance' };
	const alcance = /^alcances\.(\d+)\.(titulo|estado|observaciones)$/.exec(campo);
	const id = alcance ? reporte.alcances[Number(alcance[1])]?.id : undefined;
	if (!alcance || !id) return null;
	const prefijo = CAMPOS_ALCANCE[alcance[2] as keyof typeof CAMPOS_ALCANCE];
	return { seccion: 'alcance', alcanceId: id, campoId: `${prefijo}-${id}` };
}

export interface Completitud {
	total: number;
	porSeccion: Record<SeccionEditor, number>;
	/** Pendientes de cada alcance, por su `id`. */
	porAlcance: Record<string, number>;
}

/** Cuenta las observaciones por sección y por alcance para el índice y la barra del editor. */
export function completitudPorSeccion(
	observaciones: readonly Observacion[],
	reporte: { alcances: readonly { id?: string }[] }
): Completitud {
	const porSeccion = Object.fromEntries(SECCIONES_EDITOR.map((s) => [s, 0])) as Record<
		SeccionEditor,
		number
	>;
	const porAlcance: Record<string, number> = {};
	for (const observacion of observaciones) {
		const destino = destinoDeObservacion(observacion, reporte);
		if (!destino) continue;
		porSeccion[destino.seccion]++;
		if (destino.alcanceId) porAlcance[destino.alcanceId] = (porAlcance[destino.alcanceId] ?? 0) + 1;
	}
	return { total: observaciones.length, porSeccion, porAlcance };
}

/** Estado editable de un reporte, en la forma que recibe el guardado. */
export function aGuardado(reporte: Reporte): ReporteGuardado {
	return {
		id: reporte.id,
		version: reporte.version,
		diasEjecucion: reporte.diasEjecucion,
		titulo: reporte.titulo,
		tipoMantenimiento: reporte.tipoMantenimiento,
		objetivo: reporte.objetivo,
		introduccion: reporte.introduccion,
		conclusiones: reporte.conclusiones,
		incluyeVerificacion: reporte.incluyeVerificacion,
		firmantes: reporte.firmantes,
		alcances: reporte.alcances.map((a) => ({
			id: a.id,
			titulo: a.titulo,
			descripcion: a.descripcion,
			estadoVerificacion: a.estadoVerificacion,
			observaciones: a.observaciones,
			partidaAlcanceId: a.partidaAlcanceId,
			// El giro va siempre: omitirlo significa «conservar» y un giro de vuelta a 0 no se guardaría.
			fotos: a.fotos.map((f) => ({
				id: f.id,
				descripcion: f.descripcion,
				momento: f.momento,
				rotacion: f.rotacion
			}))
		})),
		herramientas: reporte.herramientas.map((h) => ({
			cantidad: h.cantidad,
			descripcion: h.descripcion
		})),
		equipoIds: reporte.equipos.map((e) => e.id)
	};
}

const comparable = (texto: string) =>
	texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Aplica al borrador el contenido vigente del catálogo: objetivo, introducción, conclusiones,
 * herramientas y alcances. Un alcance que corresponde a uno del catálogo (mismo título) conserva sus
 * fotos, estado y observaciones; los alcances del reporte que ya no están en el catálogo se conservan
 * al final solo si tienen fotos u observaciones, para no perder evidencia.
 */
export function aplicarCatalogo(reporte: Reporte, partida: Partida): ReporteGuardado {
	const actual = aGuardado(reporte);
	const contenido = contenidoDeCatalogo(partida);
	const disponibles = [...actual.alcances];
	const tomar = (titulo: string) => {
		const indice = disponibles.findIndex((a) => comparable(a.titulo) === comparable(titulo));
		return indice === -1 ? null : disponibles.splice(indice, 1)[0];
	};
	const alcances = contenido.alcances.map((delCatalogo) => {
		const previo = tomar(delCatalogo.titulo);
		return {
			id: previo?.id,
			titulo: delCatalogo.titulo,
			descripcion: delCatalogo.descripcion || previo?.descripcion || '',
			estadoVerificacion: previo?.estadoVerificacion ?? 'pendiente',
			observaciones: previo?.observaciones ?? '',
			partidaAlcanceId: delCatalogo.partidaAlcanceId,
			fotos: previo?.fotos ?? []
		};
	});
	const conEvidencia = disponibles.filter((a) => a.fotos.length > 0 || a.observaciones?.trim());
	return {
		...actual,
		objetivo: contenido.objetivo || actual.objetivo,
		introduccion: contenido.introduccion || actual.introduccion,
		conclusiones: contenido.conclusiones || actual.conclusiones,
		tipoMantenimiento: contenido.tipoMantenimiento,
		alcances: [...alcances, ...conEvidencia],
		herramientas: contenido.herramientas.length ? contenido.herramientas : actual.herramientas
	};
}
