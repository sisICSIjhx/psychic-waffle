// Modelo de paginación del FOR-ICSI-RMT-01 para escribir el índice ya resuelto: calcula la página de
// cada título replicando las reglas de Word 365 medidas y calibradas contra Word (interlineado por
// métricas de la fuente, espaciado entre párrafos, filas de fotos indivisibles, keepNext, control de
// viudas y compresión de espacios en texto justificado). Es puro: recibe los datos que van a la
// plantilla y las medidas finales de las fotos; no lee archivos ni fuentes del sistema.
import { ANCHOS_FUENTES, type AnchosFuente } from './anchos-fuentes.ts';

const CM = 72 / 2.54;
const TWIP = 1 / 20;

/** Medidor de una fuente a partir de sus anchos versionados. */
export interface Medidor {
	ancho(texto: string, pt: number, kerning?: boolean): number;
	/** Interlineado sencillo de Word en pt. */
	sencillo(pt: number): number;
}

export function crearMedidor(datos: AnchosFuente, metricas: 'win' | 'typo'): Medidor {
	const avances = new Map<number, number>();
	for (const [desde, anchos] of datos.rangos) {
		anchos.forEach((a, i) => {
			if (a >= 0) avances.set(desde + i, a);
		});
	}
	const kern = new Map<number, number>();
	for (let i = 0; i < datos.kern.length; i += 3) {
		kern.set(datos.kern[i] * 0x110000 + datos.kern[i + 1], datos.kern[i + 2]);
	}
	const alto =
		metricas === 'win'
			? datos.winAscent + datos.winDescent + datos.hheaLineGap
			: datos.typoAscent - datos.typoDescent + datos.typoLineGap;
	return {
		ancho(texto, pt, conKerning = true) {
			let unidades = 0;
			let previo = -1;
			for (const caracter of texto) {
				const cp = caracter.codePointAt(0)!;
				unidades += avances.get(cp) ?? datos.xAvgCharWidth;
				if (conKerning && previo >= 0) unidades += kern.get(previo * 0x110000 + cp) ?? 0;
				previo = cp;
			}
			return (unidades * pt) / datos.upem;
		},
		sencillo: (pt) => (alto * pt) / datos.upem
	};
}

export const FUENTES = {
	arial: crearMedidor(ANCHOS_FUENTES.arial, 'win'),
	arialNegrita: crearMedidor(ANCHOS_FUENTES.arialNegrita, 'win'),
	aptos: crearMedidor(ANCHOS_FUENTES.aptos, 'typo'),
	aptosCursiva: crearMedidor(ANCHOS_FUENTES.aptosCursiva, 'typo'),
	openSans: crearMedidor(ANCHOS_FUENTES.openSans, 'win')
};

/** Geometría de la plantilla v2, medida con Word 365 (compatibilidad 15). */
export const GEOMETRIA_V2 = {
	versionPlantilla: 'FOR-ICSI-RMT-01.v2',
	/** Cuerpo: de y = 92,15 pt (margen superior 1843 twips) al margen inferior. */
	arriba: 1843 * TWIP,
	abajo: 790.5 - 36,
	anchoCuerpo: 9404 * TWIP,
	/** Holgura de la franja dudosa: un título más cerca del pie se fuerza a la página siguiente. */
	epsilon: 1.5,
	portada: {
		/**
		 * Fin de la portada (y en pt) con un renglón por celda del encabezado y 3 renglones de nombre y
		 * cargo en las firmas; medido con Word en 43 portadas (scripts/verificar-indice-word.ts).
		 */
		finBase: 717.6,
		abajo: 790.5 - 36,
		anchoValor: 5670 * TWIP,
		anchoTipo: 2268 * TWIP,
		/** Cada renglón más de una celda del encabezado (Open Sans 12) alarga la portada. */
		renglonEncabezado: 16.2,
		/** Ancho de una celda de firmas (1667/5000 de 10800 twips) menos sus márgenes de 30 twips. */
		anchoFirma: ((1667 / 5000) * 10800 - 60) * TWIP,
		/** La fila de nombre y cargo admite 3 renglones (Aptos 12); cada uno más suma un interlineado. */
		renglonesFirmaBase: 3,
		/** La fila de empresa (Aptos 8) admite 2 renglones. */
		renglonesEmpresaBase: 2
	},
	indice: {
		primeraEntrada: 119.4,
		/** Distancia entre entradas de un renglón: interlineado × 278/240 + 5 pt. */
		paso: 22,
		tabulacionDerecha: 9394 * TWIP,
		sangriaNivel2: 240 * TWIP,
		textoNivel2: 960 * TWIP,
		anchoNumeroPagina: 20
	}
} as const;

export type Geometria = typeof GEOMETRIA_V2;

/**
 * Renglones con corte voraz en espacios y después de guion. En texto justificado Word admite la
 * palabra siguiente comprimiendo espacios si la compresión por espacio no pasa del 24,5 % y el exceso
 * no pasa del 42 % del ancho de esa palabra (0 errores en 369 casos medidos).
 */
export function renglones(
	texto: string,
	ancho: number,
	fuente: Medidor,
	pt: number,
	{ sangriaPrimera = 0, justificado = false } = {}
): number {
	if (!texto) return 1;
	const piezas = texto.match(/[^\s-]*-|[^\s-]+|\s+/g) ?? [];
	const anchoEspacio = fuente.ancho(' ', pt);
	let lineas = 1;
	let x = 0;
	let limite = ancho - sangriaPrimera;
	let espacio = 0;
	let huecos = 0;
	for (const pieza of piezas) {
		if (/^\s+$/.test(pieza)) {
			espacio += fuente.ancho(pieza, pt);
			continue;
		}
		const w = fuente.ancho(pieza, pt);
		const exceso = x + espacio + w - limite;
		const comprime =
			justificado &&
			espacio > 0 &&
			exceso / ((huecos + 1) * anchoEspacio) <= 0.245 &&
			exceso <= 0.42 * w;
		if (x > 0 && exceso > 0.01 && !comprime) {
			lineas++;
			x = 0;
			huecos = 0;
			limite = ancho;
		} else {
			x += espacio;
			if (espacio > 0) huecos++;
		}
		espacio = 0;
		let resto = w;
		while (resto > limite + 0.01) {
			lineas++;
			resto -= limite;
			limite = ancho;
		}
		x += resto;
	}
	return lineas;
}

/** Celda de foto tal como llega a la plantilla: alto final en cm y pie. */
export interface CeldaModelo {
	pie: string;
	/** Alto de la imagen en cm (`ajustarACaja`). */
	alto: number;
}

/** Datos que recibe la plantilla y que determinan la paginación. */
export interface EntradaPaginacion {
	encabezado: {
		usuario: string;
		contrato: string;
		sitio: string;
		tag: string;
		periodicidad: string;
		fecha: string;
		tipoMantenimiento: string;
	};
	firmas: Record<
		'elaboro' | 'aprobo' | 'recibio',
		{ nombre: string; cargo: string; empresa: string }
	>;
	objetivo: string[];
	introduccion: string[];
	alcances: {
		titulo: string;
		descripcion: string[];
		cuadricula: { izq: CeldaModelo; der: CeldaModelo | null }[];
		antesDuranteDespues: {
			antes: CeldaModelo | null;
			durante: CeldaModelo | null;
			despues: CeldaModelo | null;
		}[];
	}[];
	herramientas: { numero: string; cantidad: string; descripcion: string }[];
	verificacion: {
		incluida: boolean;
		filas: { numero: string; alcance: string; estado: string; observaciones: string }[];
	};
	secciones: { conclusiones: string };
	conclusiones: string[];
}

type CeldaDatos = { pie: string; imagen: { height: number } } | null;

/** Convierte el objeto `datos` de `generarDocx` en la entrada del modelo (las fotos, a su alto en cm). */
export function entradaPaginacion(datos: {
	encabezado: EntradaPaginacion['encabezado'];
	firmas: EntradaPaginacion['firmas'];
	objetivo: string[];
	introduccion: string[];
	alcances: {
		titulo: string;
		descripcion: string[];
		cuadricula: { izq: CeldaDatos; der: CeldaDatos }[];
		antesDuranteDespues: { antes: CeldaDatos; durante: CeldaDatos; despues: CeldaDatos }[];
	}[];
	herramientas: EntradaPaginacion['herramientas'];
	verificacion: EntradaPaginacion['verificacion'];
	secciones: EntradaPaginacion['secciones'];
	conclusiones: string[];
}): EntradaPaginacion {
	const celda = (c: CeldaDatos): CeldaModelo | null =>
		c ? { pie: c.pie, alto: c.imagen.height } : null;
	return {
		...datos,
		alcances: datos.alcances.map((a) => ({
			titulo: a.titulo,
			descripcion: a.descripcion,
			cuadricula: a.cuadricula.map((f) => ({ izq: celda(f.izq)!, der: celda(f.der) })),
			antesDuranteDespues: a.antesDuranteDespues.map((f) => ({
				antes: celda(f.antes),
				durante: celda(f.durante),
				despues: celda(f.despues)
			}))
		}))
	};
}

/** Párrafo (`p`) o fila de tabla (`fila`) del cuerpo, en orden. */
export type Bloque =
	| {
			tipo: 'p';
			antes: number;
			despues: number;
			/** Interlineado en pt. */
			L: number;
			n: number;
			keepNext?: boolean;
			keepLines?: boolean;
			titulo?: { nivel: 1 | 2; texto: string };
	  }
	| {
			tipo: 'fila';
			alto: number;
			keepNext?: boolean;
			/** Alto del encabezado de tabla que se repite en la página siguiente. */
			repite?: number;
			n?: number;
			divisible?: boolean;
	  };

export function bloquesDelModelo(
	entrada: EntradaPaginacion,
	geometria: Geometria = GEOMETRIA_V2
): Bloque[] {
	const { arial, arialNegrita, aptosCursiva } = FUENTES;
	const W = geometria.anchoCuerpo;
	const bloques: Bloque[] = [];
	const lineaArial = arial.sencillo(12);
	const cuerpo = (t: string) =>
		bloques.push({
			tipo: 'p',
			antes: 6,
			despues: 6,
			L: lineaArial * (276 / 240),
			n: renglones(t, W, arial, 12, { justificado: true })
		});
	const nivel1 = (t: string) =>
		bloques.push({
			tipo: 'p',
			antes: 6,
			despues: 0,
			L: lineaArial * 1.4,
			n: 1,
			keepNext: true,
			keepLines: true,
			titulo: { nivel: 1, texto: t }
		});
	nivel1('1. OBJETIVO');
	entrada.objetivo.forEach(cuerpo);
	nivel1('2. ALCANCE');
	entrada.introduccion.forEach(cuerpo);
	const C1 = Math.floor(9404 / 2) * TWIP;
	const C2 = Math.floor(9404 / 2) * 2 * TWIP;
	// Dentro de la celda también vale máximo(posterior, anterior): etiqueta (6/2) → imagen (6/0).
	const celda = (f: CeldaModelo | null, ancho: number, etiqueta = false) =>
		(etiqueta ? 6 + lineaArial : 0) +
		6 +
		(f ? f.alto * CM : lineaArial) +
		2 +
		(f ? renglones(f.pie, ancho - 216 * TWIP, aptosCursiva, 9) : 1) * aptosCursiva.sencillo(9) +
		8;
	entrada.alcances.forEach((a, i) => {
		// Número «2.N » desde 18 pt; si pasa de la sangría (36 pt) la tabulación salta a la siguiente
		// tabulación predeterminada (múltiplos de 35,4 pt). Los renglones siguientes empiezan en 36 pt.
		const x = 18 + arialNegrita.ancho(`2.${i + 1} `, 12);
		const inicioTexto = x < 36 ? 36 : Math.ceil((x + 0.01) / 35.4) * 35.4;
		bloques.push({
			tipo: 'p',
			antes: 2,
			despues: 2,
			L: lineaArial * (278 / 240),
			n: renglones(a.titulo.trim(), W - 36, arialNegrita, 12, { sangriaPrimera: inicioTexto - 36 }),
			keepNext: true,
			keepLines: true,
			titulo: { nivel: 2, texto: a.titulo.trim() }
		});
		a.descripcion.forEach(cuerpo);
		for (const fila of a.cuadricula) {
			bloques.push({
				tipo: 'fila',
				alto: fila.der ? Math.max(celda(fila.izq, C1), celda(fila.der, C1)) : celda(fila.izq, C2)
			});
		}
		for (const fila of a.antesDuranteDespues) {
			if (fila.antes || fila.durante) {
				bloques.push({
					tipo: 'fila',
					alto: Math.max(celda(fila.antes, C1, true), celda(fila.durante, C1, true)),
					keepNext: true
				});
			}
			if (fila.despues) bloques.push({ tipo: 'fila', alto: celda(fila.despues, C2, true) });
		}
	});
	nivel1('3. HERRAMIENTAS Y EQUIPO');
	// La fila de encabezado (tblHeader) no queda sola al pie de la página: va con la primera de datos.
	bloques.push({
		tipo: 'fila',
		alto: 16.75 + 6,
		keepNext: entrada.herramientas.length > 0
	});
	for (const h of entrada.herramientas) {
		const n = Math.max(
			renglones(h.numero, (1195 - 216) * TWIP, arial, 12),
			renglones(h.cantidad, (1946 - 216) * TWIP, arial, 12),
			renglones(h.descripcion, (6323 - 216) * TWIP, arial, 12)
		);
		bloques.push({
			tipo: 'fila',
			alto: Math.max(16.75, n * lineaArial) + 0.5,
			repite: 17.15,
			n,
			divisible: n >= 4
		});
	}
	if (entrada.verificacion.incluida) {
		nivel1('4. DOCUMENTOS DE VERIFICACIÓN');
		bloques.push({
			tipo: 'fila',
			alto: 21.2 + 6,
			keepNext: entrada.verificacion.filas.length > 0
		});
		for (const v of entrada.verificacion.filas) {
			const n = Math.max(
				renglones(v.alcance, (4071 - 216) * TWIP, arial, 12),
				renglones(v.estado, (1657 - 216) * TWIP, arial, 12),
				renglones(v.observaciones, (2502 - 216) * TWIP, arial, 12)
			);
			bloques.push({
				tipo: 'fila',
				alto: Math.max(38.35, n * lineaArial) + 0.5,
				repite: 21.7,
				n,
				divisible: n >= 4
			});
		}
	}
	nivel1(`${entrada.secciones.conclusiones}. CONCLUSIONES Y/O RECOMENDACIONES`);
	entrada.conclusiones.forEach(cuerpo);
	return bloques;
}

export interface TituloPaginado {
	nivel: 1 | 2;
	texto: string;
	pagina: number;
	saltoForzado: boolean;
}

/**
 * Páginas de los títulos; el cuerpo empieza en `paginaInicial` tras el salto manual del índice. Con
 * `saltoForzado`, un título en la franja dudosa del pie (|holgura| ≤ ε) pasa a la página siguiente.
 */
export function paginar(
	bloques: Bloque[],
	paginaInicial: number,
	geometria: Geometria = GEOMETRIA_V2,
	{
		saltoForzado = true,
		traza
	}: { saltoForzado?: boolean; traza?: { bloque: number; pagina: number; y: number }[] } = {}
): { titulos: TituloPaginado[]; paginas: number } {
	const ARRIBA = geometria.arriba;
	const ABAJO = geometria.abajo;
	const LINEA = FUENTES.arial.sencillo(12);
	let pagina = paginaInicial;
	let y = ARRIBA;
	let despuesPrevio = 0;
	let inicio = true;
	const titulos: TituloPaginado[] = [];
	const holgura = (L: number) => L - LINEA;
	const nueva = () => {
		pagina++;
		y = ARRIBA;
		despuesPrevio = 0;
		inicio = true;
	};
	// Altura que debe acompañar a un bloque con keepNext: el inicio del siguiente.
	const acompanante = (i: number, despuesAnterior: number): number => {
		const s = bloques[i];
		if (!s) return 0;
		if (s.tipo === 'fila') {
			return (s.divisible ? 2 * LINEA : s.alto) + (s.keepNext ? acompanante(i + 1, 0) : 0);
		}
		const esp = bloques[i - 1]?.tipo === 'fila' ? s.antes : Math.max(despuesAnterior, s.antes);
		// Con control de viudas un párrafo de hasta 3 renglones no se divide.
		const n = s.keepLines ? s.n : s.n <= 3 ? s.n : 2;
		return esp + n * s.L + (s.keepNext ? acompanante(i + 1, s.despues) : -holgura(s.L));
	};
	for (let i = 0; i < bloques.length; i++) {
		const s = bloques[i];
		if (s.tipo === 'fila') {
			const extra = s.keepNext ? acompanante(i + 1, 0) : 0;
			const alto = s.alto + despuesPrevio;
			const caben = Math.min((s.n ?? 0) - 2, Math.floor((ABAJO - y - despuesPrevio) / LINEA));
			if (!inicio && s.divisible && y + alto > ABAJO + 0.01 && caben >= 2) {
				nueva();
				y += (s.repite ?? 0) + (s.alto - caben * LINEA);
				inicio = false;
				continue;
			}
			// Una fila con keepNext pasa a la página siguiente con todo lo que arrastra, aunque esa cadena
			// tampoco quepa completa en una página (medido con Word en la v2).
			if (!inicio && y + alto + extra > ABAJO + 0.01) {
				nueva();
				if (s.repite) y += s.repite;
			}
			traza?.push({ bloque: i, pagina, y: y + (inicio ? 0 : despuesPrevio) });
			y += (inicio ? 0 : despuesPrevio) + s.alto;
			despuesPrevio = 0;
			inicio = false;
			continue;
		}
		const tras = bloques[i - 1]?.tipo === 'fila';
		let esp = inicio ? 0 : tras ? s.antes : Math.max(despuesPrevio, s.antes);
		const extra = s.keepNext ? acompanante(i + 1, s.despues) : 0;
		if (s.keepLines || s.n === 1) {
			const fin = y + esp + s.n * s.L + (s.keepNext ? extra : -holgura(s.L));
			let forzado = false;
			if (!inicio && fin > ABAJO + 0.01) {
				nueva();
				esp = 0;
			} else if (
				s.titulo &&
				saltoForzado &&
				!inicio &&
				Math.abs(ABAJO - fin) <= geometria.epsilon
			) {
				forzado = true;
				nueva();
				esp = 0;
			}
			if (s.titulo) titulos.push({ ...s.titulo, pagina, saltoForzado: forzado });
			traza?.push({ bloque: i, pagina, y: y + esp });
			y += esp + s.n * s.L;
		} else {
			traza?.push({ bloque: i, pagina, y: y + esp });
			let restantes = s.n;
			let cabe = Math.floor((ABAJO - y - esp + holgura(s.L) + 0.01) / s.L);
			if (cabe === 1) cabe = 0;
			if (cabe > 0 && cabe < restantes && restantes - cabe === 1) cabe -= 1;
			if (cabe === 1) cabe = 0;
			if (cabe >= restantes) y += esp + restantes * s.L;
			else {
				if (cabe > 0) restantes -= cabe;
				nueva();
				while (restantes > 0) {
					const c = Math.floor((ABAJO - y + holgura(s.L) + 0.01) / s.L);
					if (c >= restantes) {
						y += restantes * s.L;
						restantes = 0;
					} else {
						restantes -= c;
						nueva();
					}
				}
			}
		}
		despuesPrevio = s.despues;
		inicio = false;
	}
	return { titulos, paginas: pagina };
}

/**
 * Páginas de la portada: con un renglón por celda variable termina en `finBase`; cada renglón más de
 * una celda del encabezado (Open Sans 12) o de las firmas (Aptos) la alarga. Si pasa del pie, ocupa 2.
 */
export function paginasPortada(
	entrada: EntradaPaginacion,
	geometria: Geometria = GEOMETRIA_V2
): number {
	const g = geometria.portada;
	const { openSans, aptos } = FUENTES;
	let fin: number = g.finBase;
	for (const [clave, valor] of Object.entries(entrada.encabezado)) {
		const ancho = clave === 'tipoMantenimiento' ? g.anchoTipo : g.anchoValor;
		fin += (renglones(valor, ancho, openSans, 12) - 1) * g.renglonEncabezado;
	}
	const firmas = Object.values(entrada.firmas);
	const nombreYCargo = Math.max(
		...firmas.map(
			(f) =>
				renglones(f.nombre, g.anchoFirma, aptos, 12) + renglones(f.cargo, g.anchoFirma, aptos, 12)
		)
	);
	const empresa = Math.max(...firmas.map((f) => renglones(f.empresa, g.anchoFirma, aptos, 8)));
	fin += Math.max(0, nombreYCargo - g.renglonesFirmaBase) * aptos.sencillo(12);
	fin += Math.max(0, empresa - g.renglonesEmpresaBase) * aptos.sencillo(8);
	return fin > g.abajo + 0.01 ? 2 : 1;
}

/** Páginas del índice: cada entrada mide sus renglones en Aptos 12 hasta la tabulación derecha. */
export function paginasIndice(
	titulos: { nivel: 1 | 2; texto: string }[],
	geometria: Geometria = GEOMETRIA_V2
): number {
	const g = geometria.indice;
	const { aptos } = FUENTES;
	const extra = aptos.sencillo(12) * (278 / 240);
	let y: number = g.primeraEntrada;
	let paginas = 1;
	for (const t of titulos) {
		// Nivel 1: «1. OBJETIVO» desde el margen; nivel 2: el título desde la tabulación de 960 twips.
		const inicio = t.nivel === 2 ? g.textoNivel2 : 0;
		const n = renglones(t.texto, g.tabulacionDerecha - g.anchoNumeroPagina - inicio, aptos, 12);
		const alto = g.paso + (n - 1) * extra;
		if (y + alto > geometria.abajo + 0.01) {
			paginas++;
			y = geometria.arriba;
		}
		y += alto;
	}
	return paginas;
}

export interface CalculoIndice {
	titulos: TituloPaginado[];
	paginaInicialCuerpo: number;
	paginasPortada: number;
	paginasIndice: number;
	paginas: number;
}

/** Página de cada título del documento con su portada e índice. */
export function calcularIndice(
	entrada: EntradaPaginacion,
	geometria: Geometria = GEOMETRIA_V2,
	opciones: { saltoForzado?: boolean } = {}
): CalculoIndice {
	const bloques = bloquesDelModelo(entrada, geometria);
	const titulos = bloques.flatMap((b) => (b.tipo === 'p' && b.titulo ? [b.titulo] : []));
	const portada = paginasPortada(entrada, geometria);
	const indice = paginasIndice(titulos, geometria);
	const paginaInicialCuerpo = 1 + portada + indice;
	const resultado = paginar(bloques, paginaInicialCuerpo, geometria, opciones);
	return {
		titulos: resultado.titulos,
		paginaInicialCuerpo,
		paginasPortada: portada,
		paginasIndice: indice,
		paginas: resultado.paginas
	};
}
