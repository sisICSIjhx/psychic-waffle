// Importa un «CATALOGO DE ALCANCES.xlsx» en la base configurada (Supabase o PGlite local).
//
// Uso:
//   npm run importar -- <archivo.xlsx> --contrato <número> --sitio <clave> [--aplicar]
// Por omisión hace un ensayo: muestra el resumen sin guardar. Con --aplicar guarda todo en una
// transacción. Si el contrato o el sitio no existen, se pueden crear con:
//   --cliente <clave> --cliente-nombre <nombre> --razon-social <texto>
//   --vigencia <AAAA-MM-DD>:<AAAA-MM-DD> --sitio-nombre <nombre> --crear
// Los firmantes que trae la hoja no se importan: se listan para registrarlos desde /catalogo.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { repositoriosDesdeEntorno } from '../src/lib/server/datos-entorno.ts';
import { analizarLibroCatalogo, ErrorImportacion } from '../src/lib/server/importacion/catalogo.ts';
import { normalizarParaComparar } from '../src/lib/server/documentos/auditoria.ts';

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
if (!archivo || !opciones.contrato || !opciones.sitio) {
	fallar('Uso: npm run importar -- <archivo.xlsx> --contrato <número> --sitio <clave> [--aplicar]');
}

const igual = (a: string, b: string) => normalizarParaComparar(a) === normalizarParaComparar(b);

const repos = await repositoriosDesdeEntorno(process.env);
try {
	let contrato = (await repos.catalogo.listarContratos()).find((c) =>
		igual(c.numero, opciones.contrato!)
	);
	if (!contrato) {
		if (!opciones.crear || !opciones.cliente || !opciones.vigencia) {
			fallar(
				`No existe el contrato ${opciones.contrato}. Créelo en /catalogo o use --crear con --cliente y --vigencia.`
			);
		}
		const [vigenciaInicio, vigenciaFin] = opciones.vigencia.split(':');
		const cliente =
			(await repos.catalogo.listarClientes()).find((c) => c.clave === opciones.cliente) ??
			(await repos.catalogo.guardarCliente({
				clave: opciones.cliente,
				nombre: opciones['cliente-nombre'] ?? opciones.cliente,
				razonSocial: opciones['razon-social'] ?? opciones['cliente-nombre'] ?? opciones.cliente
			}));
		contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: opciones.contrato!,
			descripcion: null,
			vigenciaInicio,
			vigenciaFin
		});
		console.log(`Contrato ${contrato.numero} creado para ${cliente.nombre}.`);
	}

	let sitio = (await repos.catalogo.listarSitios(contrato.id)).find((s) =>
		igual(s.clave, opciones.sitio!)
	);
	if (!sitio) {
		const existente = (await repos.catalogo.listarSitios()).find((s) =>
			igual(s.clave, opciones.sitio!)
		);
		if (!existente && !opciones.crear) {
			fallar(
				`El sitio ${opciones.sitio} no está asociado al contrato. Asócielo en /catalogo o use --crear.`
			);
		}
		sitio =
			existente ??
			(await repos.catalogo.guardarSitio({
				clave: opciones.sitio!,
				nombre: opciones['sitio-nombre'] ?? ''
			}));
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		console.log(`Sitio ${sitio.clave} ${sitio.nombre} asociado al contrato.`);
	}

	const catalogo = await analizarLibroCatalogo(readFileSync(resolve(archivo)));
	const resultado = await repos.catalogo.importarCatalogo(
		{
			contratoId: contrato.id,
			sitioId: sitio.id,
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
	for (const advertencia of catalogo.advertencias) console.log(`Advertencia: ${advertencia}`);
	if (catalogo.firmantesPropuestos.length) {
		console.log(
			`La hoja trae ${catalogo.firmantesPropuestos.length} firmante(s); no se importan: regístrelos y confírmelos en /catalogo.`
		);
	}
	if (resultado.ensayo) console.log('Para guardar, repita el comando con --aplicar.');
} catch (error) {
	if (error instanceof ErrorImportacion) fallar(`Importación rechazada: ${error.message}`);
	throw error;
} finally {
	await repos.cerrar();
}
