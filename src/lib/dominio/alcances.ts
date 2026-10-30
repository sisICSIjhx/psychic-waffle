// Alcances predeterminados del proyecto copiados a una partida (cambio alcances-personal-esquema-bd).
import type { AlcancePredeterminado } from './esquemas.ts';

type RenglonAlcance = { tipo: AlcancePredeterminado['tipo']; texto: string };

/** Igual que normalizar_clave en la base: sin acentos, sin mayúsculas y con espacios simples. */
function clave({ tipo, texto }: RenglonAlcance): string {
	const limpio = texto
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.toUpperCase();
	return `${tipo}:${limpio}`;
}

/** Agrega al final los elegidos que la partida no tenga ya con el mismo tipo y texto. */
export function agregarPredeterminados<T extends RenglonAlcance>(
	actuales: T[],
	elegidos: AlcancePredeterminado[],
	crear: (alcance: AlcancePredeterminado) => T
): T[] {
	const vistos = new Set(actuales.map(clave));
	const nuevos: T[] = [];
	for (const alcance of elegidos) {
		const k = clave(alcance);
		if (vistos.has(k)) continue;
		vistos.add(k);
		nuevos.push(crear(alcance));
	}
	return [...actuales, ...nuevos];
}
