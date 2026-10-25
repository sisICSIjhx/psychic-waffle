// Corrección del contrato, sus sitios y sus firmantes con ensayo, motivo y bitácora (0018). Solo
// nombres ficticios.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aGuardado } from '../../dominio/captura';
import type { Contrato, Firmante, Reporte, Sitio } from '../../dominio/esquemas';
import { AlmacenamientoLocal } from '../almacenamiento';
import { crearClientePglite, type ClientePglite } from '../bd/pglite';
import { ServicioCaptura } from '../captura';
import { crearRepositorios, type Repositorios } from './index';

const MOTIVO = 'Corrección de un error de captura';

let cliente: ClientePglite;
let repos: Repositorios;
let servicio: ServicioCaptura;
let carpeta: string;
let numeroBase = 0;

beforeAll(async () => {
	cliente = await crearClientePglite();
	repos = crearRepositorios(cliente);
	carpeta = await mkdtemp(join(tmpdir(), 'edicion-'));
	servicio = new ServicioCaptura(repos, new AlmacenamientoLocal(carpeta));
}, 60_000);

afterAll(async () => {
	await repos.cerrar();
	await rm(carpeta, { recursive: true, force: true });
});

interface Base {
	contrato: Contrato;
	sitio: Sitio;
	partidaId: string;
	firmantes: Record<'elaboro' | 'aprobo' | 'recibio', Firmante>;
}

/** Contrato ficticio de marzo de 2026 a febrero de 2027 con un sitio, una partida y tres firmantes. */
async function crearBase(): Promise<Base> {
	const n = ++numeroBase;
	const c = await repos.catalogo.guardarCliente({
		clave: `ficticio-${n}`,
		nombre: `Ficticio ${n}`,
		razonSocial: `CLIENTE FICTICIO ${n}`
	});
	const contrato = await repos.catalogo.guardarContrato(
		{
			clienteId: c.id,
			numero: `OC-FICTICIA-${n}`,
			descripcion: null,
			vigenciaInicio: '2026-03-01',
			vigenciaFin: '2027-02-28'
		},
		{ origen: 'script' }
	);
	const sitio = await repos.catalogo.guardarSitio(
		{ clave: `EM-9${String(n).padStart(4, '0')}`, nombre: 'AREA IV' },
		{ contratoId: contrato.id }
	);
	await repos.catalogo.asociarSitio(contrato.id, sitio.id);
	const partida = await repos.catalogo.guardarPartida({
		contratoId: contrato.id,
		sitioId: sitio.id,
		numero: '07',
		actividad: 'Toma de potenciales',
		periodicidad: 'mensual',
		alcances: [{ tipo: 'alcance', texto: 'Medición' }]
	});
	const firmantes = {} as Base['firmantes'];
	for (const funcion of ['elaboro', 'aprobo', 'recibio'] as const) {
		firmantes[funcion] = await repos.catalogo.guardarFirmante({
			contratoId: contrato.id,
			funcion,
			nombre: `Persona Ficticia ${funcion}`,
			cargo: 'Cargo de prueba',
			empresa: 'Empresa de prueba',
			vigenteDesde: '2026-03-01'
		});
	}
	return { contrato, sitio, partidaId: partida.id, firmantes };
}

const crearReporte = (base: Base, mes = '2026-06-01') =>
	servicio.crearReporte({
		partidaId: base.partidaId,
		periodoMes: mes,
		ocurrencia: null,
		equipoIds: []
	});

/** Reporte con lo que exige la emisión. */
function completo(reporte: Reporte) {
	const guardado = aGuardado(reporte);
	guardado.objetivo = 'Objetivo de prueba';
	guardado.conclusiones = 'Conclusiones de prueba';
	return guardado;
}

async function emitir(reporte: Reporte): Promise<Reporte> {
	const guardado = completo(reporte);
	guardado.diasEjecucion = [{ desde: reporte.periodoMes, hasta: reporte.periodoMes }];
	for (const alcance of guardado.alcances) alcance.estadoVerificacion = 'ok';
	const capturado = await servicio.guardar(guardado);
	const enRevision = await servicio.cambiarEstado(capturado.id, capturado.version, 'en_revision');
	return servicio.cambiarEstado(enRevision.id, enRevision.version, 'emitido');
}

const edicionContrato = (contrato: Contrato, cambios: Partial<Contrato> = {}) => ({
	id: contrato.id,
	actualizadoEn: contrato.actualizadoEn,
	numero: contrato.numero,
	descripcion: contrato.descripcion,
	vigenciaInicio: contrato.vigenciaInicio,
	vigenciaFin: contrato.vigenciaFin,
	...cambios
});

const contar = async (sql: string, ...parametros: unknown[]) =>
	Number((await cliente.bd.query<{ n: number }>(sql, parametros)).rows[0].n);

const cambiosDe = (contratoId: string) =>
	contar(
		'select count(*)::int as n from public.cambios_catalogo where contrato_id = $1',
		contratoId
	);

describe('bitácora del catálogo', () => {
	it('registra las altas con su origen y no admite modificar ni borrar registros', async () => {
		const base = await crearBase();
		const pagina = await repos.catalogo.listarCambios(base.contrato.id);
		expect(pagina.filas.map((f) => [f.entidad, f.accion, f.origen, f.motivo]).reverse()).toEqual([
			['contrato', 'crear', 'script', null],
			['sitio', 'crear', 'interfaz', null],
			['contrato_sitio', 'asociar', 'interfaz', null],
			['firmante', 'crear', 'interfaz', null],
			['firmante', 'crear', 'interfaz', null],
			['firmante', 'crear', 'interfaz', null]
		]);
		expect(pagina.filas[0].usuarioId).toBeNull();
		await expect(
			cliente.bd.query("update public.cambios_catalogo set motivo = 'x'")
		).rejects.toThrow(/no se modifica/);
		await expect(cliente.bd.query('delete from public.cambios_catalogo')).rejects.toThrow(
			/no se modifica/
		);
	});

	it('rechaza una corrección con motivo corto y las altas con id', async () => {
		const base = await crearBase();
		await expect(
			repos.catalogo.editarContrato(edicionContrato(base.contrato, { numero: 'OC-NUEVA' }), {
				ensayo: false,
				motivo: '  error   '
			})
		).rejects.toMatchObject({ tipo: 'invalido', detalle: { motivo: 'motivo_invalido' } });
		const sql = (repos.catalogo as unknown as { sql: ClientePglite }).sql;
		await expect(
			sql.llamar('api_guardar_contrato', { id: base.contrato.id, numero: 'OC-X' })
		).rejects.toMatchObject({ detalle: { motivo: 'usar_edicion' } });
		await expect(
			sql.llamar('api_guardar_firmante', { id: base.firmantes.aprobo.id, nombre: 'Otro' })
		).rejects.toMatchObject({ detalle: { motivo: 'usar_edicion' } });
		expect(
			(await repos.catalogo.listarContratos()).find((k) => k.id === base.contrato.id)?.numero
		).toBe(base.contrato.numero);
	});
});

describe('copia de los datos del contrato en cada reporte', () => {
	it('guarda lo que el reporte recibió y la revisión hereda la copia del original', async () => {
		const base = await crearBase();
		const reporte = await crearReporte(base);
		const copia = (
			await cliente.bd.query<{ c: Record<string, unknown> }>(
				'select contrato_copia as c from public.reportes where id = $1',
				[reporte.id]
			)
		).rows[0].c;
		expect(copia).toEqual({
			usuario: reporte.usuario,
			contrato: reporte.contratoTexto,
			sitio: reporte.sitioTexto,
			firmantes: reporte.firmantes
		});
		const emitido = await emitir(reporte);
		await repos.catalogo.editarSitio(
			{ ...base.sitio, contratoId: base.contrato.id, nombre: 'AREA VI' },
			{ ensayo: false, motivo: MOTIVO }
		);
		// La revisión nace con el encabezado y la copia del original: ve el aviso y puede actualizarse.
		const revision = await servicio.crearRevision(emitido.id);
		expect(revision.sitioTexto).toBe(`${base.sitio.clave} AREA IV`);
		const estado = await repos.reportes.estadoContrato(revision.id);
		expect(estado.datos).toEqual([
			{
				campo: 'sitio',
				reporte: `${base.sitio.clave} AREA IV`,
				contrato: `${base.sitio.clave} AREA VI`
			}
		]);
		const actualizada = await repos.reportes.actualizarContrato(revision.id, revision.version);
		expect(actualizada.sitioTexto).toBe(`${base.sitio.clave} AREA VI`);
		expect(actualizada.version).toBe(revision.version + 1);
		expect((await repos.reportes.estadoContrato(revision.id)).cambiado).toBe(false);
		expect(
			await contar('select count(*)::int as n from public.reportes where contrato_copia is null')
		).toBe(0);
	});
});

describe('corrección del contrato', () => {
	it('el ensayo no escribe y da los mismos conteos que la aplicación; los borradores se actualizan', async () => {
		const base = await crearBase();
		const uno = await crearReporte(base, '2026-05-01');
		const dos = await crearReporte(base, '2026-06-01');
		const emitido = await emitir(await crearReporte(base, '2026-07-01'));
		const antesBitacora = await cambiosDe(base.contrato.id);

		const edicion = edicionContrato(base.contrato, { numero: 'OC-CORREGIDA' });
		const ensayo = await repos.catalogo.editarContrato(edicion, { ensayo: true });
		expect(ensayo.ensayo).toBe(true);
		expect(ensayo.aplicado).toBeUndefined();
		expect(ensayo.cambios).toEqual([
			{ campo: 'numero', antes: base.contrato.numero, despues: 'OC-CORREGIDA' }
		]);
		expect(ensayo.impacto).toMatchObject({
			borradores: 2,
			enRevision: 0,
			emitidos: 1,
			sustituidos: 0
		});
		expect(await cambiosDe(base.contrato.id)).toBe(antesBitacora);
		expect((await servicio.obtener(uno.id)).contratoTexto).toBe(base.contrato.numero);

		const aplicado = await repos.catalogo.editarContrato(edicion, {
			ensayo: false,
			motivo: MOTIVO
		});
		expect(aplicado.impacto).toMatchObject({ borradores: 2, enRevision: 0, emitidos: 1 });
		expect([...aplicado.aplicado!.borradoresActualizados].sort()).toEqual([uno.id, dos.id].sort());
		expect(aplicado.aplicado!.borradoresConAviso).toEqual([]);
		const actualizado = await servicio.obtener(uno.id);
		expect(actualizado.contratoTexto).toBe('OC-CORREGIDA');
		expect(actualizado.version).toBe(uno.version + 1);
		expect((await servicio.obtener(emitido.id)).contratoTexto).toBe(base.contrato.numero);
		const [registro] = (await repos.catalogo.listarCambios(base.contrato.id)).filas;
		expect(registro).toMatchObject({
			entidad: 'contrato',
			accion: 'editar',
			motivo: MOTIVO,
			origen: 'interfaz',
			usuarioId: null
		});

		// La pestaña con la versión anterior ya no puede guardar encima.
		await expect(servicio.guardar(aGuardado(uno))).rejects.toMatchObject({ tipo: 'conflicto' });
		// Otra edición con la versión vista antes se rechaza.
		await expect(repos.catalogo.editarContrato(edicion, { ensayo: true })).rejects.toMatchObject({
			tipo: 'conflicto'
		});
	});

	it('con la casilla desmarcada los borradores conservan el dato y muestran el aviso', async () => {
		const base = await crearBase();
		const borrador = await crearReporte(base);
		const r = await repos.catalogo.editarContrato(
			edicionContrato(base.contrato, { numero: 'OC-SIN-PROPAGAR' }),
			{ ensayo: false, motivo: MOTIVO, actualizarBorradores: false }
		);
		expect(r.aplicado).toMatchObject({
			borradoresActualizados: [],
			borradoresConAviso: [borrador.id]
		});
		expect((await servicio.obtener(borrador.id)).contratoTexto).toBe(base.contrato.numero);
		expect((await repos.reportes.estadoContrato(borrador.id)).datos).toEqual([
			{ campo: 'contrato', reporte: base.contrato.numero, contrato: 'OC-SIN-PROPAGAR' }
		]);
	});

	it('rechaza el cliente, el número repetido, la falta de cambios y la vigencia que deja datos fuera', async () => {
		const base = await crearBase();
		const otro = await crearBase();
		const sql = (repos.catalogo as unknown as { sql: ClientePglite }).sql;
		await expect(
			sql.llamar('api_editar_contrato', {
				...edicionContrato(base.contrato),
				clienteId: otro.contrato.clienteId
			})
		).rejects.toMatchObject({ detalle: { motivo: 'cliente_fijo' } });
		await expect(
			repos.catalogo.editarContrato(edicionContrato(base.contrato), { ensayo: true })
		).rejects.toMatchObject({ detalle: { motivo: 'sin_cambios' } });

		const hermano = await repos.catalogo.guardarContrato({
			clienteId: base.contrato.clienteId,
			numero: 'OC-HERMANA',
			descripcion: null,
			vigenciaInicio: '2026-03-01',
			vigenciaFin: '2027-02-28'
		});
		await expect(
			repos.catalogo.editarContrato(edicionContrato(base.contrato, { numero: 'OC-HERMANA' }), {
				ensayo: true
			})
		).rejects.toMatchObject({
			detalle: { motivo: 'contrato_duplicado', existente: { id: hermano.id } }
		});

		// Programa de marzo de 2026 a febrero de 2027: la vigencia de mayo a abril deja fuera marzo y abril.
		const programa = await repos.programa.guardarPrograma({
			contratoId: base.contrato.id,
			sitioId: base.sitio.id,
			periodoInicio: '2026-03-01',
			periodoFin: '2027-02-28'
		});
		await repos.programa.guardarMeses(programa.id, [
			{ partidaId: base.partidaId, mes: '2026-04-01', cantidad: 1 }
		]);
		await expect(
			repos.catalogo.editarContrato(
				edicionContrato(base.contrato, { vigenciaInicio: '2026-05-01', vigenciaFin: '2027-04-30' }),
				{ ensayo: true }
			)
		).rejects.toMatchObject({
			detalle: {
				motivo: 'vigencia_con_datos_fuera',
				fuera: [
					{ tipo: 'meses', sitio: base.sitio.clave, meses: ['2026-04-01'] },
					{ tipo: 'programa', sitio: base.sitio.clave, meses: ['2026-03-01', '2026-04-01'] }
				]
			}
		});
		// Ampliar el fin sí se puede.
		const ampliado = await repos.catalogo.editarContrato(
			edicionContrato(base.contrato, { vigenciaFin: '2027-04-30' }),
			{ ensayo: false, motivo: MOTIVO }
		);
		expect(ampliado.contrato.vigenciaFin).toBe('2027-04-30');
	});
});

describe('sitios del contrato', () => {
	it('corrige el sitio en todos los contratos que lo comparten y lo registra en ambos historiales', async () => {
		const base = await crearBase();
		const otro = await crearBase();
		await repos.catalogo.asociarSitio(otro.contrato.id, base.sitio.id);
		const partidaOtro = await repos.catalogo.guardarPartida({
			contratoId: otro.contrato.id,
			sitioId: base.sitio.id,
			numero: '08',
			actividad: 'Limpieza',
			periodicidad: 'mensual',
			alcances: [{ tipo: 'alcance', texto: 'Limpieza' }]
		});
		const propio = await crearReporte(base);
		const ajeno = await servicio.crearReporte({
			partidaId: partidaOtro.id,
			periodoMes: '2026-06-01',
			ocurrencia: null,
			equipoIds: []
		});

		const edicion = { ...base.sitio, contratoId: base.contrato.id, nombre: 'AREA VI' };
		const ensayo = await repos.catalogo.editarSitio(edicion, { ensayo: true });
		expect(ensayo.impacto.otrosContratos).toEqual([
			{ id: otro.contrato.id, numero: otro.contrato.numero }
		]);
		expect(ensayo.impacto.borradores).toBe(2);
		await repos.catalogo.editarSitio(edicion, { ensayo: false, motivo: MOTIVO });
		for (const id of [propio.id, ajeno.id]) {
			expect((await servicio.obtener(id)).sitioTexto).toBe(`${base.sitio.clave} AREA VI`);
		}
		for (const contrato of [base.contrato, otro.contrato]) {
			const [registro] = (await repos.catalogo.listarCambios(contrato.id)).filas;
			expect(registro).toMatchObject({
				entidad: 'sitio',
				cambios: [{ campo: 'nombre', antes: 'AREA IV', despues: 'AREA VI' }]
			});
		}
	});

	it('rechaza un sitio ajeno o con clave repetida, y quita solo sitios sin datos', async () => {
		const base = await crearBase();
		const otro = await crearBase();
		await expect(
			repos.catalogo.editarSitio(
				{ ...otro.sitio, contratoId: base.contrato.id, nombre: 'X' },
				{ ensayo: true }
			)
		).rejects.toMatchObject({ detalle: { motivo: 'sitio_ajeno' } });
		await expect(
			repos.catalogo.editarSitio(
				{ ...base.sitio, contratoId: base.contrato.id, clave: otro.sitio.clave.toLowerCase() },
				{ ensayo: true }
			)
		).rejects.toMatchObject({
			detalle: { motivo: 'sitio_duplicado', existente: { id: otro.sitio.id } }
		});

		await expect(
			repos.catalogo.quitarSitio(
				{ contratoId: base.contrato.id, sitioId: base.sitio.id },
				{ ensayo: true }
			)
		).rejects.toMatchObject({
			detalle: { motivo: 'sitio_con_datos', partidas: 1, programas: 0, reportes: 0 }
		});
		const vacio = await repos.catalogo.guardarSitio({
			clave: `EM-V${numeroBase}`,
			nombre: 'POR ERROR'
		});
		await repos.catalogo.asociarSitio(base.contrato.id, vacio.id);
		const resumen = await repos.catalogo.resumenSitios(base.contrato.id);
		expect(resumen.find((s) => s.sitioId === vacio.id)).toMatchObject({ partidas: 0, reportes: 0 });
		await repos.catalogo.quitarSitio(
			{ contratoId: base.contrato.id, sitioId: vacio.id },
			{ ensayo: false, motivo: MOTIVO }
		);
		expect((await repos.catalogo.listarSitios(base.contrato.id)).map((s) => s.id)).not.toContain(
			vacio.id
		);
		expect((await repos.catalogo.listarSitios()).map((s) => s.id)).toContain(vacio.id);
		expect((await repos.catalogo.listarCambios(base.contrato.id)).filas[0]).toMatchObject({
			entidad: 'contrato_sitio',
			accion: 'quitar',
			motivo: MOTIVO
		});
	});
});

describe('firmantes', () => {
	it('corrige datos, rechaza traslapes y conserva una firma escrita a mano', async () => {
		const base = await crearBase();
		const borrador = await crearReporte(base);
		const aMano = aGuardado(borrador);
		aMano.firmantes = {
			...aMano.firmantes,
			aprobo: { nombre: 'Firma Ficticia Escrita', cargo: 'Otro cargo', empresa: 'Otra' }
		};
		const guardado = await servicio.guardar(aMano);
		const aprobo = base.firmantes.aprobo;

		const r = await repos.catalogo.corregirFirmante(
			{ ...aprobo, cargo: 'Cargo corregido' },
			{ ensayo: false, motivo: MOTIVO }
		);
		expect(r.cambios).toEqual([
			{ campo: 'cargo', antes: 'Cargo de prueba', despues: 'Cargo corregido' }
		]);
		expect(r.aplicado?.borradoresConAviso).toEqual([borrador.id]);
		const actual = await servicio.obtener(borrador.id);
		expect(actual.firmantes.aprobo?.nombre).toBe('Firma Ficticia Escrita');
		expect(actual.version).toBe(guardado.version);

		// «Actualizar datos del contrato» lleva también lo escrito a mano.
		const forzado = await repos.reportes.actualizarContrato(actual.id, actual.version);
		expect(forzado.firmantes.aprobo).toEqual({
			nombre: aprobo.nombre,
			cargo: 'Cargo corregido',
			empresa: aprobo.empresa
		});
		await expect(
			repos.reportes.actualizarContrato(actual.id, actual.version)
		).rejects.toMatchObject({
			tipo: 'conflicto'
		});

		// Un segundo firmante de Aprobó que empiece dentro de la vigencia del primero se traslapa.
		const cerrado = await repos.catalogo.corregirFirmante(
			{ ...r.firmante, vigenteHasta: '2026-12-31' },
			{ ensayo: false, motivo: MOTIVO }
		);
		const segundo = await repos.catalogo.guardarFirmante({
			contratoId: base.contrato.id,
			funcion: 'aprobo',
			nombre: 'Persona Ficticia Dos',
			cargo: '',
			empresa: '',
			vigenteDesde: '2027-01-01'
		});
		await expect(
			repos.catalogo.corregirFirmante({ ...segundo, vigenteDesde: '2026-12-15' }, { ensayo: true })
		).rejects.toMatchObject({
			detalle: { motivo: 'firmante_traslapado', firmanteId: cerrado.firmante.id }
		});
	});

	it('cambia el firmante desde una fecha: cierra al anterior, hereda el fin y avisa el primer mes', async () => {
		const base = await crearBase();
		const recibio = base.firmantes.recibio;
		await expect(
			repos.catalogo.cambiarFirmante(
				{ ...recibio, desde: '2026-03-01', nombre: 'Persona Ficticia Nueva' },
				{ ensayo: true }
			)
		).rejects.toMatchObject({
			detalle: { motivo: 'fecha_cambio_invalida', primeraFecha: '2026-03-02' }
		});

		const mitad = await repos.catalogo.cambiarFirmante(
			{ ...recibio, desde: '2026-11-15', nombre: 'Persona Ficticia Nueva' },
			{ ensayo: true }
		);
		expect(mitad.impacto.desdeMes).toBe('2026-12-01');

		const r = await repos.catalogo.cambiarFirmante(
			{
				...recibio,
				desde: '2026-11-01',
				nombre: 'Persona Ficticia Nueva',
				cargo: 'Cargo',
				empresa: ''
			},
			{ ensayo: false, motivo: MOTIVO }
		);
		expect(r.impacto.desdeMes).toBe('2026-11-01');
		expect(r.firmante).toMatchObject({ vigenteDesde: '2026-11-01', vigenteHasta: null });
		const todos = await repos.catalogo.listarFirmantes(base.contrato.id);
		expect(todos.find((f) => f.id === recibio.id)?.vigenteHasta).toBe('2026-10-31');
		expect(
			(await repos.catalogo.firmantesVigentes(base.contrato.id, '2026-10-01')).recibio?.id
		).toBe(recibio.id);
		expect(
			(await repos.catalogo.firmantesVigentes(base.contrato.id, '2026-11-01')).recibio?.id
		).toBe(r.firmante.id);
		const [registro] = (await repos.catalogo.listarCambios(base.contrato.id)).filas;
		expect(registro).toMatchObject({ entidad: 'firmante', accion: 'reemplazar' });
		expect(registro.efectos.firmanteAnterior).toBe(recibio.id);
	});
});

describe('historial y estado del contrato en el reporte', () => {
	it('pagina de 20 en 20 del más reciente al más antiguo', async () => {
		const base = await crearBase();
		let contrato = base.contrato;
		for (let i = 1; i <= 16; i++) {
			const r = await repos.catalogo.editarContrato(
				edicionContrato(contrato, { descripcion: `Descripción ${i}` }),
				{ ensayo: false, motivo: MOTIVO }
			);
			contrato = r.contrato;
		}
		const primera = await repos.catalogo.listarCambios(base.contrato.id);
		expect(primera.total).toBe(22);
		expect(primera.filas).toHaveLength(20);
		expect(primera.filas[0].cambios[0].despues).toBe('Descripción 16');
		const segunda = await repos.catalogo.listarCambios(base.contrato.id, 2);
		expect(segunda.filas.map((f) => f.accion)).toEqual(['crear', 'crear']);
	});

	it('en revisión informa los datos cambiados pero no se actualiza', async () => {
		const base = await crearBase();
		const reporte = await crearReporte(base);
		const guardado = completo(reporte);
		guardado.diasEjecucion = [{ desde: '2026-06-01', hasta: '2026-06-01' }];
		for (const alcance of guardado.alcances) alcance.estadoVerificacion = 'ok';
		const capturado = await servicio.guardar(guardado);
		const enRevision = await servicio.cambiarEstado(capturado.id, capturado.version, 'en_revision');
		const r = await repos.catalogo.editarContrato(
			edicionContrato(base.contrato, { numero: 'OC-EN-REVISION' }),
			{ ensayo: false, motivo: MOTIVO }
		);
		expect(r.impacto).toMatchObject({ borradores: 0, enRevision: 1 });
		expect((await repos.reportes.estadoContrato(enRevision.id)).cambiado).toBe(true);
		await expect(
			repos.reportes.actualizarContrato(enRevision.id, enRevision.version)
		).rejects.toMatchObject({ tipo: 'conflicto' });
	});
});
