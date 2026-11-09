// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		/** Error que llega al navegador: un mensaje genérico y el id con que se registró en el servidor. */
		interface Error {
			message: string;
			id?: string;
		}
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
