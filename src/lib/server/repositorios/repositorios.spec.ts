import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Reporte, ReporteGuardado } from '../../dominio/esquemas';
import { ErrorDatos, validarFuncion } from '../bd/cliente';
import { crearClientePglite, type ClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from './index';

interface Base {
	contratoId: string;
	sitioId: string;
	partidaId: string;
	programaId: string;
}

async function crearBase(repos: Repositorios, sufijo: string): Promise<Base> {
	const cliente = await repos.catalogo.guardarCliente({
		clave: `cliente-${sufijo}`,
		nombre: `Cliente ${sufijo}`,
		razonSocial: `CLIENTE ${sufijo.toUpperCase()} S.A. DE C.V.`
	});
	const contrato = await repos.catalogo.guardarContrato({
		clienteId: cliente.id,
		numero: `OC-${sufijo}`,
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30'
	});
	const sitio = await repos.catalogo.guardarSitio({
		clave: `EM-${sufijo}`,
		nombre: 'SITIO DE PRUEBA'
	});
	await repos.catalogo.asociarSitio(contrato.id, sitio.id);
	const partida = await repos.catalogo.guardarPartida({
		contratoId: contrato.id,
		sitioId: sitio.id,
		numero: '07',
		actividad: 'Toma de potenciales tubo-suelo',
		periodicidad: 'mensual',
		cantidadAnual: 12,
		alcances: [{ tipo: 'alcance', texto: 'Medición de potenciales' }]
	});
	const programa = await repos.programa.guardarPrograma({
		contratoId: contrato.id,
		sitioId: sitio.id,
		periodoInicio: '2026-05-01',
		periodoFin: '2027-04-30'
	});
	return {
		contratoId: contrato.id,
		sitioId: sitio.id,
		partidaId: partida.id,
		programaId: programa.id
	};
}

async function nuevoReporte(
	repos: Repositorios,
	base: Base,
	cambios: {
		periodoMes?: string;
		ocurrencia?: { tipo: 'semana'; numero: number } | null;
		equipoIds?: string[];
	} = {}
): Promise<Reporte> {
	return repos.reportes.insertar({
		partidaId: base.partidaId,
		periodoMes: cambios.periodoMes ?? '2026-05-01',
		ocurrencia: cambios.ocurrencia ?? null,
		titulo: '07.- TOMA DE POTENCIALES TUBO-SUELO. MAYO 2026',
		usuario: 'CLIENTE',
		contratoTexto: 'OC',
		sitioTexto: 'EM SITIO',
		periodicidad: 'Mensual',
		tipoMantenimiento: 'Preventivo',
		actividad: 'Toma de potenciales tubo-suelo',
		numeroPartida: '07',
		objetivo: 'Objetivo',
		introduccion: '',
		conclusiones: 'Sin anomalías',
		disposicionFotos: 'cuadricula',
		incluyeVerificacion: false,
		firmantes: {},
		alcances: [
			{ titulo: 'Inspección visual', descripcion: 'Revisión' },
			{ titulo: 'Medición', descripcion: 'Lecturas' }
		],
		herramientas: [{ cantidad: '1 unidad', descripcion: 'Multímetro' }],
		equipoIds: cambios.equipoIds ?? []
	});
}

function aGuardado(reporte: Reporte, cambios: Partial<ReporteGuardado> = {}): ReporteGuardado {
	return {
		id: reporte.id,
		version: reporte.version,
		fechaEjecucion: reporte.fechaEjecucion,
		titulo: reporte.titulo,
		tipoMantenimiento: reporte.tipoMantenimiento,
		objetivo: reporte.objetivo,
		introduccion: reporte.introduccion,
		conclusiones: reporte.conclusiones,
		incluyeVerificacion: reporte.incluyeVerificacion,
		firmantes: reporte.firmantes,
		alcances: reporte.alcances.map((a) => ({
			id: a.id,
			titulo: a.titulo,
			descripcion: a.descripcion,
			estadoVerificacion: a.estadoVerificacion,
			observaciones: a.observaciones,
			fotos: a.fotos.map((f) => ({ id: f.id, descripcion: f.descripcion, momento: f.momento }))
		})),
		herramientas: reporte.herramientas.map((h) => ({
			cantidad: h.cantidad,
			descripcion: h.descripcion
		})),
		equipoIds: reporte.equipos.map((e) => e.id),
		...cambios
	};
}

/** Lleva un borrador hasta «emitido» con una fecha de ejecución dentro de su mes. */
async function emitir(
	repos: Repositorios,
	reporte: Reporte,
	fecha = reporte.periodoMes.replace(/01$/, '15')
) {
	const { reporte: guardado } = await repos.reportes.guardar(
		aGuardado(reporte, { fechaEjecucion: fecha })
	);
	const enRevision = await repos.reportes.cambiarEstado(
		guardado.id,
		guardado.version,
		'en_revision'
	);
	return repos.reportes.cambiarEstado(enRevision.id, enRevision.version, 'emitido');
}

async function esperarError(promesa: Promise<unknown>): Promise<ErrorDatos> {
	try {
		await promesa;
	} catch (error) {
		expect(error).toBeInstanceOf(ErrorDatos);
		return error as ErrorDatos;
	}
	throw new Error('Se esperaba un error');
}

let cliente: ClientePglite;
let repos: Repositorios;

beforeAll(async () => {
	cliente = await crearClientePglite();
	repos = crearRepositorios(cliente);
}, 60_000);

afterAll(async () => {
	await repos.cerrar();
});

describe('catálogo', () => {
	it('rechaza un sitio duplicado escrito de otra forma e indica el existente', async () => {
		await repos.catalogo.guardarSitio({ clave: 'EM-30185', nombre: 'ÁREA VI' });
		const error = await esperarError(
			repos.catalogo.guardarSitio({ clave: ' em-30185 ', nombre: 'AREA VI' })
		);
		expect(error.tipo).toBe('invalido');
		expect(error.detalle).toMatchObject({
			motivo: 'sitio_duplicado',
			existente: { nombre: 'ÁREA VI' }
		});
	});

	it('conserva la misma actividad con distinto número en otro sitio y rechaza el número repetido', async () => {
		const base = await crearBase(repos, 'p1');
		const otro = await repos.catalogo.guardarSitio({ clave: 'EM-P1-B', nombre: 'OTRO' });
		await repos.catalogo.asociarSitio(base.contratoId, otro.id);
		const comun = {
			contratoId: base.contratoId,
			actividad: 'Manómetros',
			periodicidad: 'trimestral' as const
		};
		await repos.catalogo.guardarPartida({ ...comun, sitioId: base.sitioId, numero: '13' });
		await repos.catalogo.guardarPartida({ ...comun, sitioId: otro.id, numero: '08' });
		const error = await esperarError(
			repos.catalogo.guardarPartida({ ...comun, sitioId: otro.id, numero: '8' })
		);
		expect(error.detalle).toMatchObject({ motivo: 'partida_duplicada' });
		const partidas = await repos.catalogo.listarPartidas({ contratoId: base.contratoId });
		expect(partidas.map((p) => p.numero)).toEqual(['07', '08', '13']);
	});

	it('guarda alcances clasificados, herramientas y equipos del sitio', async () => {
		const base = await crearBase(repos, 'p2');
		const equipo = await repos.catalogo.guardarEquipo({ sitioId: base.sitioId, tag: 'PI-0001' });
		const partida = await repos.catalogo.guardarPartida({
			id: base.partidaId,
			contratoId: base.contratoId,
			sitioId: base.sitioId,
			numero: '7',
			actividad: 'Toma de potenciales',
			periodicidad: 'mensual',
			alcances: [
				{ tipo: 'alcance', texto: 'Inspección visual' },
				{ tipo: 'nota', texto: 'Nota: No incluye materiales' },
				{ tipo: 'norma', texto: 'NOM-007-SECRE' }
			],
			herramientas: [{ cantidad: null, descripcion: 'Multímetro' }],
			equipoIds: [equipo.id]
		});
		expect(partida.alcances.map((a) => [a.orden, a.tipo])).toEqual([
			[1, 'alcance'],
			[2, 'nota'],
			[3, 'norma']
		]);
		expect(partida.herramientas[0]).toMatchObject({ cantidad: null, descripcion: 'Multímetro' });
		expect(partida.equipos.map((e) => e.tag)).toEqual(['PI-0001']);

		const error = await esperarError(
			repos.catalogo.guardarEquipo({ sitioId: base.sitioId, tag: 'pi-0001' })
		);
		expect(error.detalle).toMatchObject({ motivo: 'equipo_duplicado' });

		const ajeno = await repos.catalogo.guardarSitio({ clave: 'EM-P2-AJENO', nombre: '' });
		const equipoAjeno = await repos.catalogo.guardarEquipo({ sitioId: ajeno.id, tag: 'PI-9999' });
		const errorSitio = await esperarError(
			repos.catalogo.guardarPartida({ ...partida, equipoIds: [equipoAjeno.id] })
		);
		expect(errorSitio.detalle).toMatchObject({ motivo: 'equipo_de_otro_sitio' });
	});

	it('presenta como vigente el contrato cuyo periodo incluye la fecha', async () => {
		const base = await crearBase(repos, 'p3');
		const vigentes = await repos.catalogo.listarContratos({
			clienteClave: 'cliente-p3',
			vigentesEn: '2026-06-01'
		});
		expect(vigentes.map((c) => c.id)).toEqual([base.contratoId]);
		expect(vigentes[0].vigente).toBe(true);
		expect(
			await repos.catalogo.listarContratos({ clienteClave: 'cliente-p3', vigentesEn: '2028-01-01' })
		).toEqual([]);
	});

	it('usa el firmante vigente por fecha y rechaza vigencias traslapadas', async () => {
		const base = await crearBase(repos, 'p4');
		const comun = {
			contratoId: base.contratoId,
			funcion: 'elaboro' as const,
			cargo: 'Cargo',
			empresa: 'Empresa'
		};
		await repos.catalogo.guardarFirmante({
			...comun,
			nombre: 'Persona Uno',
			vigenteDesde: '2026-01-01',
			vigenteHasta: '2026-05-31'
		});
		await repos.catalogo.guardarFirmante({
			...comun,
			nombre: 'Persona Dos',
			vigenteDesde: '2026-06-01'
		});
		expect(
			(await repos.catalogo.firmantesVigentes(base.contratoId, '2026-05-15')).elaboro?.nombre
		).toBe('Persona Uno');
		const julio = await repos.catalogo.firmantesVigentes(base.contratoId, '2026-07-01');
		expect(julio.elaboro?.nombre).toBe('Persona Dos');
		expect(julio.aprobo).toBeNull();
		const error = await esperarError(
			repos.catalogo.guardarFirmante({
				...comun,
				nombre: 'Persona Tres',
				vigenteDesde: '2026-05-01'
			})
		);
		expect(error.detalle).toMatchObject({ motivo: 'firmante_traslapado' });
	});
});

describe('programa anual', () => {
	it('presenta doce meses de mayo de 2026 a abril de 2027', async () => {
		const base = await crearBase(repos, 'g1');
		const avance = await repos.programa.obtenerAvance(base.programaId);
		expect(avance.programa.meses).toHaveLength(12);
		expect(avance.programa.meses[0]).toBe('2026-05-01');
		expect(avance.programa.meses[11]).toBe('2027-04-01');
	});

	it('marca la diferencia cuando la suma programada no cuadra y rechaza meses fuera del periodo', async () => {
		const base = await crearBase(repos, 'g2');
		const meses = Array.from({ length: 11 }, (_, i) => ({
			partidaId: base.partidaId,
			mes: new Date(Date.UTC(2026, 4 + i, 1)).toISOString().slice(0, 10),
			cantidad: 1
		}));
		await repos.programa.guardarMeses(base.programaId, meses);
		const [partida] = (await repos.programa.obtenerAvance(base.programaId)).partidas;
		expect(partida.totalProgramado).toBe(11);
		expect(partida.diferencia).toBe(1);

		const error = await esperarError(
			repos.programa.guardarMeses(base.programaId, [
				{ partidaId: base.partidaId, mes: '2027-06-01', cantidad: 1 }
			])
		);
		expect(error.detalle).toMatchObject({ motivo: 'mes_fuera_de_periodo' });
	});
});

describe('realizado derivado de los reportes', () => {
	const celda = async (base: Base, mes: string) => {
		const avance = await repos.programa.obtenerAvance(base.programaId);
		return avance.partidas.find((p) => p.id === base.partidaId)!.celdas.find((c) => c.mes === mes)!;
	};

	it('no cuenta borradores y suma uno al emitir', async () => {
		const base = await crearBase(repos, 'r1');
		const reporte = await nuevoReporte(repos, base);
		expect((await celda(base, '2026-05-01')).realizado).toBe(0);
		const emitido = await emitir(repos, reporte);
		expect(emitido.estado).toBe('emitido');
		expect(await celda(base, '2026-05-01')).toMatchObject({ realizado: 1, reportes: [reporte.id] });
	});

	it('cuenta una ejecución por seis reportes por TAG en el mismo mes y los lista', async () => {
		const base = await crearBase(repos, 'r2');
		for (let i = 1; i <= 6; i++) {
			const equipo = await repos.catalogo.guardarEquipo({
				sitioId: base.sitioId,
				tag: `PI-000${i}`
			});
			await emitir(repos, await nuevoReporte(repos, base, { equipoIds: [equipo.id] }));
		}
		const resultado = await celda(base, '2026-05-01');
		expect(resultado.realizado).toBe(1);
		expect(resultado.reportes).toHaveLength(6);
	});

	it('cuenta por separado ocurrencias semanales distintas y suma realizados manuales', async () => {
		const base = await crearBase(repos, 'r3');
		await emitir(
			repos,
			await nuevoReporte(repos, base, { ocurrencia: { tipo: 'semana', numero: 1 } })
		);
		await emitir(
			repos,
			await nuevoReporte(repos, base, { ocurrencia: { tipo: 'semana', numero: 2 } })
		);
		await repos.programa.registrarRealizadoManual({
			programaId: base.programaId,
			partidaId: base.partidaId,
			mes: '2026-05-20',
			nota: 'Reporte Word anterior'
		});
		expect((await celda(base, '2026-05-01')).realizado).toBe(3);
	});

	it('sustituye la revisión anterior al emitir la nueva sin duplicar el realizado', async () => {
		const base = await crearBase(repos, 'r4');
		const original = await emitir(repos, await nuevoReporte(repos, base));
		const revision = await repos.reportes.crearRevision(original.id);
		expect(revision).toMatchObject({ estado: 'borrador', revision: 1, sustituyeA: original.id });
		expect((await esperarError(repos.reportes.crearRevision(original.id))).detalle).toMatchObject({
			motivo: 'revision_existente'
		});
		await emitir(repos, revision);
		expect((await repos.reportes.obtener(original.id)).estado).toBe('sustituido');
		expect(await celda(base, '2026-05-01')).toMatchObject({
			realizado: 1,
			reportes: [revision.id]
		});
	});
});

describe('edición de reportes', () => {
	it('rechaza guardar una versión anterior e indica la vigente', async () => {
		const base = await crearBase(repos, 'e1');
		const reporte = await nuevoReporte(repos, base);
		const { reporte: guardado } = await repos.reportes.guardar(
			aGuardado(reporte, { conclusiones: 'Primera persona' })
		);
		expect(guardado.version).toBe(reporte.version + 1);
		const error = await esperarError(
			repos.reportes.guardar(aGuardado(reporte, { conclusiones: 'Segunda persona' }))
		);
		expect(error.tipo).toBe('conflicto');
		expect(error.detalle).toMatchObject({ motivo: 'version', versionActual: guardado.version });
		expect((await repos.reportes.obtener(reporte.id)).conclusiones).toBe('Primera persona');
	});

	it('reordena y mueve fotos entre alcances y devuelve las rutas de las quitadas', async () => {
		const base = await crearBase(repos, 'e2');
		let reporte = await nuevoReporte(repos, base);
		const [primero, segundo] = reporte.alcances;
		let version = reporte.version;
		const ids: string[] = [];
		for (const n of [1, 2, 3]) {
			const { foto, version: nueva } = await repos.reportes.agregarFoto({
				reporteId: reporte.id,
				alcanceId: primero.id,
				version,
				rutaOriginal: `o/${n}.jpg`,
				rutaOptimizada: `x/${n}.jpg`,
				ancho: 1600,
				alto: 1200,
				bytes: 1000,
				tipoMime: 'image/jpeg'
			});
			ids.push(foto.id);
			version = nueva;
		}
		reporte = await repos.reportes.obtener(reporte.id);
		const guardado = aGuardado(reporte);
		// La tercera pasa al primer lugar, la segunda se mueve al otro alcance y la primera se quita.
		guardado.alcances[0].fotos = [{ id: ids[2], descripcion: 'tercera', momento: null }];
		guardado.alcances[1].fotos = [{ id: ids[1], descripcion: 'segunda', momento: null }];
		const resultado = await repos.reportes.guardar(guardado);
		expect(resultado.fotosEliminadas).toEqual([
			{ rutaOriginal: 'o/1.jpg', rutaOptimizada: 'x/1.jpg' }
		]);
		const [a1, a2] = resultado.reporte.alcances;
		expect(a1.fotos.map((f) => [f.orden, f.descripcion])).toEqual([[1, 'tercera']]);
		expect(a2.id).toBe(segundo.id);
		expect(a2.fotos.map((f) => [f.orden, f.descripcion])).toEqual([[1, 'segunda']]);
	});

	it('impide modificar un reporte emitido y las transiciones no permitidas', async () => {
		const base = await crearBase(repos, 'e3');
		const borrador = await nuevoReporte(repos, base);
		expect(
			(await esperarError(repos.reportes.cambiarEstado(borrador.id, borrador.version, 'emitido')))
				.detalle
		).toMatchObject({
			motivo: 'transicion'
		});
		const emitido = await emitir(repos, borrador);
		const error = await esperarError(repos.reportes.guardar(aGuardado(emitido)));
		expect(error.tipo).toBe('conflicto');
		expect(error.detalle).toMatchObject({ motivo: 'estado', estado: 'emitido' });
	});

	it('rechaza una fecha de ejecución fuera del mes del reporte', async () => {
		const base = await crearBase(repos, 'e4');
		const reporte = await nuevoReporte(repos, base);
		const error = await esperarError(
			repos.reportes.guardar(aGuardado(reporte, { fechaEjecucion: '2026-06-02' }))
		);
		expect(error.tipo).toBe('invalido');
	});
});

describe('historial y documentos', () => {
	it('filtra por TAG del más reciente al más antiguo y registra el documento generado', async () => {
		const base = await crearBase(repos, 'h1');
		const psv = await repos.catalogo.guardarEquipo({ sitioId: base.sitioId, tag: 'PSV-2001' });
		const otro = await repos.catalogo.guardarEquipo({ sitioId: base.sitioId, tag: 'PSV-1001' });
		const mayo = await nuevoReporte(repos, base, { equipoIds: [psv.id] });
		const junio = await nuevoReporte(repos, base, {
			periodoMes: '2026-06-01',
			equipoIds: [psv.id]
		});
		await nuevoReporte(repos, base, { equipoIds: [otro.id] });
		const pagina = await repos.reportes.listar({ tag: 'psv-2001' });
		expect(pagina.total).toBe(2);
		expect(pagina.filas.map((f) => f.id)).toEqual([junio.id, mayo.id]);
		expect(pagina.filas[0].tags).toBe('PSV-2001');

		const documento = await repos.reportes.registrarDocumento({
			reporteId: mayo.id,
			versionPlantilla: 'FOR-ICSI-RMT-01.v1',
			ruta: 'documentos/x.docx',
			nombreArchivo: 'P07_X_2026-05.docx',
			bytes: 1234
		});
		expect(documento).toMatchObject({
			versionPlantilla: 'FOR-ICSI-RMT-01.v1',
			reporteVersion: mayo.version
		});
		const conDocumento = await repos.reportes.listar({ tag: 'PSV-2001', hasta: '2026-05-31' });
		expect(conDocumento.filas[0].documento?.nombreArchivo).toBe('P07_X_2026-05.docx');
	});

	it('pagina el historial', async () => {
		const pagina = await repos.reportes.listar({
			clienteClave: 'cliente-h1',
			tamano: 1,
			pagina: 2
		});
		expect(pagina.total).toBe(3);
		expect(pagina.filas).toHaveLength(1);
		expect(pagina.pagina).toBe(2);
	});
});

describe('seguridad', () => {
	it('habilita RLS en todas las tablas', async () => {
		const sinRls = await cliente.bd.query<{ relname: string }>(
			"select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity"
		);
		expect(sinRls.rows).toEqual([]);
	});

	it('solo permite invocar funciones api_*', () => {
		expect(() => validarFuncion('api_listar_clientes')).not.toThrow();
		expect(() => validarFuncion('pg_sleep')).toThrow();
		expect(() => validarFuncion('api_x; drop table reportes')).toThrow();
	});
});

describe('correcciones de la revisión de la fase 3', () => {
	const foto = (reporte: Reporte, version: number, n: number) => ({
		reporteId: reporte.id,
		alcanceId: reporte.alcances[0].id,
		version,
		rutaOriginal: `o/${reporte.id}-${n}.jpg`,
		rutaOptimizada: `x/${reporte.id}-${n}.jpg`,
		ancho: 800,
		alto: 600,
		bytes: 500,
		tipoMime: 'image/jpeg'
	});

	it('no devuelve para borrar las rutas que comparte una revisión con el original', async () => {
		const base = await crearBase(repos, 'c1');
		const borrador = await nuevoReporte(repos, base);
		await repos.reportes.agregarFoto(foto(borrador, borrador.version, 1));
		const original = await emitir(repos, await repos.reportes.obtener(borrador.id));
		const revision = await repos.reportes.crearRevision(original.id);
		const sinFoto = aGuardado(revision);
		sinFoto.alcances[0].fotos = [];
		const { fotosEliminadas } = await repos.reportes.guardar(sinFoto);
		expect(fotosEliminadas).toEqual([]);
		expect((await repos.reportes.obtener(original.id)).alcances[0].fotos).toHaveLength(1);
	});

	it('exige la versión al agregar una foto', async () => {
		const base = await crearBase(repos, 'c2');
		const reporte = await nuevoReporte(repos, base);
		const sinVersion = {
			...foto(reporte, reporte.version, 1),
			version: undefined as unknown as number
		};
		expect((await esperarError(repos.reportes.agregarFoto(sinVersion))).detalle).toMatchObject({
			motivo: 'version_requerida'
		});
		const obsoleta = await esperarError(
			repos.reportes.agregarFoto(foto(reporte, reporte.version + 5, 1))
		);
		expect(obsoleta.tipo).toBe('conflicto');
	});

	it('rechaza equipos de otro sitio y conserva el TAG copiado aunque cambie el catálogo', async () => {
		const base = await crearBase(repos, 'c3');
		const equipo = await repos.catalogo.guardarEquipo({ sitioId: base.sitioId, tag: 'PI-0001' });
		const ajeno = await repos.catalogo.guardarSitio({ clave: 'EM-C3-AJENO', nombre: '' });
		const equipoAjeno = await repos.catalogo.guardarEquipo({ sitioId: ajeno.id, tag: 'PI-0002' });
		expect(
			(await esperarError(nuevoReporte(repos, base, { equipoIds: [equipoAjeno.id] }))).detalle
		).toMatchObject({
			motivo: 'equipo_de_otro_sitio'
		});
		const reporte = await nuevoReporte(repos, base, { equipoIds: [equipo.id] });
		await repos.catalogo.guardarEquipo({ ...equipo, tag: 'PI-0001-CORREGIDO' });
		expect((await repos.reportes.obtener(reporte.id)).equipos[0].tag).toBe('PI-0001');
		expect(
			(await repos.reportes.listar({ tag: 'PI-0001', clienteClave: 'cliente-c3' })).total
		).toBe(1);
	});

	it('rechaza programas superpuestos y periodos que dejan meses fuera', async () => {
		const base = await crearBase(repos, 'c4');
		const superpuesto = await esperarError(
			repos.programa.guardarPrograma({
				contratoId: base.contratoId,
				sitioId: base.sitioId,
				periodoInicio: '2026-11-01',
				periodoFin: '2027-10-31'
			})
		);
		expect(superpuesto.detalle).toMatchObject({ motivo: 'programa_superpuesto' });
		await repos.programa.guardarMeses(base.programaId, [
			{ partidaId: base.partidaId, mes: '2027-03-01', cantidad: 1 }
		]);
		const fuera = await esperarError(
			repos.programa.guardarPrograma({
				id: base.programaId,
				contratoId: base.contratoId,
				sitioId: base.sitioId,
				periodoInicio: '2026-05-01',
				periodoFin: '2026-12-31'
			})
		);
		expect(fuera.detalle).toMatchObject({ motivo: 'periodo_con_datos_fuera' });
	});

	it('cuenta los realizados manuales solo en su programa', async () => {
		const base = await crearBase(repos, 'c5');
		const siguiente = await repos.programa.guardarPrograma({
			contratoId: base.contratoId,
			sitioId: base.sitioId,
			periodoInicio: '2027-05-01',
			periodoFin: '2028-04-30'
		});
		await repos.programa.registrarRealizadoManual({
			programaId: base.programaId,
			partidaId: base.partidaId,
			mes: '2026-05-01',
			nota: 'Trabajo documentado fuera del sistema'
		});
		const enOtro = (await repos.programa.obtenerAvance(siguiente.id)).partidas[0];
		expect(enOtro.totalRealizado).toBe(0);
		expect((await repos.programa.obtenerAvance(base.programaId)).partidas[0].totalRealizado).toBe(
			1
		);
	});
});

describe('correcciones de la revisión de la fase 3 (ronda 2)', () => {
	it('no acorta un periodo que deja fuera un reporte emitido sin mes programado', async () => {
		const base = await crearBase(repos, 'c6');
		const reporte = await nuevoReporte(repos, base, { periodoMes: '2027-03-01' });
		await emitir(repos, reporte);
		const error = await esperarError(
			repos.programa.guardarPrograma({
				id: base.programaId,
				contratoId: base.contratoId,
				sitioId: base.sitioId,
				periodoInicio: '2026-05-01',
				periodoFin: '2026-12-31'
			})
		);
		expect(error.detalle).toMatchObject({ motivo: 'periodo_con_datos_fuera' });
	});
});
