// Deriva partidas «por confirmar» a partir de reportes FOR-ICSI-RMT-01 existentes, para clientes
// cuyo catálogo oficial aún no se recibe (Proagro y Virtual). Uso local:
//
//   node scripts/derivar-partidas.ts <carpeta de reportes> --cliente <clave> --cliente-nombre <nombre>
//        [--vigencia AAAA-MM-DD:AAAA-MM-DD] [--aplicar]
//
// Por omisión es un ensayo. Agrupa por sitio y número de partida (la carpeta «PARTIDA NN» y la
// carpeta «ERM NNNNN» prevalecen sobre el texto del reporte, que a veces se copió de otro sitio),
// reúne los TAG como equipos y toma el contenido del reporte más completo. Los firmantes no se leen:
// son datos personales y se registran en /catalogo. Las partidas confirmadas no se modifican.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { repositoriosDesdeEntorno } from '../src/lib/server/datos-entorno.ts';
import { normalizarParaComparar } from '../src/lib/server/documentos/auditoria.ts';
import { periodicidadDeTexto } from '../src/lib/server/importacion/catalogo.ts';
import {
	leerReporteExistente,
	tagDeReporte,
	type ReporteExistente
} from '../src/lib/server/importacion/reporte-docx.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO_ENTORNO = join(RAIZ, '.env');
if (existsSync(ARCHIVO_ENTORNO)) process.loadEnvFile(ARCHIVO_ENTORNO);

const { values: opciones, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		cliente: { type: 'string' },
		'cliente-nombre': { type: 'string' },
		vigencia: { type: 'string', default: '2026-05-01:2027-04-30' },
		aplicar: { type: 'boolean', default: false }
	}
});
const carpeta = positionals[0];
if (!carpeta || !opciones.cliente || !opciones['cliente-nombre']) {
	console.error(
		'Uso: node scripts/derivar-partidas.ts <carpeta> --cliente <clave> --cliente-nombre <nombre> [--aplicar]'
	);
	process.exit(1);
}

async function* docx(directorio: string): AsyncGenerator<string> {
	for (const entrada of await readdir(directorio, { withFileTypes: true })) {
		const ruta = join(directorio, entrada.name);
		if (entrada.isDirectory()) yield* docx(ruta);
		else if (/\.docx$/i.test(entrada.name) && !entrada.name.startsWith('~$')) yield ruta;
	}
}

const masFrecuente = (valores: string[]) => {
	const cuenta = new Map<string, number>();
	for (const v of valores.filter(Boolean)) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
	return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
};

/**
 * «EM-30184 PAJARITOS» o «ERM 30185 ÁREA VI» → prefijo (EM o ERM, tal como está escrito), número y
 * nombre. Solo se normalizan los separadores y las mayúsculas.
 */
function separarSitio(texto: string): { prefijo: string; numero: string; nombre: string } | null {
	const coincidencia = /\b(E\s*R?\s*M)\s*-?\s*(\d{5})\b\s*(.*)$/i.exec(texto);
	return coincidencia
		? {
				prefijo: coincidencia[1].replace(/\s+/g, '').toUpperCase(),
				numero: coincidencia[2],
				nombre: coincidencia[3].replace(/\s+/g, ' ').trim()
			}
		: null;
}

interface Lectura {
	ruta: string;
	reporte: ReporteExistente;
	/** Número de la estación (de la carpeta o, si no hay, del encabezado). */
	sitioNumero: string;
	/** Prefijo escrito en la carpeta o en el encabezado. */
	prefijoCarpeta: string | null;
	/** Prefijo y nombre del encabezado, solo si su número coincide con el de la estación. */
	encabezado: { prefijo: string; nombre: string } | null;
	numero: string;
	tag: string | null;
	sitioClave: string;
}

const lecturas: Lectura[] = [];
const omitidos: string[] = [];
for await (const ruta of docx(resolve(carpeta))) {
	const reporte = await leerReporteExistente(await readFile(ruta));
	const segmentos = relative(resolve(carpeta), ruta).split(sep);
	// Solo las carpetas (no el nombre del archivo, que a veces se copió de otra partida).
	const carpetas = segmentos.slice(0, -1);
	const carpetaPartida = carpetas
		.map((s) => /PARTIDA\s*0*(\d+)/i.exec(s)?.[1])
		.filter(Boolean)
		.at(-1);
	const carpetaSitio = carpetas.map((s) => separarSitio(s)).find(Boolean);
	const delEncabezado = separarSitio(reporte.encabezado.sitio);
	const sitioNumero = carpetaSitio?.numero ?? delEncabezado?.numero;
	const numero = carpetaPartida ?? reporte.numero;
	if (!sitioNumero || !numero) {
		omitidos.push(`${basename(ruta)} (sin sitio o número de partida)`);
		continue;
	}
	lecturas.push({
		ruta,
		reporte,
		sitioNumero,
		prefijoCarpeta: carpetaSitio?.prefijo ?? null,
		encabezado: delEncabezado?.numero === sitioNumero ? delEncabezado : null,
		numero,
		tag: tagDeReporte(reporte.encabezado.tag, basename(ruta)),
		sitioClave: ''
	});
}

// Clave de cada estación con el prefijo tal como lo escriben los reportes (el más frecuente entre
// los encabezados que traen el mismo número); si ninguno lo trae, el de la carpeta.
for (const sitioNumero of new Set(lecturas.map((l) => l.sitioNumero))) {
	const delGrupo = lecturas.filter((l) => l.sitioNumero === sitioNumero);
	const prefijo =
		masFrecuente(delGrupo.map((l) => l.encabezado?.prefijo ?? '')) ||
		masFrecuente(delGrupo.map((l) => l.prefijoCarpeta ?? '')) ||
		'EM';
	for (const lectura of delGrupo) lectura.sitioClave = `${prefijo}-${sitioNumero}`;
}

const usuario = masFrecuente(lecturas.map((l) => l.reporte.encabezado.usuario));
const numeroContrato = masFrecuente(
	lecturas.map((l) => l.reporte.encabezado.contrato.replace(/\(.*?\)/g, '').trim())
);

const grupos = new Map<string, Lectura[]>();
for (const lectura of lecturas) {
	const clave = `${lectura.sitioClave}|${lectura.numero}`;
	grupos.set(clave, [...(grupos.get(clave) ?? []), lectura]);
}

console.log(
	`${lecturas.length} reportes leídos; ${grupos.size} partidas en ${new Set(lecturas.map((l) => l.sitioClave)).size} sitio(s). Usuario: ${usuario}.`
);
for (const o of omitidos) console.log(`Omitido: ${o}`);

const repos = await repositoriosDesdeEntorno(process.env);
try {
	const iguales = (a: string, b: string) => normalizarParaComparar(a) === normalizarParaComparar(b);
	const clientes = await repos.catalogo.listarClientes();
	const contratos = await repos.catalogo.listarContratos();
	let cliente = clientes.find((c) => c.clave === opciones.cliente);
	// Un número de contrato que ya usa otro cliente es un error de captura de los reportes (Virtual
	// reutiliza el de Cerritos): se registra un número provisional por confirmar.
	const ajeno = contratos.find(
		(c) => iguales(c.numero, numeroContrato) && c.cliente?.clave !== opciones.cliente
	);
	const numeroFinal =
		!numeroContrato || ajeno ? `${opciones.cliente!.toUpperCase()}-POR-CONFIRMAR` : numeroContrato;
	let contrato = contratos.find(
		(c) => iguales(c.numero, numeroFinal) && c.cliente?.clave === opciones.cliente
	);
	console.log(
		`Contrato: ${numeroFinal}${ajeno ? ' (provisional: el de los reportes pertenece a otro cliente)' : ''}.`
	);

	if (!opciones.aplicar) {
		for (const [clave, grupo] of grupos) {
			const tags = [...new Set(grupo.map((g) => g.tag).filter(Boolean))];
			console.log(
				`  ${clave}: ${grupo.length} reporte(s)${tags.length ? `, TAG ${tags.join(', ')}` : ''}`
			);
		}
		console.log(
			'Ensayo: no se guardó nada. Repita con --aplicar para registrar las partidas por confirmar.'
		);
		// process.exit omite el finally: se cierra la base antes de salir.
		await repos.cerrar();
		process.exit(0);
	}

	cliente ??= await repos.catalogo.guardarCliente({
		clave: opciones.cliente!,
		nombre: opciones['cliente-nombre']!,
		razonSocial: usuario || opciones['cliente-nombre']!
	});
	const [vigenciaInicio, vigenciaFin] = opciones.vigencia!.split(':');
	contrato ??= await repos.catalogo.guardarContrato({
		clienteId: cliente.id,
		numero: numeroFinal,
		descripcion: 'Derivado de reportes existentes: confirmar número y vigencia.',
		vigenciaInicio,
		vigenciaFin
	});

	const sitios = new Map<string, string>();
	for (const clave of new Set(lecturas.map((l) => l.sitioClave))) {
		const nombre = masFrecuente(
			lecturas.filter((l) => l.sitioClave === clave).map((l) => l.encabezado?.nombre ?? '')
		);
		const existente = (await repos.catalogo.listarSitios()).find((s) => iguales(s.clave, clave));
		const sitio = existente ?? (await repos.catalogo.guardarSitio({ clave, nombre }));
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		sitios.set(clave, sitio.id);
	}

	let creadas = 0;
	let omitidasConfirmadas = 0;
	for (const grupo of grupos.values()) {
		const { sitioClave, numero } = grupo[0];
		const sitioId = sitios.get(sitioClave)!;
		const existentes = await repos.catalogo.listarPartidas({ contratoId: contrato.id, sitioId });
		const existente = existentes.find(
			(p) => p.numero.replace(/^0+(?=\d)/, '') === numero.replace(/^0+(?=\d)/, '')
		);
		if (existente?.estadoCatalogo === 'confirmado') {
			omitidasConfirmadas++;
			continue;
		}
		const equipos = await repos.catalogo.listarEquipos(sitioId);
		const equipoIds: string[] = [];
		for (const tag of new Set(grupo.map((g) => g.tag).filter((t): t is string => Boolean(t)))) {
			const equipo =
				equipos.find((e) => iguales(e.tag, tag)) ??
				(await repos.catalogo.guardarEquipo({ sitioId, tag }));
			equipoIds.push(equipo.id);
		}
		// El reporte más completo aporta el contenido de la plantilla.
		const base = [...grupo].sort((a, b) => b.reporte.alcances.length - a.reporte.alcances.length)[0]
			.reporte;
		const periodicidad =
			periodicidadDeTexto(masFrecuente(grupo.map((g) => g.reporte.encabezado.periodicidad))) ??
			'cuando_aplique';
		await repos.catalogo.guardarPartida({
			id: existente?.id,
			contratoId: contrato.id,
			sitioId,
			numero,
			actividad: base.actividad || `Partida ${numero}`,
			descripcion: base.introduccion.join('\n') || null,
			periodicidad,
			tipoMantenimiento: base.encabezado.tipoMantenimiento || 'Preventivo',
			objetivo: base.objetivo.join('\n') || null,
			conclusionesBase: base.conclusiones.join('\n') || null,
			disposicionFotos: grupo.some((g) => g.reporte.antesDuranteDespues)
				? 'antes_durante_despues'
				: 'cuadricula',
			proponeVerificacion: grupo.some((g) => g.reporte.tieneVerificacion),
			estadoCatalogo: 'por_confirmar',
			// Primer renglón: título del alcance; los siguientes, su descripción base.
			alcances: base.alcances.map((a) => ({
				tipo: 'alcance' as const,
				texto: [a.titulo, ...a.descripcion].join('\n')
			})),
			herramientas: base.herramientas,
			equipoIds
		});
		creadas++;
	}
	console.log(
		`Partidas por confirmar registradas o actualizadas: ${creadas}. Omitidas por estar confirmadas: ${omitidasConfirmadas}.`
	);
} finally {
	await repos.cerrar();
}
