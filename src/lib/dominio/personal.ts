// Reglas de presentación del personal: etiquetas de rol, nombre completo y proyectos visibles.
import type { Personal, RolPersonal } from './esquemas.ts';

export const ETIQUETAS_ROL: Record<RolPersonal, string> = {
	administrador: 'Administrador',
	lider_administrativo: 'Líder administrativo',
	lider_operativo: 'Líder operativo',
	reporteador: 'Reporteador'
};

export const DESCRIPCIONES_ROL: Record<RolPersonal, string> = {
	administrador: 'Acceso total: catálogo, personal y todos los proyectos.',
	lider_administrativo: 'Da seguimiento al programa y a los reportes de sus proyectos.',
	lider_operativo: 'Coordina la ejecución y revisa los reportes de sus proyectos.',
	reporteador: 'Solo genera reportes de sus proyectos.'
};

/** El administrador ve todos los proyectos sin asignación (D3). */
export function requiereProyectos(rol: RolPersonal): boolean {
	return rol !== 'administrador';
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

export function textoProyectos(persona: Pick<Personal, 'rol' | 'proyectos'>): string {
	if (!requiereProyectos(persona.rol)) return 'Todos los proyectos';
	return persona.proyectos.map((p) => p.nombre).join(', ') || 'Sin proyectos';
}
