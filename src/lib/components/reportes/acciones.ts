// Invocación de las acciones del editor (/reportes/[id]) con fetch, como lo hace use:enhance, para
// el autoguardado y la carga de fotos sin recargar la página.

export type ResultadoAccion =
	| { ok: true; datos: Record<string, unknown> }
	| { ok: false; estado: number; datos: Record<string, unknown> };

/** `ruta` es la página del reporte: una ruta relativa se resolvería contra la página de destino
 * si el usuario ya navegó a otra. */
export type EnviarAccion = (
	accion: string,
	datos: FormData,
	ruta: string
) => Promise<ResultadoAccion>;

export const llamarAccion: EnviarAccion = async (accion, datos, ruta) => {
	try {
		const respuesta = await fetch(`${ruta}?/${accion}`, {
			method: 'POST',
			body: datos,
			headers: { 'x-sveltekit-action': 'true' }
		});
		// Importación diferida: el módulo de formularios solo existe dentro de la aplicación.
		const { deserialize } = await import('$app/forms');
		const resultado = deserialize(await respuesta.text());
		if (resultado.type === 'success') return { ok: true, datos: resultado.data ?? {} };
		if (resultado.type === 'failure') {
			return { ok: false, estado: resultado.status, datos: resultado.data ?? {} };
		}
		if (resultado.type === 'redirect') {
			window.location.assign(resultado.location);
			return { ok: true, datos: {} };
		}
		return {
			ok: false,
			estado: resultado.status ?? 500,
			datos: { error: 'El servidor no pudo completar la operación.' }
		};
	} catch {
		return {
			ok: false,
			estado: 0,
			datos: { error: 'Sin conexión con el servidor; se reintentará al seguir editando.' }
		};
	}
};
