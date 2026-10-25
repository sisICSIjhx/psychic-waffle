// Arrastre interno de fotos para reordenarlas dentro de un alcance. El navegador no deja leer los datos
// arrastrados hasta soltar, así que la foto y su alcance de origen se guardan aquí, compartidos por las
// instancias de FotosAlcance de la página. El tipo propio distingue este arrastre del de archivos.

export const TIPO_ARRASTRE_FOTO = 'application/x-icsi-foto';

let actual: { fotoId: string; origen: object } | null = null;

export const arrastreFotos = {
	iniciar(fotoId: string, origen: object) {
		actual = { fotoId, origen };
	},
	terminar() {
		actual = null;
	},
	/** Foto arrastrada si salió de `origen` (el mismo alcance); si no, null. */
	desde(origen: object): string | null {
		return actual && actual.origen === origen ? actual.fotoId : null;
	}
};

export const esArrastreDeFoto = (datos: DataTransfer | null | undefined): boolean =>
	!!datos?.types.includes(TIPO_ARRASTRE_FOTO);
