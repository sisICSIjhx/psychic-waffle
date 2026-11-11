// Preferencias de la interfaz guardadas en el navegador.
// El script en línea de src/app.html aplica el tema antes de pintar con la misma clave y la misma
// regla que temaInicial; si cambian aquí, deben cambiar allá.

export type Tema = 'light' | 'dark';

export const CLAVE_TEMA = 'icsi-tema';
export const CLAVE_PANEL_LATERAL = 'icsi-panel-lateral';

/** El tema guardado o, si no hay uno válido, el del sistema. */
export function temaInicial(guardado: string | null, sistemaOscuro: boolean): Tema {
	if (guardado === 'light' || guardado === 'dark') return guardado;
	return sistemaOscuro ? 'dark' : 'light';
}

export type DisenoPrograma = 'nuevo' | 'original';

export const CLAVE_DISENO_PROGRAMA = 'icsi-diseno-programa';

/** El programa anual usa el diseño nuevo salvo que se haya elegido el original. */
export function disenoProgramaInicial(guardado: string | null): DisenoPrograma {
	return guardado === 'original' ? 'original' : 'nuevo';
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
