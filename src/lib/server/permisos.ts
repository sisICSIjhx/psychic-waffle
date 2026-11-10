// Un solo punto para decidir qué puede hacer quien hace la petición (cambios
// edicion-contratos-bitacora, D10, e inicio-sesion-roles, D8). Sin inicio de sesión activado todos
// pueden; activado, lo que la matriz de `dominio/permisos.ts` da al rol. El usuario de la bitácora
// sale siempre de la sesión validada por el servidor, nunca de la petición.
import type { RolPersonal } from '../dominio/esquemas.ts';
import { permisosDe, type Capacidad, type Permisos } from '../dominio/permisos.ts';
import type { ContextoBitacora } from './repositorios/catalogo.ts';

export interface LocalesPermisos {
	autenticacion?: boolean;
	usuario?: { id: string; nombre: string; rol: RolPersonal } | null;
}

/** Permisos de la petición; `locals` puede faltar en pruebas que llaman a `load` sin él. */
export function permisos(locals: LocalesPermisos | undefined): Permisos {
	return permisosDe({
		activada: Boolean(locals?.autenticacion),
		rol: locals?.usuario?.rol ?? null
	});
}

export function puede(locals: LocalesPermisos | undefined, capacidad: Capacidad): boolean {
	return permisos(locals)[capacidad];
}

export function puedeEditarCatalogo(locals: LocalesPermisos | undefined): boolean {
	return puede(locals, 'editarCatalogo');
}

export function contextoBitacora(locals: LocalesPermisos): Required<ContextoBitacora> {
	return {
		usuarioId: locals.usuario?.id ?? null,
		usuarioTexto: locals.usuario?.nombre ?? null,
		origen: 'interfaz'
	};
}

/** Alta y edición del personal y de sus cuentas: solo administradores con inicio de sesión. */
export function puedeAdministrarPersonal(locals: LocalesPermisos | undefined): boolean {
	return puede(locals, 'administrarPersonal');
}

export function puedeVerPersonal(locals: LocalesPermisos | undefined): boolean {
	return puede(locals, 'verPersonal');
}
