// Sesión para el armazón: quién entró, si el inicio de sesión está activado y qué puede hacer su
// rol. Solo sirve para pintar el menú; cada acción vuelve a comprobar el permiso en el servidor.
import { permisos } from '$lib/server/permisos';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	sesion: {
		activada: Boolean(locals.autenticacion),
		usuario: locals.usuario
			? {
					nombre: locals.usuario.nombre,
					correo: locals.usuario.correo,
					rol: locals.usuario.rol,
					debeCambiar: locals.usuario.debeCambiar
				}
			: null,
		permisos: permisos(locals)
	}
});
