// Importa un «CATALOGO DE ALCANCES.xlsx» en la base configurada (Supabase o PGlite local).
//
// Uso:
//   npm run importar -- <archivo.xlsx> --contrato <número> --sitio <clave> [--aplicar]
// Por omisión hace un ensayo: muestra el resumen sin guardar nada. Con --aplicar guarda todo en una
// transacción. Si el contrato o el sitio no existen, se pueden crear al aplicar con:
//   --cliente <clave> --cliente-nombre <nombre> --razon-social <texto>
//   --vigencia <AAAA-MM-DD>:<AAAA-MM-DD> --sitio-nombre <nombre> --crear
// Los firmantes que trae la hoja no se importan: se listan para registrarlos desde /catalogo.
//
// Programa anual sin catálogo (formato de Proagro, uno o varios sitios en una hoja):
//   npm run importar -- <archivo.xlsx> --programa --contrato <número> --sitio <clave> [--aplicar]
//     [--anio <AAAA>] [--usar-actividad <n[,n…]>] [--periodicidad <n>=<valor>]…
//     [--ajustar-vigencia <AAAA-MM-DD>:<AAAA-MM-DD>] [--confirmar]
// Solo cambia la periodicidad, la cantidad anual, los meses y las marcas R; el contrato y el sitio
// deben existir. No se combina con --crear.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Contrato } from '../src/lib/dominio/esquemas.ts';
import { repositoriosDesdeEntorno } from '../src/lib/server/datos-entorno.ts';
import { normalizarParaComparar } from '../src/lib/server/documentos/auditoria.ts';
import { analizarLibroCatalogo, ErrorImportacion } from '../src/lib/server/importacion/catalogo.ts';
import {
	advertenciasDelEnsayo,
	analizarAjustes,
	analizarProgramaAnual,
	aplicarAjustes,
	cargaDePrograma,
	validarAjusteVigencia,
	type ProgramaAnalizado
} from '../src/lib/server/importacion/programa.ts';
import { leerLibro } from '../src/lib/server/importacion/xlsx.ts';
import type { Repositorios } from '../src/lib/server/repositorios/index.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO_ENTORNO = join(RAIZ, '.env');
if (existsSync(ARCHIVO_ENTORNO)) process.loadEnvFile(ARCHIVO_ENTORNO);

const { values: opciones, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		contrato: { type: 'string' },
		sitio: { type: 'string' },
		aplicar: { type: 'boolean', default: false },
		crear: { type: 'boolean', default: false },
		cliente: { type: 'string' },
		'cliente-nombre': { type: 'string' },
		'razon-social': { type: 'string' },
		vigencia: { type: 'string' },
		'sitio-nombre': { type: 'string' },
		programa: { type: 'boolean', default: false },
		anio: { type: 'string' },
		'usar-actividad': { type: 'string', multiple: true, default: [] },
		periodicidad: { type: 'string', multiple: true, default: [] },
		'ajustar-vigencia': { type: 'string' },
		confirmar: { type: 'boolean', default: false }
	}
});

function fallar(mensaje: string): never {
	console.error(mensaje);
	process.exit(1);
}

const archivo = positionals[0];
const numeroContrato = opciones.contrato;
const claveSitio = opciones.sitio;
if (!archivo || !numeroContrato || !claveSitio) {
	fallar('Uso: npm run importar -- <archivo.xlsx> --contrato <número> --sitio <clave> [--aplicar]');
}

const igual = (a: string, b: string) => normalizarParaComparar(a) === normalizarParaComparar(b);

/** Importación de solo programa: análisis del bloque del sitio, ajustes, ensayo y aplicación. */
async function importarSoloPrograma(): Promise<void> {
	if (opciones.crear)
		fallar('--programa no se combina con --crear: el contrato y el sitio deben existir.');
	let analisis: ProgramaAnalizado;
	try {
		const hojas = await leerLibro(readFileSync(resolve(archivo!)));
		analisis = analizarProgramaAnual(hojas, {
			claveSitio: claveSitio!,
			anio: opciones.anio ? Number(opciones.anio) : undefined
		});
		analisis = aplicarAjustes(
			analisis,
			analizarAjustes(opciones.periodicidad ?? [], opciones['usar-actividad'] ?? [])
		);
	} catch (error) {
		fallar(`Importación rechazada: ${error instanceof Error ? error.message : String(error)}`);
	}
	const repos = await repositoriosDesdeEntorno(process.env);
	try {
		const contrato = (await repos.catalogo.listarContratos()).find((c) =>
			igual(c.numero, numeroContrato!)
		);
		if (!contrato) fallar(`No existe el contrato ${numeroContrato}.`);
		const sitio = (await repos.catalogo.listarSitios(contrato.id)).find((s) =>
			igual(s.clave, claveSitio!)
		);
		if (!sitio) fallar(`El sitio ${claveSitio} no está asociado al contrato ${contrato.numero}.`);

		let vigencia = { vigenciaInicio: contrato.vigenciaInicio, vigenciaFin: contrato.vigenciaFin };
		if (opciones['ajustar-vigencia']) {
			const [vigenciaInicio = '', vigenciaFin = ''] = opciones['ajustar-vigencia'].split(':');
			vigencia = { vigenciaInicio, vigenciaFin };
			const errores = validarAjusteVigencia(
				vigencia,
				analisis.programa,
				await repos.reportes.listarTodos({ contratoId: contrato.id }),
				await repos.programa.listarProgramas({ contratoId: contrato.id })
			);
			if (errores.length) fallar(`Vigencia rechazada: ${errores.join(' ')}`);
			console.log(
				`Vigencia del contrato: ${contrato.vigenciaInicio} a ${contrato.vigenciaFin} → ${vigencia.vigenciaInicio} a ${vigencia.vigenciaFin}.`
			);
		}
		const carga = cargaDePrograma(analisis, contrato.id, sitio.id, opciones.confirmar);
		const ensayo = await repos.programa.importarPrograma(carga, true);
		let resultado = ensayo;
		if (opciones.aplicar) {
			if (opciones['ajustar-vigencia']) {
				await repos.catalogo.guardarContrato({
					id: contrato.id,
					clienteId: contrato.clienteId,
					numero: contrato.numero,
					descripcion: contrato.descripcion,
					...vigencia
				});
			}
			try {
				resultado = await repos.programa.importarPrograma(carga, false);
			} catch (error) {
				if (opciones['ajustar-vigencia']) {
					console.error(
						`La vigencia ya se guardó como ${vigencia.vigenciaInicio} a ${vigencia.vigenciaFin}; la anterior era ${contrato.vigenciaInicio} a ${contrato.vigenciaFin}.`
					);
				}
				throw error;
			}
		}

		const { crear, actualizar, sinCambios } = resultado.resumen;
		const total = resultado.partidas.reduce((s, p) => s + p.totalProgramado, 0);
		console.log(
			`${resultado.ensayo ? 'Ensayo (no se guardó nada)' : 'Programa importado'} en ${analisis.sitio}: programa ${resultado.programa.accion} de ${analisis.programa.periodoInicio} a ${analisis.programa.periodoFin}; ${crear} por crear, ${actualizar} por actualizar, ${sinCambios} sin cambios; ${total} programados.`
		);
		for (const p of resultado.partidas.filter((x) => x.accion !== 'sin_cambios')) {
			const cambios = [
				p.periodicidadAntes !== p.periodicidad
					? `${p.periodicidadAntes ?? '—'} → ${p.periodicidad}`
					: '',
				p.cantidadAntes !== p.cantidadAnual
					? `cantidad ${p.cantidadAntes ?? '—'} → ${p.cantidadAnual ?? '—'}`
					: '',
				`${p.totalProgramado} en ${p.meses.length} meses`,
				p.realizados.length
					? `realizados ${p.realizados.map((r) => r.mes.slice(0, 7)).join(', ')}`
					: '',
				p.quedaPorConfirmar ? 'por confirmar' : ''
			].filter(Boolean);
			console.log(`  ${p.numero} ${p.accion}: ${p.actividad} (${cambios.join('; ')})`);
		}
		if (resultado.noIncluidas.length) {
			console.log(
				`Partidas del sitio que el libro no trae: ${resultado.noIncluidas.map((p) => p.numero).join(', ')}.`
			);
		}
		const contratoVigente = { ...contrato, ...vigencia };
		for (const a of advertenciasDelEnsayo(analisis, ensayo, contratoVigente)) {
			console.log(`Advertencia: ${a.texto}`);
		}
		if (crear + actualizar === 0 && resultado.programa.accion === 'existente') {
			console.log('No hay cambios respecto a lo registrado.');
		}
		if (!opciones.aplicar) console.log('Para guardar, repita el comando con --aplicar.');
	} finally {
		await repos.cerrar();
	}
}

if (opciones.programa) {
	await importarSoloPrograma();
	process.exit(0);
}

// El libro se analiza antes de tocar la base: un archivo inválido no deja ningún cambio.
let catalogo: Awaited<ReturnType<typeof analizarLibroCatalogo>>;
try {
	catalogo = await analizarLibroCatalogo(readFileSync(resolve(archivo)));
} catch (error) {
	if (error instanceof ErrorImportacion) fallar(`Importación rechazada: ${error.message}`);
	throw error;
}

function informarLibro() {
	for (const advertencia of catalogo.advertencias) console.log(`Advertencia: ${advertencia}`);
	if (catalogo.firmantesPropuestos.length) {
		console.log(
			`La hoja trae ${catalogo.firmantesPropuestos.length} firmante(s); no se importan: regístrelos y confírmelos en /catalogo.`
		);
	}
}

/** Contrato y sitio de destino: crea o asocia lo que falte. Solo se llama con --aplicar. */
async function prepararDestino(repos: Repositorios, existente: Contrato | undefined) {
	let contrato = existente;
	if (!contrato) {
		const [vigenciaInicio, vigenciaFin] = (opciones.vigencia ?? '').split(':');
		const claveCliente = opciones.cliente ?? '';
		const cliente =
			(await repos.catalogo.listarClientes()).find((c) => c.clave === claveCliente) ??
			(await repos.catalogo.guardarCliente({
				clave: claveCliente,
				nombre: opciones['cliente-nombre'] ?? claveCliente,
				razonSocial: opciones['razon-social'] ?? opciones['cliente-nombre'] ?? claveCliente
			}));
		contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: numeroContrato!,
			descripcion: null,
			vigenciaInicio,
			vigenciaFin
		});
		console.log(`Contrato ${contrato.numero} creado para ${cliente.nombre}.`);
	}
	let sitio = (await repos.catalogo.listarSitios(contrato.id)).find((s) =>
		igual(s.clave, claveSitio!)
	);
	if (!sitio) {
		sitio =
			(await repos.catalogo.listarSitios()).find((s) => igual(s.clave, claveSitio!)) ??
			(await repos.catalogo.guardarSitio({
				clave: claveSitio!,
				nombre: opciones['sitio-nombre'] ?? ''
			}));
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		console.log(`Sitio ${sitio.clave} ${sitio.nombre} asociado al contrato.`);
	}
	return { contrato, sitio };
}

const repos = await repositoriosDesdeEntorno(process.env);
try {
	const contrato = (await repos.catalogo.listarContratos()).find((c) =>
		igual(c.numero, numeroContrato!)
	);
	const sitioAsociado = contrato
		? (await repos.catalogo.listarSitios(contrato.id)).find((s) => igual(s.clave, claveSitio!))
		: undefined;
	const sitioExistente =
		sitioAsociado ?? (await repos.catalogo.listarSitios()).find((s) => igual(s.clave, claveSitio!));
	if (!contrato && (!opciones.crear || !opciones.cliente || !opciones.vigencia)) {
		fallar(
			`No existe el contrato ${numeroContrato}. Créelo en /catalogo o use --crear con --cliente y --vigencia.`
		);
	}
	if (!sitioExistente && !opciones.crear) {
		fallar(`No existe el sitio ${claveSitio}. Regístrelo en /catalogo o use --crear.`);
	}

	if (!opciones.aplicar && (!contrato || !sitioAsociado)) {
		// Ensayo sin contrato o sin la asociación del sitio: no hay partidas registradas para ese
		// par, así que todas se crearían. Se informa sin escribir nada.
		if (!contrato) console.log(`Se crearía el contrato ${numeroContrato}.`);
		if (!sitioExistente) console.log(`Se crearía el sitio ${claveSitio}.`);
		console.log(`Se asociaría el sitio ${claveSitio} al contrato.`);
		console.log(
			`Ensayo (no se guardó nada): ${catalogo.partidas.length} por crear, 0 por actualizar, 0 sin cambios. Programa: ${catalogo.programa ? 'crear' : 'ninguno'}.`
		);
	} else {
		const destino =
			contrato && sitioAsociado
				? { contrato, sitio: sitioAsociado }
				: await prepararDestino(repos, contrato);
		const resultado = await repos.catalogo.importarCatalogo(
			{
				contratoId: destino.contrato.id,
				sitioId: destino.sitio.id,
				programa: catalogo.programa,
				partidas: catalogo.partidas
			},
			!opciones.aplicar
		);
		const { crear, actualizar, sinCambios } = resultado.resumen;
		console.log(
			`${resultado.ensayo ? 'Ensayo (no se guardó nada)' : 'Importación aplicada'}: ${crear} por crear, ${actualizar} por actualizar, ${sinCambios} sin cambios. Programa: ${resultado.programa.accion}.`
		);
		if (crear + actualizar === 0) console.log('No hay cambios respecto a lo registrado.');
	}
	informarLibro();
	if (!opciones.aplicar) console.log('Para guardar, repita el comando con --aplicar.');
} finally {
	await repos.cerrar();
}
