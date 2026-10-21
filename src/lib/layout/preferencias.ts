// Preferencias de la interfaz guardadas en el navegador: tema y menú contraído.
// El script en línea de src/app.html aplica el tema antes de pintar con la misma clave y la misma
// regla que temaInicial; si cambian aquí, deben cambiar allá.

export type Tema = 'light' | 'dark';

export const CLAVE_TEMA = 'icsi-tema';
export const CLAVE_MENU_CONTRAIDO = 'icsi-menu-contraido';

/** El tema guardado o, si no hay uno válido, el del sistema. */
export function temaInicial(guardado: string | null, sistemaOscuro: boolean): Tema {
	if (guardado === 'light' || guardado === 'dark') return guardado;
	return sistemaOscuro ? 'dark' : 'light';
}

/** Lee una preferencia; devuelve null si el navegador no permite el almacenamiento. */
export function leerPreferencia(clave: string): string | null {
	try {
		return globalThis.localStorage?.getItem(clave) ?? null;
	} catch {
		return null;
	}
}

export function guardarPreferencia(clave: string, valor: string | null): void {
	try {
		if (valor === null) globalThis.localStorage?.removeItem(clave);
		else globalThis.localStorage?.setItem(clave, valor);
	} catch {
		// Sin almacenamiento (modo privado o bloqueado) la preferencia dura solo la sesión.
	}
}
