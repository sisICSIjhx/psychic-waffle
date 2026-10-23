// Un solo punto para decidir quién edita el catálogo (cambio edicion-contratos-bitacora, D10). Sin
// autenticación configurada todos pueden; con ella, solo los administradores. El usuario de la
// bitácora sale siempre de la sesión validada por el servidor, nunca de la petición.
import type { ContextoBitacora } from './repositorios/catalogo.ts';

export interface LocalesPermisos {
	autenticacion?: boolean;
	usuario?: { id: string; nombre: string; rol: 'administrador' | 'capturista' } | null;
}

export function puedeEditarCatalogo(locals: LocalesPermisos): boolean {
	if (!locals.autenticacion) return true;
	return locals.usuario?.rol === 'administrador';
}

export function contextoBitacora(locals: LocalesPermisos): Required<ContextoBitacora> {
	return {
		usuarioId: locals.usuario?.id ?? null,
		usuarioTexto: locals.usuario?.nombre ?? null,
		origen: 'interfaz'
	};
}
