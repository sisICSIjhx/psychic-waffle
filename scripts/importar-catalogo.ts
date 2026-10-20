// Importa un «CATALOGO DE ALCANCES.xlsx» en la base configurada (Supabase o PGlite local).
//
// Uso:
//   npm run importar -- <archivo.xlsx> --contrato <número> --sitio <clave> [--aplicar]
// Por omisión hace un ensayo: muestra el resumen sin guardar nada. Con --aplicar guarda todo en una
// transacción. Si el contrato o el sitio no existen, se pueden crear al aplicar con:
//   --cliente <clave> --cliente-nombre <nombre> --razon-social <texto>
//   --vigencia <AAAA-MM-DD>:<AAAA-MM-DD> --sitio-nombre <nombre> --crear
// Los firmantes que trae la hoja no se importan: se listan para registrarlos desde /catalogo.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Contrato } from '../src/lib/dominio/esquemas.ts';
import { repositoriosDesdeEntorno } from '../src/lib/server/datos-entorno.ts';
import { normalizarParaComparar } from '../src/lib/server/documentos/auditoria.ts';
import { analizarLibroCatalogo, ErrorImportacion } from '../src/lib/server/importacion/catalogo.ts';
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
		'sitio-nombre': { type: 'string' }
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
