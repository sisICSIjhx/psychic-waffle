// Reportes sintéticos deterministas por semilla para calibrar y probar el modelo de paginación del
// índice contra Word. Conserva el generador congruencial y el orden de sorteos del prototipo del
// análisis (semillas 1-64 iguales); desde la semilla 65 agrega casos de portada (varios TAG, nombres
// largos y fechas de varios días). Solo datos ficticios; el vocabulario sale de un ejemplo versionado.
import {
	ajustarACaja,
	CAJA_FOTO,
	ordenDeAparicion,
	pieIlustracion,
	type DisposicionFotos,
	type EstadoVerificacion,
	type MomentoFoto
} from '../../dominio/documento.ts';
import { parrafos as parrafosDe, type AlcancePreparado, type ReporteDocumento } from './generar.ts';

/** Dimensiones en píxeles de las fotos sintéticas (la primera con 55 % de probabilidad). */
export const DIMENSIONES: readonly [number, number][] = [
	[1600, 1200],
	[1200, 1600],
	[1600, 900],
	[900, 1600],
	[1200, 1200],
	[1600, 1000]
];

export interface FotoSintetica {
	dim: [number, number];
	momento: MomentoFoto | null;
	descripcion: string;
}

export type ReporteSintetico = Omit<ReporteDocumento, 'alcances'> & {
	alcances: {
		titulo: string;
		descripcion: string;
		fotos: FotoSintetica[];
		estado: EstadoVerificacion;
		observaciones: string;
	}[];
};

/** Base de los reportes sintéticos: un `reporte` de scripts/datos-prueba sin sus fotos. */
export type BaseSintetica = Omit<ReporteDocumento, 'alcances'> & {
	alcances: { descripcion: string }[];
};

export function reporteSintetico(semilla: number, base: BaseSintetica): ReporteSintetico {
	const fuenteTexto = [
		base.objetivo,
		base.introduccion,
		base.conclusiones,
		...base.alcances.map((a) => a.descripcion)
	].join(' ');
	const palabras = fuenteTexto.split(/\s+/).filter((w) => w.length > 0);
	let estado = semilla * 7919;
	const azar = () => (estado = (estado * 1103515245 + 12345) % 2147483648) / 2147483648;
	const entero = (a: number, b: number) => a + Math.floor(azar() * (b - a + 1));
	const frase = (n: number) => {
		const i = entero(0, palabras.length - 1);
		const w: string[] = [];
		for (let k = 0; k < n; k++) w.push(palabras[(i + k) % palabras.length]);
		const t = w.join(' ').replace(/[.,;:]+$/, '');
		return t.charAt(0).toUpperCase() + t.slice(1);
	};
	const parrafos = (min: number, max: number, pmin: number, pmax: number) =>
		Array.from({ length: entero(min, max) }, () => frase(entero(pmin, pmax)) + '.').join('\n');

	const disposicion: DisposicionFotos = azar() < 0.6 ? 'cuadricula' : 'antes_durante_despues';
	const nAlcances = entero(1, 14);
	const alcances: ReporteSintetico['alcances'] = [];
	for (let a = 0; a < nAlcances; a++) {
		const nFotos = entero(0, disposicion === 'cuadricula' ? 9 : 6);
		const fotos: FotoSintetica[] = [];
		for (let f = 0; f < nFotos; f++) {
			const dim = DIMENSIONES[azar() < 0.55 ? 0 : entero(1, DIMENSIONES.length - 1)];
			const momento =
				disposicion === 'cuadricula' ? null : (['antes', 'durante', 'despues'] as const)[f % 3];
			fotos.push({ dim: [...dim], momento, descripcion: azar() < 0.3 ? '' : frase(entero(1, 14)) });
		}
		alcances.push({
			titulo: frase(entero(2, azar() < 0.15 ? 22 : 9)),
			descripcion: azar() < 0.1 ? '' : parrafos(1, 3, 6, 70),
			fotos,
			estado: (['ok', 'pendiente', 'con_observacion', 'no_aplica'] as const)[entero(0, 3)],
			observaciones: azar() < 0.5 ? '' : frase(entero(1, 18))
		});
	}
	const reporte: ReporteSintetico = {
		...base,
		disposicionFotos: disposicion,
		objetivo: parrafos(1, 3, 10, 90),
		introduccion: parrafos(1, 2, 8, 60),
		incluyeVerificacion: azar() < 0.5,
		herramientas: Array.from({ length: entero(1, 18) }, (_, i) => ({
			cantidad: `${entero(1, 9)} piezas`,
			descripcion: frase(entero(1, i % 5 === 0 ? 16 : 5))
		})),
		conclusiones: parrafos(1, 6, 8, 70),
		alcances
	};
	if (semilla >= 65) {
		// Casos de portada: TAG, firmas largas y días de ejecución.
		const nTags = entero(1, 12);
		reporte.tags = Array.from(
			{ length: nTags },
			(_, i) => `PI-${String(1000 + i * 101).padStart(4, '0')}`
		);
		const largo = (n: number) => frase(entero(Math.max(1, n - 3), n + 3));
		for (const funcion of ['elaboro', 'aprobo', 'recibio'] as const) {
			const actual = base.firmantes[funcion];
			reporte.firmantes = {
				...reporte.firmantes,
				[funcion]: {
					nombre: azar() < 0.3 ? `Ing. ${largo(6)}` : actual.nombre,
					cargo: azar() < 0.3 ? largo(8) : actual.cargo,
					empresa: actual.empresa
				}
			};
		}
		const mes = `${base.periodo.anio}-${String(base.periodo.mes).padStart(2, '0')}`;
		const dia = (d: number) => `${mes}-${String(d).padStart(2, '0')}`;
		const dias: { desde: string; hasta: string }[] = [];
		const nDias = entero(1, 9);
		let d = entero(1, 4);
		while (d <= 28 && dias.length < nDias) {
			const fin = azar() < 0.4 ? Math.min(28, d + entero(1, 4)) : d;
			dias.push({ desde: dia(d), hasta: dia(fin) });
			d = fin + entero(1, 3);
		}
		reporte.encabezado = {
			...reporte.encabezado,
			dias: dias.length ? dias : [{ desde: dia(1), hasta: dia(1) }]
		};
	}
	return reporte;
}

/**
 * Alcances listos para la plantilla sin generar imágenes: las medidas salen de las dimensiones de
 * cada foto, igual que en `prepararAlcances`. Sirve para calcular el índice sin crear el DOCX.
 */
export function preparadosSinImagen(reporte: ReporteSintetico): AlcancePreparado[] {
	const caja = CAJA_FOTO[reporte.disposicionFotos];
	return reporte.alcances.map((a, i) => ({
		titulo: a.titulo.trim(),
		descripcion: parrafosDe(a.descripcion),
		celdas: ordenDeAparicion(a.fotos, reporte.disposicionFotos).map((f, j) => {
			const medida = ajustarACaja(f.dim[0], f.dim[1], caja);
			return {
				imagen: {
					width: medida.ancho,
					height: medida.alto,
					data: Buffer.alloc(0),
					extension: '.jpg' as const
				},
				pie: pieIlustracion(i + 1, j + 1, f.descripcion.trim()),
				momento: f.momento
			};
		})
	}));
}
