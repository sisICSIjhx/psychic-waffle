// Reglas de presentación del personal: etiquetas de rol, nombre completo, centros de costo y
// división del nombre completo de una lista.
import type { Personal, RolPersonal } from './esquemas.ts';

export const ETIQUETAS_ROL: Record<RolPersonal, string> = {
	administrador: 'Administrador',
	lider_administrativo: 'Líder administrativo',
	lider_operativo: 'Líder operativo',
	reporteador: 'Reporteador',
	mesa_directiva: 'Mesa directiva',
	contabilidad: 'Contabilidad'
};

export const DESCRIPCIONES_ROL: Record<RolPersonal, string> = {
	administrador: 'Acceso total: catálogo, personal y todos los centros de costo.',
	lider_administrativo: 'Da seguimiento al programa y a los reportes de sus centros de costo.',
	lider_operativo: 'Coordina la ejecución y revisa los reportes de sus centros de costo.',
	reporteador: 'Solo genera reportes de sus centros de costo.',
	mesa_directiva: 'Consulta todo, sin editar.',
	contabilidad: 'Consulta todo y registra la cobranza de los centros de costo.'
};

const ROLES_TODOS_LOS_CENTROS: readonly RolPersonal[] = [
	'administrador',
	'mesa_directiva',
	'contabilidad'
];

/**
 * Administrador, mesa directiva y contabilidad abarcan todos los centros de costo sin asignación; los
 * demás roles llevan la lista de los suyos (cambio centros-costo-plantillas, D6).
 */
export function requiereCentros(rol: RolPersonal): boolean {
	return !ROLES_TODOS_LOS_CENTROS.includes(rol);
}

/** «Nombre Paterno Materno», sin dobles espacios cuando falta el materno. */
export function nombreCompleto(
	persona: Pick<Personal, 'nombre' | 'apellidoPaterno' | 'apellidoMaterno'>
): string {
	return [persona.nombre, persona.apellidoPaterno, persona.apellidoMaterno]
		.map((parte) => parte?.trim())
		.filter(Boolean)
		.join(' ');
}

export function textoCentros(persona: Pick<Personal, 'rol' | 'centrosCosto'>): string {
	if (!requiereCentros(persona.rol)) return 'Todos los centros de costo';
	return persona.centrosCosto.map((c) => c.clave).join(', ') || 'Sin centros de costo';
}

/** Estado de la cuenta de una persona, para la lista y la ficha. */
export function textoAcceso(persona: Pick<Personal, 'acceso'>): string {
	if (!persona.acceso) return 'Sin cuenta';
	if (persona.acceso.bloqueadaHasta) return 'Bloqueada';
	return persona.acceso.debeCambiar ? 'Contraseña temporal' : 'Con cuenta';
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los']);

export interface NombreDividido {
	nombre: string;
	apellidoPaterno: string;
	apellidoMaterno: string | null;
}

/**
 * Divide «NOMBRE(S) PATERNO MATERNO»: los apellidos son los dos últimos, cada uno con las partículas
 * que lo preceden («DE LA TORRE»). Con dos palabras, la segunda es el paterno. Devuelve null si no
 * hay al menos nombre y un apellido. Es una propuesta: un nombre con un solo apellido compuesto no
 * se distingue de uno con dos, y se corrige en la ficha.
 */
export function dividirNombre(completo: string): NombreDividido | null {
	const palabras = completo.trim().split(/\s+/).filter(Boolean);
	if (palabras.length < 2) return null;
	// Toma del final un apellido con sus partículas, dejando siempre al menos una palabra.
	const tomarApellido = (): string => {
		const partes = [palabras.pop() as string];
		while (palabras.length > 1 && PARTICULAS.has(palabras[palabras.length - 1].toLowerCase())) {
			partes.unshift(palabras.pop() as string);
		}
		return partes.join(' ');
	};
	const ultimo = tomarApellido();
	if (palabras.length === 1) {
		return { nombre: palabras[0], apellidoPaterno: ultimo, apellidoMaterno: null };
	}
	const penultimo = tomarApellido();
	return { nombre: palabras.join(' '), apellidoPaterno: penultimo, apellidoMaterno: ultimo };
}

/**
 * Lee las líneas de una lista de personal: nombre completo, sede y correo separados por tabulador,
 * punto y coma o coma. Las líneas vacías se saltan; `linea` es la del archivo.
 */
export function leerListaPersonal(
	texto: string
): { linea: number; completo: string; sede: string | null; correo: string | null }[] {
	return texto
		.split(/\r?\n/)
		.map((contenido, indice) => ({ contenido, linea: indice + 1 }))
		.filter(({ contenido }) => contenido.trim() !== '')
		.map(({ contenido, linea }) => {
			const separador = contenido.includes('\t') ? '\t' : contenido.includes(';') ? ';' : ',';
			const [completo = '', sede = '', correo = ''] = contenido
				.split(separador)
				.map((campo) => campo.trim());
			return { linea, completo, sede: sede || null, correo: correo || null };
		});
}
