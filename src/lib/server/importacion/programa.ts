// Análisis de un libro de programa anual sin hoja de catálogo (formato de Proagro): una hoja con fila
// de meses (con o sin año), columna P/R y, opcionalmente, varios sitios separados por filas
// «(ERM nnnnn)». Devuelve el programa del bloque del sitio elegido con sus advertencias.
import { diasDelMes, MESES } from '../../dominio/documento.ts';
import { normalizarParaComparar } from '../documentos/auditoria.ts';
import {
	cantidadDelMes,
	ErrorImportacion,
	periodicidadDeTexto,
	rangosDeMeses,
	type Periodicidad
} from './catalogo.ts';
import { esRellenoMarcado, valorEn, type Hoja, type ValorCelda } from './xlsx.ts';
import type { CargaPrograma } from '../repositorios/programa.ts';

export type TipoLibro = 'catalogo' | 'programa';

export interface AdvertenciaPrograma {
	partida: string | null;
	mes: string | null;
	/** Fila de Excel (base 1). */
	fila: number | null;
	texto: string;
}

export interface PartidaPrograma {
	numero: string;
	/** Actividad del libro sin la periodicidad final. */
	actividad: string;
	periodicidad: Periodicidad;
	cantidadAnual: number | null;
	meses: { mes: string; cantidad: number }[];
	realizados: { mes: string; cantidad: number }[];
	/** Fila P en Excel (base 1). */
	fila: number;
	/** Pedir que se use la actividad del libro también en una partida existente. */
	usarActividad?: boolean;
}

export interface ProgramaAnalizado {
	hoja: string;
	sitio: string;
	programa: { periodoInicio: string; periodoFin: string; nombre: string | null };
	partidas: PartidaPrograma[];
	advertencias: AdvertenciaPrograma[];
	/** Claves de cinco dígitos de los bloques del libro, en orden. */
	bloques: string[];
}

const normalizar = (valor: ValorCelda | undefined) =>
	normalizarParaComparar(String(valor ?? ''))
		.toUpperCase()
		.replace(/\s+/g, ' ')
		.trim();

const texto = (valor: ValorCelda | undefined) =>
	valor === null || valor === undefined ? '' : String(valor).replace(/\s+/g, ' ').trim();

const MESES_NORMALIZADOS = MESES.map((m) => normalizar(m));
const PATRON_CLAVE = /\b(?:ERM|EM|RM)[\s-]*(\d{5})\b/g;
const PATRON_PERIODICIDAD =
	/[\s,]*\(?\s*(DIARI[OA]|SEMANAL|QUINCENAL|MENSUAL|BIMESTRAL|TRIMESTRAL|CUATRIMESTRAL|SEMESTRAL|ANUAL)\s*\)?\s*\.?\s*$/i;

/** «MAYO», «MAYO 2026» o «MAYO DE 2026» → índice del mes (0-11) y año si lo trae. */
function mesDeCelda(valor: ValorCelda | undefined): { indice: number; anio: number | null } | null {
	const coincidencia = /^([A-Z]+)(?: (?:DE )?(\d{4}))?$/.exec(normalizar(valor));
	if (!coincidencia) return null;
	const indice = MESES_NORMALIZADOS.indexOf(coincidencia[1]);
	return indice === -1 ? null : { indice, anio: coincidencia[2] ? Number(coincidencia[2]) : null };
}

function clavesEn(valor: string): string[] {
	return [...new Set([...normalizar(valor).matchAll(PATRON_CLAVE)].map((m) => m[1]))];
}

/** Cinco dígitos de la clave del sitio («EM-30184» → «30184»). */
export function digitosClave(clave: string): string | null {
	return /(\d{5})/.exec(clave)?.[1] ?? null;
}

/** Quita la periodicidad final de la actividad: «(SEMANAL).», «(MENSUAL)», «, MENSUAL», « MENSUAL.». */
export function actividadSinPeriodicidad(actividad: string): string {
	const limpia = actividad.replace(/\s+/g, ' ').trim();
	const sin = limpia.replace(PATRON_PERIODICIDAD, '').trim();
	return sin.replace(/[\s,.;:]+$/, '').trim() || limpia;
}

function filaDeMeses(hoja: Hoja): number {
	const limite = Math.min(hoja.filas.length, 40);
	for (let fila = 0; fila < limite; fila++) {
		if ((hoja.filas[fila] ?? []).filter((v) => mesDeCelda(v)).length >= 2) return fila;
	}
	return -1;
}

/** Columna P/R: por cabecera o, si no hay, la que a la izquierda de los meses solo trae P o R. */
function columnaPR(hoja: Hoja, filaMeses: number, primeraColumnaMes: number): number {
	for (let fila = 0; fila <= filaMeses + 2 && fila < hoja.filas.length; fila++) {
		const indice = (hoja.filas[fila] ?? []).findIndex((v) => normalizar(v) === 'P/R');
		if (indice !== -1) return indice;
	}
	for (let columna = primeraColumnaMes - 1; columna >= 0; columna--) {
		let valores = 0;
		let soloPR = true;
		for (let fila = filaMeses + 1; fila < hoja.filas.length; fila++) {
			const v = normalizar(hoja.filas[fila]?.[columna]);
			if (!v) continue;
			valores++;
			if (v !== 'P' && v !== 'R') soloPR = false;
		}
		if (valores >= 2 && soloPR) return columna;
	}
	return -1;
}

/** Catálogo si alguna hoja es de catálogo o alcances; programa si una hoja tiene meses y P/R. */
export function tipoDeLibro(hojas: Hoja[]): TipoLibro {
	if (hojas.some((h) => /CATALOGO|ALCANCES/.test(normalizar(h.nombre)))) return 'catalogo';
	if (hojas.some((h) => hojaDePrograma(h))) return 'programa';
	throw new ErrorImportacion(
		'El libro no tiene una estructura reconocida. Se aceptan dos formatos: el catálogo (hoja «PROGRAMA ANUAL» con cabeceras y hoja «Catálogo de Conceptos-ALCANCES») o un programa anual (una hoja con la fila de meses y la columna P/R, con uno o varios sitios).',
		'(libro)'
	);
}

function hojaDePrograma(hoja: Hoja): boolean {
	const filaMeses = filaDeMeses(hoja);
	if (filaMeses === -1) return false;
	const primera = (hoja.filas[filaMeses] ?? []).findIndex((v) => mesDeCelda(v));
	return columnaPR(hoja, filaMeses, primera) !== -1;
}

function siguienteMes(mesIso: string): string {
	const [anio, mes] = mesIso.split('-').map(Number);
	return mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
}

function marcada(hoja: Hoja, fila: number, columna: number): 'marca' | 'otro' | null {
	if (esRellenoMarcado(hoja.rellenos[fila]?.[columna])) return 'marca';
	const valor = normalizar(hoja.filas[fila]?.[columna]);
	if (!valor) return null;
	return valor === 'X' || valor === 'P' || valor === 'R' || /^\d+$/.test(valor) ? 'marca' : 'otro';
}

const esRojo = (relleno: string | undefined) => /^rgb:(FF)?FF0000$/.test(relleno ?? '');

export interface OpcionesPrograma {
	/** Clave del sitio elegido («EM-30184»); se compara por sus cinco dígitos. */
	claveSitio: string;
	/** Año del primer mes cuando el libro no lo trae. */
	anio?: number;
}

export function analizarProgramaAnual(
	hojas: Hoja[],
	{ claveSitio, anio }: OpcionesPrograma
): ProgramaAnalizado {
	const hoja = hojas.find((h) => hojaDePrograma(h));
	if (!hoja) {
		throw new ErrorImportacion(
			'El libro no tiene una hoja con la fila de meses y la columna P/R',
			'(libro)',
			'MESES'
		);
	}
	const advertencias: AdvertenciaPrograma[] = [];
	const filaMeses = filaDeMeses(hoja);

	// Meses, año y rangos de columnas (D3).
	const celdasMes = (hoja.filas[filaMeses] ?? []).flatMap((v, columna) => {
		const mes = mesDeCelda(v);
		return mes ? [{ columna, ...mes }] : [];
	});
	let anioActual = celdasMes.find((c) => c.anio !== null)?.anio ?? null;
	if (celdasMes[0].anio === null) {
		let titulo: number | null = null;
		for (let fila = 0; fila < filaMeses && titulo === null; fila++) {
			for (const v of hoja.filas[fila] ?? []) {
				const m = /PROGRAMA ANUAL (?:DE )?(\d{4})/.exec(normalizar(v));
				if (m) {
					titulo = Number(m[1]);
					break;
				}
			}
		}
		anioActual = titulo ?? anio ?? null;
		if (anioActual === null) {
			throw new ErrorImportacion(
				`La hoja «${hoja.nombre}» no indica el año de sus meses: agregue «PROGRAMA ANUAL AAAA» al título o indique el año`,
				hoja.nombre,
				'MESES'
			);
		}
	}
	let indiceAnterior = -1;
	const conAnio = celdasMes.map((c) => {
		if (c.anio !== null) anioActual = c.anio;
		else if (c.indice <= indiceAnterior) anioActual = anioActual! + 1;
		indiceAnterior = c.indice;
		return {
			columna: c.columna,
			mes: `${anioActual}-${String(c.indice + 1).padStart(2, '0')}-01`
		};
	});
	const rangos = rangosDeMeses(hoja, filaMeses, conAnio).map((r) => {
		const columnas: number[] = [];
		for (let c = r.columna; c <= r.hasta; c++) if (!hoja.columnasOcultas.has(c)) columnas.push(c);
		return { ...r, columnas };
	});
	const visibles = rangos.filter((r) => r.columnas.length > 0);
	if (!visibles.length) {
		throw new ErrorImportacion(`La hoja «${hoja.nombre}» no tiene meses visibles`, hoja.nombre);
	}
	for (let i = 1; i < visibles.length; i++) {
		if (visibles[i].mes !== siguienteMes(visibles[i - 1].mes)) {
			throw new ErrorImportacion(
				`Los meses visibles de la hoja «${hoja.nombre}» no son consecutivos (${visibles[i - 1].mes.slice(0, 7)} y ${visibles[i].mes.slice(0, 7)})`,
				hoja.nombre,
				'MESES'
			);
		}
	}
	const ultimo = visibles.at(-1)!.mes;
	const [anioFin, mesFin] = ultimo.split('-').map(Number);
	const programa = {
		periodoInicio: visibles[0].mes,
		periodoFin: `${ultimo.slice(0, 8)}${String(diasDelMes(anioFin, mesFin)).padStart(2, '0')}`,
		nombre: null
	};

	// Columnas (D5).
	const primeraColumnaMes = Math.min(...rangos.map((r) => r.columna));
	const pr = columnaPR(hoja, filaMeses, primeraColumnaMes);
	const columnas = { numero: pr - 4, actividad: pr - 3, cantidad: pr - 2, periodicidad: pr - 1 };
	for (let fila = 0; fila <= filaMeses + 1 && fila < hoja.filas.length; fila++) {
		const celdas = (hoja.filas[fila] ?? []).map((v) => normalizar(v));
		const buscar = (prueba: (t: string) => boolean) => celdas.findIndex((t) => t && prueba(t));
		const encontradas = {
			numero: buscar((t) => t === 'PARTIDA' || t === 'NO.' || t === 'ITEM'),
			actividad: buscar((t) => t === 'ACTIVIDAD'),
			cantidad: buscar((t) => t.startsWith('CANTIDAD')),
			periodicidad: buscar((t) => t.startsWith('PERIODICIDAD') || t === 'FRECUENCIA')
		};
		if (Object.values(encontradas).every((c) => c !== -1)) Object.assign(columnas, encontradas);
	}
	if (Object.values(columnas).some((c) => c < 0)) {
		throw new ErrorImportacion(
			`La hoja «${hoja.nombre}» no tiene las columnas de partida, actividad, cantidad y periodicidad antes de P/R`,
			hoja.nombre,
			'PARTIDA'
		);
	}
	const nombreColumna = (c: number) => {
		let r = '';
		for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26))
			r = String.fromCharCode(65 + ((n - 1) % 26)) + r;
		return r;
	};

	// Bloques por sitio (D4).
	const separadoras: { fila: number; clave: string }[] = [];
	for (let fila = filaMeses + 1; fila < hoja.filas.length; fila++) {
		if (normalizar(hoja.filas[fila]?.[pr])) continue;
		const claves = clavesEn((hoja.filas[fila] ?? []).map(texto).join(' '));
		if (claves.length === 1) separadoras.push({ fila, clave: claves[0] });
	}
	const clavesEncabezado: string[] = [];
	for (let fila = 0; fila < filaMeses; fila++) {
		for (const v of hoja.filas[fila] ?? []) clavesEncabezado.push(...clavesEn(texto(v)));
	}
	const primeraClave = [...new Set(clavesEncabezado)].find(
		(c) => !separadoras.some((s) => s.clave === c)
	);
	const bloques: { clave: string | null; desde: number; hasta: number }[] = [];
	const inicioPartidas = filaMeses + 1;
	if (!separadoras.length && !primeraClave) {
		bloques.push({ clave: null, desde: inicioPartidas, hasta: hoja.filas.length - 1 });
	} else {
		const primeraSeparadora = separadoras[0]?.fila ?? hoja.filas.length;
		bloques.push({
			clave: primeraClave ?? null,
			desde: inicioPartidas,
			hasta: primeraSeparadora - 1
		});
		separadoras.forEach((s, i) =>
			bloques.push({
				clave: s.clave,
				desde: s.fila + 1,
				hasta: (separadoras[i + 1]?.fila ?? hoja.filas.length) - 1
			})
		);
	}
	const digitos = digitosClave(claveSitio);
	const listaBloques = bloques.flatMap((b) => (b.clave ? [b.clave] : []));
	const bloque =
		bloques.length === 1 && bloques[0].clave === null
			? bloques[0]
			: bloques.find((b) => b.clave !== null && b.clave === digitos);
	if (!bloque) {
		throw new ErrorImportacion(
			`El libro no trae el sitio ${claveSitio}. Sitios del libro: ${listaBloques.map((c) => `ERM ${c}`).join(', ') || 'ninguno'}`,
			hoja.nombre,
			'SITIO'
		);
	}
	for (const b of bloques) {
		if (b.clave !== null) continue;
		for (let fila = b.desde; fila <= b.hasta; fila++) {
			if (normalizar(hoja.filas[fila]?.[pr]) === 'P' && bloques.length > 1) {
				throw new ErrorImportacion(
					`La fila ${fila + 1} de la hoja «${hoja.nombre}» tiene una partida sin sitio: agregue la clave del sitio al encabezado o una fila separadora «(ERM nnnnn)»`,
					hoja.nombre,
					'SITIO'
				);
			}
		}
	}

	// Partidas del bloque (D5 y D6).
	const columnasVisibles = new Set(visibles.flatMap((r) => r.columnas));
	const partidas: PartidaPrograma[] = [];
	const filasPorNumero = new Map<string, number>();
	const sitio = bloque.clave ? `ERM ${bloque.clave}` : claveSitio;
	const avisar = (partida: string | null, mes: string | null, fila: number | null, t: string) =>
		advertencias.push({
			partida,
			mes,
			fila,
			texto: `${sitio}${partida ? `, partida ${partida}` : ''}: ${t}`
		});

	for (let fila = bloque.desde; fila <= bloque.hasta; fila++) {
		if (normalizar(hoja.filas[fila]?.[pr]) !== 'P') continue;
		const numero = texto(valorEn(hoja, fila, columnas.numero));
		if (!/^\d+[A-Z]?$/i.test(numero)) {
			throw new ErrorImportacion(
				`La fila ${fila + 1} de la hoja «${hoja.nombre}» no tiene un número de partida válido en la columna ${nombreColumna(columnas.numero)} («${numero}»)`,
				hoja.nombre,
				nombreColumna(columnas.numero)
			);
		}
		const normalizado = numero.replace(/^0+(?=\d)/, '').toUpperCase();
		const previa = filasPorNumero.get(normalizado);
		if (previa !== undefined) {
			throw new ErrorImportacion(
				`La partida ${numero} se repite en las filas ${previa + 1} y ${fila + 1} del sitio ${sitio}`,
				hoja.nombre,
				nombreColumna(columnas.numero)
			);
		}
		filasPorNumero.set(normalizado, fila);
		const textoPeriodicidad = texto(valorEn(hoja, fila, columnas.periodicidad));
		const periodicidad = periodicidadDeTexto(textoPeriodicidad);
		if (!periodicidad) {
			throw new ErrorImportacion(
				`La partida ${numero} (fila ${fila + 1}) tiene una periodicidad no reconocida en la columna ${nombreColumna(columnas.periodicidad)}: «${textoPeriodicidad}»`,
				hoja.nombre,
				nombreColumna(columnas.periodicidad)
			);
		}
		const valorCantidad = valorEn(hoja, fila, columnas.cantidad);
		if (valorCantidad !== null && typeof valorCantidad !== 'number') {
			throw new ErrorImportacion(
				`La partida ${numero} (fila ${fila + 1}) no tiene un número en la columna de cantidad ${nombreColumna(columnas.cantidad)}: «${texto(valorCantidad)}»`,
				hoja.nombre,
				nombreColumna(columnas.cantidad)
			);
		}
		const actividad = actividadSinPeriodicidad(texto(valorEn(hoja, fila, columnas.actividad)));
		const filaR = normalizar(hoja.filas[fila + 1]?.[pr]) === 'R' ? fila + 1 : -1;

		const contar = (f: number) =>
			visibles.map((r) => {
				let marcas = 0;
				for (const c of r.columnas) {
					const m = marcada(hoja, f, c);
					if (m === 'marca') marcas++;
					else if (m === 'otro') {
						avisar(
							numero,
							r.mes,
							f + 1,
							`se ignora el valor «${texto(hoja.filas[f]?.[c])}» de ${nombreColumna(c)}${f + 1} (${r.mes.slice(0, 7)}), que no es una marca.`
						);
					}
				}
				return { mes: r.mes, marcas };
			});
		const cantidadPorMes = (lista: { mes: string; marcas: number }[], esR: boolean) =>
			lista.flatMap(({ mes, marcas }) => {
				if (!marcas || periodicidad === 'cuando_aplique') return [];
				if (periodicidad === 'semanal' || periodicidad === 'quincenal') {
					return [{ mes, cantidad: marcas }];
				}
				if (periodicidad === 'diaria') return [{ mes, cantidad: cantidadDelMes('diaria', mes)! }];
				if (marcas > 1 && !esR) {
					avisar(numero, mes, fila + 1, `tiene ${marcas} marcas en ${mes.slice(0, 7)}; cuenta 1.`);
				}
				return [{ mes, cantidad: 1 }];
			});
		const meses = cantidadPorMes(contar(fila), false);
		const realizados = filaR === -1 ? [] : cantidadPorMes(contar(filaR), true);

		// Advertencias del libro.
		const total = meses.reduce((s, m) => s + m.cantidad, 0);
		if (
			typeof valorCantidad === 'number' &&
			periodicidad !== 'cuando_aplique' &&
			total !== valorCantidad
		) {
			avisar(
				numero,
				null,
				fila + 1,
				`la cantidad anual es ${valorCantidad} y las marcas suman ${total}.`
			);
		}
		if (periodicidad === 'mensual') {
			const sinMarca = visibles.filter((r) => !meses.some((m) => m.mes === r.mes));
			if (sinMarca.length && sinMarca.length < visibles.length) {
				avisar(
					numero,
					null,
					fila + 1,
					`es mensual y no tiene marca en ${sinMarca.map((r) => r.mes.slice(0, 7)).join(', ')}.`
				);
			}
		}
		if ([columnas.numero, columnas.actividad].some((c) => esRojo(hoja.rellenos[fila]?.[c]))) {
			avisar(numero, null, fila + 1, 'la fila está resaltada en rojo en el libro.');
		}
		for (const r of realizados) {
			if (!meses.some((m) => m.mes === r.mes)) {
				avisar(
					numero,
					r.mes,
					(filaR === -1 ? fila : filaR) + 1,
					`tiene realizado en ${r.mes.slice(0, 7)} sin programado (P) en ese mes.`
				);
			}
		}
		const ocultasMarcadas = [...hoja.columnasOcultas]
			.filter((c) => c > pr && !columnasVisibles.has(c))
			.sort((a, b) => a - b)
			.filter((c) => [fila, filaR].some((f) => f !== -1 && marcada(hoja, f, c) === 'marca'));
		if (ocultasMarcadas.length) {
			avisar(
				numero,
				null,
				fila + 1,
				`se ignoran ${ocultasMarcadas.length} marcas en columnas ocultas (${ocultasMarcadas.map(nombreColumna).join(', ')}).`
			);
		}
		if (hoja.filasOcultas.has(fila))
			avisar(numero, null, fila + 1, 'la fila está oculta en el libro.');

		partidas.push({
			numero,
			actividad,
			periodicidad,
			cantidadAnual: periodicidad === 'cuando_aplique' ? null : (valorCantidad as number | null),
			meses,
			realizados,
			fila: fila + 1
		});
	}
	if (!partidas.length) {
		throw new ErrorImportacion(
			`El sitio ${sitio} no tiene partidas en el libro`,
			hoja.nombre,
			'P/R'
		);
	}
	return { hoja: hoja.nombre, sitio, programa, partidas, advertencias, bloques: listaBloques };
}

/** Carga para `api_importar_programa` a partir del análisis del bloque del sitio. */
export function cargaDePrograma(
	analisis: ProgramaAnalizado,
	contratoId: string,
	sitioId: string,
	confirmar = false
): CargaPrograma {
	return {
		contratoId,
		sitioId,
		confirmar,
		programa: analisis.programa,
		partidas: analisis.partidas.map((p) => ({
			numero: p.numero,
			actividad: p.actividad,
			usarActividad: p.usarActividad ?? false,
			periodicidad: p.periodicidad,
			cantidadAnual: p.cantidadAnual,
			meses: p.meses,
			realizados: p.realizados
		}))
	};
}

/** Ajustes del CLI: periodicidad por partida y partidas que usan la actividad del libro. */
export interface AjustesPrograma {
	periodicidades: Map<string, Periodicidad>;
	usarActividad: string[];
}

const numeroComparable = (n: string) =>
	n
		.trim()
		.replace(/^0+(?=\d)/, '')
		.toUpperCase();

/** «--periodicidad 25=cuatrimestral» (repetible) y «--usar-actividad 22,23». */
export function analizarAjustes(
	periodicidades: string[],
	usarActividad: string[]
): AjustesPrograma {
	const mapa = new Map<string, Periodicidad>();
	for (const valor of periodicidades) {
		const m = /^\s*(\d+[A-Z]?)\s*=\s*(.+)$/i.exec(valor);
		const periodicidad = m ? periodicidadDeTexto(m[2]) : null;
		if (!m || !periodicidad) {
			throw new Error(
				`Periodicidad inválida: «${valor}». Use <partida>=<periodicidad>, p. ej. 25=cuatrimestral`
			);
		}
		mapa.set(numeroComparable(m[1]), periodicidad);
	}
	const numeros = usarActividad
		.flatMap((v) => v.split(','))
		.map((v) => v.trim())
		.filter(Boolean);
	for (const n of numeros) {
		if (!/^\d+[A-Z]?$/i.test(n))
			throw new Error(`Número de partida inválido en --usar-actividad: «${n}»`);
	}
	return { periodicidades: mapa, usarActividad: numeros.map(numeroComparable) };
}

/**
 * Aplica los ajustes a la carga: cambia la periodicidad (recalcula lo programado de cada mes según
 * las marcas de la nueva periodicidad) y marca las actividades a usar. Un número que no esté en el
 * bloque se rechaza.
 */
export function aplicarAjustes(
	analisis: ProgramaAnalizado,
	ajustes: AjustesPrograma
): ProgramaAnalizado {
	const numeros = new Set(analisis.partidas.map((p) => numeroComparable(p.numero)));
	for (const n of [...ajustes.periodicidades.keys(), ...ajustes.usarActividad]) {
		if (!numeros.has(n))
			throw new Error(`La partida ${n} no está en el sitio ${analisis.sitio} del libro`);
	}
	let advertencias = analisis.advertencias;
	const partidas = analisis.partidas.map((p) => {
		const n = numeroComparable(p.numero);
		const periodicidad = ajustes.periodicidades.get(n);
		const conActividad = ajustes.usarActividad.includes(n) ? { ...p, usarActividad: true } : p;
		if (!periodicidad || periodicidad === p.periodicidad) return conActividad;
		const recalcular = (lista: { mes: string; cantidad: number }[]) =>
			lista.flatMap(({ mes, cantidad }) => {
				if (periodicidad === 'cuando_aplique') return [];
				if (periodicidad === 'semanal' || periodicidad === 'quincenal') return [{ mes, cantidad }];
				if (periodicidad === 'diaria') return [{ mes, cantidad: cantidadDelMes('diaria', mes)! }];
				return [{ mes, cantidad: 1 }];
			});
		const ajustada = {
			...conActividad,
			periodicidad,
			cantidadAnual: periodicidad === 'cuando_aplique' ? null : p.cantidadAnual,
			meses: recalcular(p.meses),
			realizados: recalcular(p.realizados)
		};
		// Las advertencias que dependían de la periodicidad anterior se recalculan.
		advertencias = advertencias.filter(
			(a) => a.partida !== p.numero || !/es mensual y no tiene marca|las marcas suman/.test(a.texto)
		);
		const total = ajustada.meses.reduce((s, m) => s + m.cantidad, 0);
		if (ajustada.cantidadAnual !== null && total !== ajustada.cantidadAnual) {
			advertencias = [
				...advertencias,
				{
					partida: p.numero,
					mes: null,
					fila: p.fila,
					texto: `${analisis.sitio}, partida ${p.numero}: la cantidad anual es ${ajustada.cantidadAnual} y las marcas suman ${total}.`
				}
			];
		}
		return ajustada;
	});
	return { ...analisis, partidas, advertencias };
}

/** Meses del periodo que quedan fuera de una vigencia. */
export function mesesFueraDeVigencia(
	programa: { periodoInicio: string; periodoFin: string },
	vigencia: { vigenciaInicio: string; vigenciaFin: string }
): string[] {
	const fuera: string[] = [];
	for (
		let mes = programa.periodoInicio.slice(0, 8) + '01';
		mes <= programa.periodoFin;
		mes = siguienteMes(mes)
	) {
		const [a, m] = mes.split('-').map(Number);
		const finMes = `${mes.slice(0, 8)}${String(diasDelMes(a, m)).padStart(2, '0')}`;
		if (finMes < vigencia.vigenciaInicio || mes > vigencia.vigenciaFin) fuera.push(mes);
	}
	return fuera;
}

/** Resultado del ensayo que interesa a las advertencias. */
export interface ResultadoParaAdvertencias {
	partidas: {
		numero: string;
		periodicidadAntes: string | null;
		periodicidad: string;
		tieneReportes: boolean;
	}[];
}

/**
 * Advertencias del libro más las que dependen de la base: vigencia que no contiene el periodo y
 * cambio de periodicidad en partidas con reportes. Las usan la ruta y el CLI.
 */
export function advertenciasDelEnsayo(
	analisis: ProgramaAnalizado,
	resultado: ResultadoParaAdvertencias,
	contrato: { numero: string; vigenciaInicio: string; vigenciaFin: string }
): AdvertenciaPrograma[] {
	const advertencias = [...analisis.advertencias];
	const fuera = mesesFueraDeVigencia(analisis.programa, contrato);
	if (fuera.length) {
		advertencias.unshift({
			partida: null,
			mes: null,
			fila: null,
			texto: `${analisis.sitio}: la vigencia del contrato ${contrato.numero} (${contrato.vigenciaInicio} a ${contrato.vigenciaFin}) no contiene el periodo del programa (${analisis.programa.periodoInicio} a ${analisis.programa.periodoFin}); no se podrán capturar reportes de ${fuera.map((m) => m.slice(0, 7)).join(', ')}.`
		});
	}
	for (const p of resultado.partidas) {
		if (p.tieneReportes && p.periodicidadAntes && p.periodicidadAntes !== p.periodicidad) {
			advertencias.push({
				partida: p.numero,
				mes: null,
				fila: null,
				texto: `${analisis.sitio}, partida ${p.numero}: tiene reportes y cambia de periodicidad (${p.periodicidadAntes} → ${p.periodicidad}); sus reportes conservan la ocurrencia anterior.`
			});
		}
	}
	return advertencias;
}

/**
 * Valida «--ajustar-vigencia»: la vigencia nueva debe contener el periodo del programa y no dejar
 * fuera reportes ni programas del contrato.
 */
export function validarAjusteVigencia(
	vigencia: { vigenciaInicio: string; vigenciaFin: string },
	programa: { periodoInicio: string; periodoFin: string },
	reportes: { periodoMes: string }[],
	programas: { periodoInicio: string; periodoFin: string }[]
): string[] {
	const errores: string[] = [];
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(vigencia.vigenciaInicio) ||
		!/^\d{4}-\d{2}-\d{2}$/.test(vigencia.vigenciaFin) ||
		vigencia.vigenciaFin < vigencia.vigenciaInicio
	) {
		return [
			'La vigencia debe tener la forma AAAA-MM-DD:AAAA-MM-DD, con el fin después del inicio.'
		];
	}
	if (
		programa.periodoInicio < vigencia.vigenciaInicio ||
		programa.periodoFin > vigencia.vigenciaFin
	) {
		errores.push(
			`La vigencia ${vigencia.vigenciaInicio} a ${vigencia.vigenciaFin} no contiene el periodo del programa (${programa.periodoInicio} a ${programa.periodoFin}).`
		);
	}
	const reportesFuera = reportes.filter(
		(r) =>
			r.periodoMes < vigencia.vigenciaInicio.slice(0, 8) + '01' ||
			r.periodoMes > vigencia.vigenciaFin
	);
	if (reportesFuera.length) {
		errores.push(
			`La vigencia deja fuera ${reportesFuera.length} reportes del contrato (${[...new Set(reportesFuera.map((r) => r.periodoMes.slice(0, 7)))].join(', ')}).`
		);
	}
	const programasFuera = programas.filter(
		(p) => p.periodoInicio < vigencia.vigenciaInicio || p.periodoFin > vigencia.vigenciaFin
	);
	if (programasFuera.length) {
		errores.push(
			`La vigencia deja fuera programas del contrato (${programasFuera.map((p) => `${p.periodoInicio} a ${p.periodoFin}`).join('; ')}).`
		);
	}
	return errores;
}
