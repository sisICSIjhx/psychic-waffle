// Reglas puras de las fotos de un alcance: reordenar (arrastre, menú y teclado), pasar a la columna
// vecina en antes/durante/después y girar. Las fotos ocultas (bajas pendientes de «Deshacer»)
// conservan su posición relativa; las fotos sin momento cuentan como DURANTE.

export type Momento = 'antes' | 'durante' | 'despues';
export type Rotacion = 0 | 90 | 180 | 270;
export type DisposicionFotos = 'cuadricula' | 'antes_durante_despues';

interface FotoOrdenable {
	id: string;
	momento?: Momento | null;
}

export const MOMENTOS: readonly Momento[] = ['antes', 'durante', 'despues'];

const momentoDe = (f: FotoOrdenable): Momento => f.momento ?? 'durante';

export interface MovimientoFoto {
	fotoId: string;
	/** Foto junto a la que se coloca; null la deja al final de su grupo. */
	destinoId: string | null;
	lado: 'antes' | 'despues';
	/** Espacio de destino (antes/durante/después); sin él, la foto conserva el suyo. */
	momento?: Momento | null;
}

/** Coloca la foto antes o después de otra (o al final de su grupo) y, si se indica, cambia su espacio. */
export function reordenarFoto<T extends FotoOrdenable>(
	fotos: readonly T[],
	movimiento: MovimientoFoto
): T[] {
	const foto = fotos.find((f) => f.id === movimiento.fotoId);
	if (!foto || movimiento.destinoId === movimiento.fotoId) return [...fotos];
	const resto = fotos.filter((f) => f.id !== movimiento.fotoId);
	const movida: T =
		movimiento.momento === undefined ? foto : { ...foto, momento: movimiento.momento };
	if (movimiento.destinoId === null) {
		const grupo = momentoDe(movida);
		let ultimo = -1;
		resto.forEach((f, i) => {
			if (momentoDe(f) === grupo) ultimo = i;
		});
		const indice = ultimo === -1 ? resto.length : ultimo + 1;
		return [...resto.slice(0, indice), movida, ...resto.slice(indice)];
	}
	const destino = resto.findIndex((f) => f.id === movimiento.destinoId);
	if (destino === -1) return [...fotos];
	const indice = movimiento.lado === 'antes' ? destino : destino + 1;
	return [...resto.slice(0, indice), movida, ...resto.slice(indice)];
}

/** Visibles del grupo de la foto, en orden (toda la lista en la cuadrícula). */
function grupoVisible<T extends FotoOrdenable>(
	fotos: readonly T[],
	foto: T,
	disposicion: DisposicionFotos,
	ocultas: Record<string, unknown>
): T[] {
	return fotos.filter(
		(f) => !ocultas[f.id] && (disposicion === 'cuadricula' || momentoDe(f) === momentoDe(foto))
	);
}

/** Intercambia la foto con la vecina visible anterior (−1) o siguiente (+1) de su grupo. */
export function moverPaso<T extends FotoOrdenable>(
	fotos: readonly T[],
	fotoId: string,
	paso: -1 | 1,
	disposicion: DisposicionFotos,
	ocultas: Record<string, unknown> = {}
): T[] {
	const foto = fotos.find((f) => f.id === fotoId);
	if (!foto) return [...fotos];
	const grupo = grupoVisible(fotos, foto, disposicion, ocultas);
	const vecina = grupo[grupo.indexOf(foto) + paso];
	if (!vecina) return [...fotos];
	return reordenarFoto(fotos, {
		fotoId,
		destinoId: vecina.id,
		lado: paso === -1 ? 'antes' : 'despues'
	});
}

/** Pasa la foto a la columna vecina (antes ← durante → después) en la misma posición, o al final. */
export function moverDeColumna<T extends FotoOrdenable>(
	fotos: readonly T[],
	fotoId: string,
	sentido: -1 | 1,
	ocultas: Record<string, unknown> = {}
): T[] {
	const foto = fotos.find((f) => f.id === fotoId);
	if (!foto) return [...fotos];
	const momento = MOMENTOS[MOMENTOS.indexOf(momentoDe(foto)) + sentido];
	if (!momento) return [...fotos];
	const posicion = grupoVisible(fotos, foto, 'antes_durante_despues', ocultas).indexOf(foto);
	const destino = fotos.filter((f) => !ocultas[f.id] && momentoDe(f) === momento);
	const junto = destino[posicion];
	return reordenarFoto(fotos, {
		fotoId,
		destinoId: junto ? junto.id : null,
		lado: 'antes',
		momento
	});
}

/** Siguiente múltiplo de 90° hacia la derecha (+1) o la izquierda (−1). */
export function girar(rotacion: Rotacion, sentido: -1 | 1): Rotacion {
	return ((((rotacion + 90 * sentido) % 360) + 360) % 360) as Rotacion;
}

/**
 * Escala con la que una foto girada cabe completa en su marco: la imagen se muestra con
 * `object-fit: contain`, así que con 90° o 270° su caja se intercambia. Con 0° y 180° es 1.
 */
export function escalaGirada(
	medidas: { ancho: number; alto: number },
	rotacion: Rotacion,
	marco: { ancho: number; alto: number }
): number {
	if (rotacion % 180 === 0 || medidas.ancho <= 0 || medidas.alto <= 0) return 1;
	const ajuste = Math.min(marco.ancho / medidas.ancho, marco.alto / medidas.alto);
	const ancho = medidas.ancho * ajuste;
	const alto = medidas.alto * ajuste;
	return Math.min(marco.ancho / alto, marco.alto / ancho);
}

/** Formatos que acepta la carga de fotos; el servidor valida cada archivo. */
export const ACEPTA_FOTOS =
	'.jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif';
