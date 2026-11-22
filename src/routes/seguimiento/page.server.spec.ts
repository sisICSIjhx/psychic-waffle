// Carga y guardado del seguimiento sobre PGlite: qué ve cada rol, alcance por centro de costo, el
// ancla que devuelve cada acción y los mensajes en palabras de quien captura. Solo datos ficticios.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { anclaDePartida } from '$lib/components/seguimiento/captura';
import type { RolPersonal } from '$lib/dominio/esquemas';
import { crearClientePglite } from '$lib/server/bd/pglite';
import { crearRepositorios, type Repositorios } from '$lib/server/repositorios/index';
import type { PageServerData } from './$types';

let repos: Repositorios;
vi.mock('$lib/server/datos', () => ({ datos: async () => repos }));

const { load, actions } = await import('./+page.server');

const MES = '2026-11';
const ENLACE = 'https://ejemplo.sharepoint.com/sites/prueba/acuse';
let centro: string;
let otro: string;
let ajeno: string;
let plantillaId: string;
let odt: string;
let reporte: string;
let carpeta: string;
let persona: string;

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	const plantilla = await repos.centrosCosto.guardarPlantilla({
		nombre: 'ruta-seguimiento',
		modoContrato: 'opcional',
		origenActividades: 'mensual',
		conceptos: [
			{ etiqueta: 'ODT', bloque: 'documentos', tipo: 'casilla' },
			{ etiqueta: 'Reporte', bloque: 'documentos', tipo: 'casilla', nivel: 'partida' },
			{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto' },
			{ etiqueta: 'Seguridad', bloque: 'carpetas', tipo: 'carpeta' }
		]
	});
	plantillaId = plantilla.id;
	const concepto = (etiqueta: string) =>
		plantilla.conceptos.find((c) => c.etiqueta === etiqueta)!.id;
	odt = concepto('ODT');
	reporte = concepto('Reporte');
	carpeta = concepto('Seguridad');
	const alta = (clave: string) => repos.centrosCosto.guardar({ clave, nombre: clave, plantillaId });
	centro = (await alta('ruta-seguimiento-1')).id;
	otro = (await alta('ruta-seguimiento-2')).id;
	ajeno = (await alta('ruta-seguimiento-3')).id;
	persona = (
		await repos.personal.guardar({
			nombre: 'Persona',
			apellidoPaterno: 'Ficticia',
			apellidoMaterno: null,
			fechaNacimiento: null,
			correo: null,
			rol: 'reporteador',
			activo: true,
			centroCostoIds: []
		})
	).id;
}, 60_000);
afterAll(() => repos.cerrar());

function evento(
	rol: RolPersonal | null,
	{
		id = centro as string | null,
		centros = null as string[] | null,
		campos = null as Record<string, string | string[]> | null
	} = {}
) {
	const url = new URL(`http://localhost/seguimiento?mes=${MES}${id ? `&centro=${id}` : ''}`);
	const cuerpo = new FormData();
	for (const [nombre, valor] of Object.entries(campos ?? {})) {
		for (const uno of [valor].flat()) cuerpo.append(nombre, uno);
	}
	return {
		locals: rol
			? {
					autenticacion: true,
					usuario: { id: persona, nombre: 'Ficticio', rol, centrosCosto: centros }
				}
			: { autenticacion: false, usuario: null },
		url,
		request: new Request(url, { method: 'POST', body: cuerpo })
	} as never;
}

// `load` está anotada como PageServerLoad, que no conserva la forma de lo que devuelve.
type Carga = PageServerData;
const cargar = async (...args: Parameters<typeof evento>) => (await load(evento(...args))) as Carga;
const guardar = (campos: Record<string, string | string[]>, rol: RolPersonal = 'reporteador') =>
	actions.guardar(evento(rol, { centros: [centro, otro], campos: { plantillaId, ...campos } }));

describe('/seguimiento', () => {
	it('sin centro en la dirección abre el único o lista «Mis centros de costo» con su estatus', async () => {
		const uno = await cargar('reporteador', { id: null, centros: [centro] });
		expect(uno.centro?.id).toBe(centro);
		expect(uno.seguimiento).not.toBeNull();
		expect(uno.misCentros).toBeNull();

		const varios = await cargar('reporteador', { id: null, centros: [centro, otro] });
		expect(varios.centro).toBeNull();
		expect(varios.seguimiento).toBeNull();
		expect(varios.misCentros?.map((c) => c.centro.id).sort()).toEqual([centro, otro].sort());
		expect(varios.misCentros?.[0]).toMatchObject({
			estatus: expect.any(String),
			kpis: expect.any(Array),
			falta: expect.any(Array),
			emergencias: 0
		});
		expect(varios.cuentas?.reduce((suma, c) => suma + c.cantidad, 0)).toBe(2);

		const ninguno = await cargar('reporteador', { id: null, centros: [] });
		expect(ninguno).toMatchObject({ centros: [], centro: null, misCentros: [] });
	});

	it('lo financiero solo viaja con el permiso de ver el contrato', async () => {
		const operativo = await cargar('reporteador', { centros: [centro] });
		expect(operativo).toMatchObject({ puedeEditar: true, verCobranza: false });
		const claves = operativo.estatus?.kpis.map((k) => k.clave) ?? [];
		expect(claves).not.toContain('cobranza');
		expect(claves).not.toContain('contrato');
		expect(operativo.estatus?.falta.every((f) => f.destino === 'seguimiento')).toBe(true);
		// Para proponer «Quién entrega» y registrar asistentes.
		expect(operativo.personaSesion).toBe(persona);
		expect(operativo.seguimiento?.personal.length).toBeGreaterThan(0);

		const direccion = await cargar('mesa_directiva');
		expect(direccion).toMatchObject({ puedeEditar: false, verCobranza: true, personaSesion: null });
		expect(direccion.estatus?.kpis.map((k) => k.clave)).toContain('cobranza');
		// Solo consulta: sin directorio de personal ni identificadores para dar de alta.
		expect(direccion.seguimiento?.personal).toEqual([]);
		expect(direccion).toMatchObject({ idActividad: '', idNocturna: '' });
	});

	it('responde 404 a un centro de costo ajeno y 403 a quien solo consulta', async () => {
		await expect(cargar('reporteador', { id: ajeno, centros: [centro] })).rejects.toMatchObject({
			status: 404
		});
		await expect(
			actions.guardar(
				evento('reporteador', {
					id: ajeno,
					centros: [centro],
					campos: { accion: 'marcarMes', plantillaId }
				})
			)
		).rejects.toMatchObject({ status: 404 });
		expect(
			await guardar({ accion: 'marcarMes', ancla: 'actividades' }, 'mesa_directiva')
		).toMatchObject({
			status: 403,
			data: { error: 'No tiene permiso para editar el seguimiento.' }
		});
	});

	it('agrega una partida escrita a mano y devuelve el ancla de su tarjeta', async () => {
		const id = randomUUID();
		const nueva = {
			accion: 'nuevaActividad',
			ancla: 'nueva-partida',
			id,
			nombre: 'Poda',
			veces: '2'
		};
		expect(await guardar({ ...nueva, nombre: ' ' })).toMatchObject({
			status: 400,
			data: { error: 'Escriba el nombre de la partida.', ancla: 'nueva-partida' }
		});
		expect(await guardar({ ...nueva, veces: '40' })).toMatchObject({
			status: 400,
			data: { error: 'Las veces en el mes van de 1 a 31.', accion: 'nuevaActividad' }
		});
		expect(await guardar(nueva)).toEqual({
			mensaje: 'Partida agregada. Ya puede marcarla.',
			ancla: anclaDePartida(`m:${id}`),
			accion: 'nuevaActividad'
		});
		const { seguimiento } = await cargar('reporteador', { centros: [centro] });
		expect(seguimiento?.actividades).toMatchObject([
			{ clave: `m:${id}:1`, grupo: `m:${id}`, partida: 'Poda', manual: true },
			{ clave: `m:${id}:2`, grupo: `m:${id}` }
		]);
	});

	it('el formulario de una ejecución marca según el botón pulsado', async () => {
		const id = randomUUID();
		await guardar({ accion: 'nuevaActividad', id, nombre: 'Inspección' });
		const actividad = `m:${id}`;
		const ancla = `${anclaDePartida(actividad)}-e1`;
		const leer = async () => {
			const { seguimiento } = await cargar('reporteador', { centros: [centro] });
			return {
				ejecutada: seguimiento?.actividades.find((a) => a.clave === actividad)?.ejecutada,
				valores: seguimiento?.valores
					.filter((v) => v.actividad === actividad && v.valor === true)
					.map((v) => v.conceptoId)
					.sort()
			};
		};

		expect(await guardar({ ancla, actividad, marca: 'ejecucion:true' })).toEqual({
			mensaje: 'Guardado.',
			ancla,
			accion: ''
		});
		expect(await leer()).toEqual({ ejecutada: true, valores: [] });
		await guardar({ ancla, actividad, marca: `${odt}:true` });
		expect(await leer()).toEqual({ ejecutada: true, valores: [odt] });
		await guardar({ ancla, actividad, marca: `${odt}:false` });
		await guardar({ ancla, actividad, marca: 'ejecucion:false' });
		expect(await leer()).toEqual({ ejecutada: false, valores: [] });
		// «Marcar todo hecho»: la ejecución, sus documentos y los de la partida.
		await guardar({ ancla, actividad, marca: 'fila' });
		expect(await leer()).toEqual({ ejecutada: true, valores: [odt, reporte].sort() });
	});

	it('registra una atención de emergencia con horario y asistentes, solo en el mes consultado', async () => {
		const atencion = {
			accion: 'nuevaNocturna',
			ancla: 'emergencias',
			id: randomUUID(),
			fecha: `${MES}-12`,
			horaInicio: '22:30',
			horaFin: '01:15',
			asistentes: [persona]
		};
		expect(await guardar({ ...atencion, fecha: '' })).toMatchObject({
			status: 400,
			data: { error: 'Escriba la fecha de la atención.', accion: 'nuevaNocturna' }
		});
		expect(await guardar({ ...atencion, fecha: '2026-10-31' })).toMatchObject({
			status: 400,
			data: {
				error: 'La fecha debe ser de noviembre 2026. Para otro mes, cambie el mes arriba.',
				ancla: 'emergencias'
			}
		});
		expect(await guardar(atencion)).toMatchObject({ mensaje: 'Atención registrada.' });
		const { seguimiento, estatus } = await cargar('reporteador', { centros: [centro] });
		expect(seguimiento?.nocturnas).toMatchObject([
			{ fecha: `${MES}-12`, horaInicio: '22:30', horaFin: '01:15', descripcion: null }
		]);
		expect(seguimiento?.nocturnas[0].asistentes.map((a) => a.id)).toEqual([persona]);
		expect(estatus?.emergencias).toBe(1);
	});

	it('lleva la carpeta de entregada a recibida con comentarios, de nuevo entregada y recibida con acuse', async () => {
		const ancla = `carpeta-${carpeta}`;
		const paso = async (estado: string, campos: Record<string, string>) => {
			const actual = (await cargar('reporteador', { centros: [centro] })).seguimiento?.carpetas[0];
			return guardar({
				accion: 'carpeta',
				ancla,
				conceptoId: carpeta,
				version: String(actual?.version ?? 0),
				estado,
				...campos
			});
		};
		const leer = async () =>
			(await cargar('reporteador', { centros: [centro] })).seguimiento?.carpetas[0];

		expect(await paso('entregada', { entregaId: '', fecha: `${MES}-10` })).toMatchObject({
			status: 400,
			data: { error: 'Seleccione quién entrega la carpeta.', ancla }
		});
		expect(await paso('entregada', { entregaId: persona, fecha: `${MES}-10` })).toMatchObject({
			mensaje: 'Carpeta entregada.',
			ancla
		});
		expect(
			await paso('recibida_comentarios', {
				recibe: 'Cliente Ficticio',
				fechaRecepcion: `${MES}-11`,
				comentarios: ''
			})
		).toMatchObject({ status: 400, data: { error: 'Escriba los comentarios de quien recibió.' } });
		expect(
			await paso('recibida_comentarios', {
				recibe: 'Cliente Ficticio',
				fechaRecepcion: `${MES}-11`,
				comentarios: 'Falta una firma'
			})
		).toMatchObject({
			mensaje: 'Recepción con comentarios guardada. Falta corregir y entregar de nuevo.'
		});
		// Entregar de nuevo conserva los comentarios hasta que quede recibida correctamente.
		await paso('entregada', { entregaId: persona, fecha: `${MES}-12` });
		expect(await leer()).toMatchObject({ estado: 'entregada', comentarios: 'Falta una firma' });

		const recepcion = { recibe: 'Cliente Ficticio', fechaRecepcion: `${MES}-13` };
		expect(await paso('recibida', { ...recepcion, acuseEnlace: '' })).toMatchObject({
			status: 400,
			data: {
				error: 'Para cerrar la carpeta, agregue el acuse de recibido: un enlace o un archivo.'
			}
		});
		expect(
			await paso('recibida', { ...recepcion, acuseEnlace: 'http://otro.example/x' })
		).toMatchObject({
			status: 400,
			data: {
				error: 'El enlace debe ser de SharePoint y empezar con https://. Cópielo desde la carpeta.'
			}
		});
		expect(await paso('recibida', { ...recepcion, acuseEnlace: ENLACE })).toMatchObject({
			mensaje: 'Carpeta recibida correctamente.'
		});
		expect(await leer()).toMatchObject({
			estado: 'recibida',
			acuseEnlace: ENLACE,
			comentarios: null,
			recibe: 'Cliente Ficticio'
		});
	});
});
