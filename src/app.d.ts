// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		/** Error que llega al navegador: un mensaje genérico y el id con que se registró en el servidor. */
		interface Error {
			message: string;
			id?: string;
		}
		/**
		 * Sesión validada por el servidor en hooks.server.ts: si el inicio de sesión está activado
		 * (existe alguna cuenta) y quién hace la petición. Sin activar, todo se permite (D10).
		 */
		interface Locals {
			autenticacion?: boolean;
			usuario?: import('$lib/dominio/esquemas').UsuarioSesion | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
