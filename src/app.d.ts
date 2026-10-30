// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		/** Sesión validada por el servidor; vacía mientras no haya autenticación (D10). */
		interface Locals {
			autenticacion?: boolean;
			usuario?: {
				id: string;
				nombre: string;
				rol: import('$lib/dominio/esquemas').RolPersonal;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
