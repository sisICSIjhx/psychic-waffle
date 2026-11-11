// Centros de costo, plantillas de seguimiento y alcance sobre PGlite (0023, cambio
// centros-costo-plantillas). Solo claves y nombres ficticios.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CentroCosto, PlantillaSeguimiento } from '../../dominio/esquemas';
import { ErrorDatos } from '../bd/cliente';
import { aplicarMigraciones, leerMigraciones } from '../bd/migraciones';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from './index';

let repos: Repositorios;

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
}, 60_000);

afterAll(() => repos.cerrar());

async function mensajeDe(promesa: Promise<unknown>): Promise<string> {
	try {
		await promesa;
	} catch (error) {
		expect(error).toBeInstanceOf(ErrorDatos);
		return (error as ErrorDatos).message;
	}
	throw new Error('Se esperaba un error');
}

const documentos = (...etiquetas: string[]) =>
	etiquetas.map((etiqueta) => ({
		bloque: 'documentos' as const,
		etiqueta,
		tipo: 'casilla' as const
	}));

describe('plantillas de seguimiento', () => {
	let plantilla: PlantillaSeguimiento;

	it('guarda conceptos por bloque con el nivel que fija cada bloque y en su orden', async () => {
		plantilla = await repos.centrosCosto.guardarPlantilla({
			nombre: 'Mensual ficticia',
			modoContrato: 'sin_contrato',
			origenActividades: 'mensual',
			conceptos: [
				...documentos('ODT', 'AST', 'PT'),
				{ bloque: 'carpetas', etiqueta: 'Seguridad', tipo: 'carpeta' },
				{ bloque: 'programa', etiqueta: 'EM cobradas', tipo: 'cantidad', nivel: 'actividad' },
				{ bloque: 'contrato', etiqueta: 'Monto pactado', tipo: 'monto' }
			]
		});
		expect(plantilla).toMatchObject({ modoContrato: 'sin_contrato', origenActividades: 'mensual' });
		expect(plantilla.conceptos.map((c) => [c.bloque, c.etiqueta, c.nivel, c.orden])).toEqual([
			['contrato', 'Monto pactado', 'contrato', 1],
			['programa', 'EM cobradas', 'actividad', 1],
			['documentos', 'ODT', 'actividad', 1],
			['documentos', 'AST', 'actividad', 2],
			['documentos', 'PT', 'actividad', 3],
			['carpetas', 'Seguridad', 'periodo', 1]
		]);
	});

	it('rechaza combinaciones no válidas, etiquetas repetidas y nombres repetidos', async () => {
		const guardar = (
			conceptos: Parameters<typeof repos.centrosCosto.guardarPlantilla>[0]['conceptos']
		) =>
			mensajeDe(
				repos.centrosCosto.guardarPlantilla({
					nombre: 'Otra ficticia',
					modoContrato: 'obligatorio',
					origenActividades: 'ninguno',
					conceptos
				})
			);
		expect(
			await guardar([{ bloque: 'documentos', etiqueta: 'ODT', tipo: 'casilla', nivel: 'periodo' }])
		).toBe('El nivel no corresponde al bloque');
		expect(await guardar([{ bloque: 'documentos', etiqueta: 'Carpeta', tipo: 'carpeta' }])).toBe(
			'El tipo no corresponde al bloque'
		);
		expect(await guardar([{ bloque: 'carpetas', etiqueta: 'Producción', tipo: 'casilla' }])).toBe(
			'El tipo no corresponde al bloque'
		);
		expect(await guardar(documentos('Reporte', 'reporte '))).toBe('Concepto repetido en el bloque');
		expect(await guardar([{ bloque: 'documentos', etiqueta: '  ', tipo: 'casilla' }])).toBe(
			'Escriba la etiqueta del concepto'
		);
		expect(
			await mensajeDe(
				repos.centrosCosto.guardarPlantilla({
					nombre: ' mensual  FICTICIA',
					modoContrato: 'obligatorio',
					origenActividades: 'ninguno',
					conceptos: []
				})
			)
		).toBe('Ya existe una plantilla con ese nombre');
		// Nada de lo rechazado quedó a medias.
		expect((await repos.centrosCosto.listarPlantillas()).map((p) => p.nombre)).toEqual([
			'Mensual ficticia'
		]);
	});

	it('al editar conserva el id de los conceptos que siguen, borra los quitados y añade los nuevos', async () => {
		const [odt, ast] = plantilla.conceptos.filter((c) => c.bloque === 'documentos');
		const editada = await repos.centrosCosto.guardarPlantilla({
			id: plantilla.id,
			nombre: plantilla.nombre,
			modoContrato: plantilla.modoContrato,
			origenActividades: plantilla.origenActividades,
			conceptos: [
				// Intercambio de etiquetas en la misma operación (la unicidad es diferida).
				{ id: odt.id, bloque: 'documentos', etiqueta: 'AST', tipo: 'casilla' },
				{ id: ast.id, bloque: 'documentos', etiqueta: 'ODT', tipo: 'estado' },
				{ bloque: 'documentos', etiqueta: 'Lista de asistencia', tipo: 'casilla' }
			]
		});
		expect(editada.conceptos.map((c) => [c.id, c.etiqueta, c.tipo, c.orden])).toEqual([
			[odt.id, 'AST', 'casilla', 1],
			[ast.id, 'ODT', 'estado', 2],
			[expect.any(String), 'Lista de asistencia', 'casilla', 3]
		]);
		expect(
			await mensajeDe(
				repos.centrosCosto.guardarPlantilla({
					nombre: 'Ajena ficticia',
					modoContrato: 'obligatorio',
					origenActividades: 'ninguno',
					conceptos: [{ id: odt.id, bloque: 'documentos', etiqueta: 'X', tipo: 'casilla' }]
				})
			)
		).toBe('El concepto no pertenece a la plantilla');
		plantilla = editada;
	});

	it('duplica con conceptos nuevos y no elimina una plantilla en uso', async () => {
		const centro = await repos.centrosCosto.guardar({
			clave: 'EM-92001',
			nombre: 'Uso',
			plantillaId: plantilla.id
		});
		const copia = await repos.centrosCosto.duplicarPlantilla(plantilla.id, 'Mensual ficticia (2)');
		expect(copia.conceptos.map((c) => c.etiqueta)).toEqual(
			plantilla.conceptos.map((c) => c.etiqueta)
		);
		expect(copia.conceptos.some((c) => plantilla.conceptos.some((o) => o.id === c.id))).toBe(false);
		expect(copia.centros).toEqual([]);
		expect(await mensajeDe(repos.centrosCosto.eliminarPlantilla(plantilla.id))).toBe(
			'La usa 1 centro de costo'
		);
		await repos.centrosCosto.eliminarPlantilla(copia.id);
		expect(await mensajeDe(repos.centrosCosto.obtenerPlantilla(copia.id))).toBe(
			'Plantilla no encontrada'
		);
		await repos.centrosCosto.guardar({ id: centro.id, nombre: 'Uso', plantillaId: null });
	});
});

describe('centros de costo', () => {
	let centro: CentroCosto;

	it('da de alta sin contrato, con clave única sin distinguir mayúsculas ni espacios', async () => {
		centro = await repos.centrosCosto.guardar({
			clave: 'EM-93001',
			nombre: 'Centro de prueba',
			plantillaId: null
		});
		expect(centro).toMatchObject({ contratos: [], plantilla: null, partidas: 0, personas: 0 });
		expect(
			await mensajeDe(
				repos.centrosCosto.guardar({ clave: ' em-93001 ', nombre: '', plantillaId: null })
			)
		).toBe('Ya existe un centro de costo con esa clave');
	});

	it('edita nombre y plantilla, y la lista muestra contratos y personas', async () => {
		const plantilla = await repos.centrosCosto.guardarPlantilla({
			nombre: 'Con contrato ficticia',
			modoContrato: 'obligatorio',
			origenActividades: 'programa_anual',
			conceptos: []
		});
		await repos.centrosCosto.guardar({
			id: centro.id,
			nombre: 'Renombrado',
			plantillaId: plantilla.id
		});
		const cliente = await repos.catalogo.guardarCliente({
			clave: 'cliente-cc',
			nombre: 'Cliente ficticio',
			razonSocial: 'RAZÓN FICTICIA'
		});
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: 'K-CC-1',
			descripcion: null,
			vigenciaInicio: '2026-01-01',
			vigenciaFin: '2099-12-31'
		});
		await repos.catalogo.asociarSitio(contrato.id, centro.id);
		await repos.personal.guardar({
			nombre: 'Persona',
			apellidoPaterno: 'Ficticia',
			apellidoMaterno: null,
			fechaNacimiento: null,
			correo: null,
			rol: 'reporteador',
			activo: true,
			centroCostoIds: [centro.id]
		});
		const fila = (await repos.centrosCosto.listar([centro.id]))[0];
		expect(fila).toMatchObject({
			clave: 'EM-93001',
			nombre: 'Renombrado',
			plantilla: { nombre: 'Con contrato ficticia', modoContrato: 'obligatorio' },
			contratos: [{ numero: 'K-CC-1', cliente: 'Cliente ficticio', vigente: true }],
			personas: 1
		});
		expect(await repos.centrosCosto.listar([])).toEqual([]);
		expect(await repos.centrosCosto.centrosDeRecurso('contrato', contrato.id)).toEqual([centro.id]);
		expect(await repos.centrosCosto.contratosCentros()).toContainEqual({
			contratoId: contrato.id,
			clienteId: cliente.id,
			sitioIds: [centro.id]
		});
	});
});

describe('carga desde un archivo', () => {
	const carga = {
		plantillas: [
			{
				nombre: 'Carga ficticia',
				modoContrato: 'opcional' as const,
				origenActividades: 'ninguno' as const,
				conceptos: [{ bloque: 'documentos' as const, etiqueta: 'Reporte', tipo: 'estado' as const }]
			}
		],
		centros: [
			{ clave: 'EM-94001', nombre: 'Uno', plantilla: 'Carga ficticia' },
			{ clave: 'EM-94002', nombre: 'Dos', plantilla: 'Carga ficticia' },
			// Ya existe (de la prueba anterior) con otra plantilla: no se cambia.
			{ clave: 'EM-93001', nombre: '', plantilla: 'Carga ficticia' }
		]
	};

	it('el ensayo informa sin guardar', async () => {
		const resultado = await repos.centrosCosto.importar(carga);
		expect(resultado).toMatchObject({ ensayo: true, aplicado: false });
		expect(resultado.resumen).toEqual({
			plantillasNuevas: 1,
			plantillasExistentes: 0,
			centrosNuevos: 2,
			centrosAsignados: 0,
			centrosExistentes: 1,
			invalidas: 0
		});
		expect(resultado.centros[2]).toMatchObject({
			estado: 'existente',
			motivo: 'Ya tiene otra plantilla; no se cambia'
		});
		const claves = (await repos.centrosCosto.listar()).map((c) => c.clave);
		expect(claves).not.toContain('EM-94001');
		expect((await repos.centrosCosto.listarPlantillas()).map((p) => p.nombre)).not.toContain(
			'Carga ficticia'
		);
	});

	it('con una fila no válida no guarda nada aunque se pida aplicar', async () => {
		const resultado = await repos.centrosCosto.importar(
			{
				...carga,
				centros: [...carga.centros, { clave: 'EM-94003', nombre: '', plantilla: 'Nada' }]
			},
			false
		);
		expect(resultado).toMatchObject({ ensayo: false, aplicado: false });
		expect(resultado.centros[3]).toMatchObject({
			estado: 'invalida',
			motivo: 'Plantilla desconocida'
		});
		expect((await repos.centrosCosto.listar()).map((c) => c.clave)).not.toContain('EM-94001');
	});

	it('aplica todo, asigna la plantilla a un centro existente sin ella y no duplica al repetir', async () => {
		await repos.centrosCosto.guardar({ clave: 'EM-94009', nombre: '', plantillaId: null });
		const conExistente = {
			...carga,
			centros: [...carga.centros, { clave: 'em-94009', nombre: '', plantilla: 'Carga ficticia' }]
		};
		const resultado = await repos.centrosCosto.importar(conExistente, false);
		expect(resultado).toMatchObject({ aplicado: true });
		expect(resultado.resumen).toMatchObject({ centrosNuevos: 2, centrosAsignados: 1 });
		const centros = await repos.centrosCosto.listar();
		expect(centros.find((c) => c.clave === 'EM-94001')?.plantilla?.nombre).toBe('Carga ficticia');
		expect(centros.find((c) => c.clave === 'EM-94009')?.plantilla?.nombre).toBe('Carga ficticia');
		expect((await repos.centrosCosto.importar(conExistente, false)).resumen).toMatchObject({
			plantillasNuevas: 0,
			plantillasExistentes: 1,
			centrosNuevos: 0,
			centrosAsignados: 0,
			centrosExistentes: 4
		});
	});
});

describe('alcance en la sesión y en el historial', () => {
	it('el usuario de la sesión lleva sus centros de costo, o null si su rol los abarca todos', async () => {
		const centro = await repos.centrosCosto.guardar({
			clave: 'EM-95001',
			nombre: '',
			plantillaId: null
		});
		const alta = (rol: 'reporteador' | 'contabilidad', correo: string) =>
			repos.personal.guardar({
				nombre: 'Sesión',
				apellidoPaterno: 'Ficticia',
				apellidoMaterno: null,
				fechaNacimiento: null,
				correo,
				rol,
				activo: true,
				centroCostoIds: [centro.id]
			});
		const administrador = await repos.personal.guardar({
			nombre: 'Admin',
			apellidoPaterno: 'Ficticio',
			apellidoMaterno: null,
			fechaNacimiento: null,
			correo: 'admin.cc@ficticio.test',
			rol: 'administrador',
			activo: true,
			centroCostoIds: []
		});
		const reporteador = await alta('reporteador', 'rep.cc@ficticio.test');
		const contabilidad = await alta('contabilidad', 'conta.cc@ficticio.test');
		for (const persona of [administrador, reporteador, contabilidad]) {
			await repos.autenticacion.establecerContrasena({
				personalId: persona.id,
				hash: 'scrypt$ficticio',
				debeCambiar: false
			});
		}
		const sesion = async (personalId: string, tokenHash: string) => {
			await repos.autenticacion.abrirSesion({ personalId, tokenHash, duracionMinutos: 60 });
			return (await repos.autenticacion.contexto(tokenHash, 720)).usuario;
		};
		expect((await sesion(reporteador.id, 'a'.repeat(64)))?.centrosCosto).toEqual([centro.id]);
		expect((await sesion(contabilidad.id, 'b'.repeat(64)))?.centrosCosto).toBeNull();
	});

	it('el historial filtra por los centros de costo en la consulta, total incluido', async () => {
		const cliente = await repos.catalogo.guardarCliente({
			clave: 'cliente-historial',
			nombre: 'Historial ficticio',
			razonSocial: 'RAZÓN FICTICIA'
		});
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: 'K-H',
			descripcion: null,
			vigenciaInicio: '2026-01-01',
			vigenciaFin: '2026-12-31'
		});
		const centros = await Promise.all(
			['EM-96001', 'EM-96002'].map((clave) =>
				repos.centrosCosto.guardar({ clave, nombre: '', plantillaId: null })
			)
		);
		for (const centro of centros) {
			await repos.catalogo.asociarSitio(contrato.id, centro.id);
			const partida = await repos.catalogo.guardarPartida({
				contratoId: contrato.id,
				sitioId: centro.id,
				numero: '01',
				actividad: 'Inspección',
				periodicidad: 'mensual',
				cantidadAnual: 12
			});
			await repos.reportes.insertar({
				partidaId: partida.id,
				periodoMes: '2026-05-01',
				ocurrencia: null,
				titulo: '01.- INSPECCIÓN. MAYO 2026',
				usuario: 'CLIENTE',
				contratoTexto: 'K-H',
				sitioTexto: centro.clave,
				periodicidad: 'Mensual',
				tipoMantenimiento: 'Preventivo',
				actividad: 'Inspección',
				numeroPartida: '01',
				objetivo: 'Objetivo',
				introduccion: '',
				conclusiones: 'Sin anomalías',
				disposicionFotos: 'cuadricula',
				incluyeVerificacion: false,
				firmantes: {},
				alcances: [{ titulo: 'Inspección visual', descripcion: 'Revisión' }],
				herramientas: [],
				equipoIds: []
			});
		}
		const pagina = await repos.reportes.listar({
			contratoId: contrato.id,
			sitioIds: [centros[0].id]
		});
		expect(pagina.total).toBe(1);
		expect(pagina.filas.map((f) => f.sitioId)).toEqual([centros[0].id]);
		expect((await repos.reportes.listar({ contratoId: contrato.id, sitioIds: [] })).total).toBe(0);
		expect((await repos.reportes.listar({ contratoId: contrato.id })).total).toBe(2);
		const reporte = pagina.filas[0];
		expect(await repos.centrosCosto.centrosDeRecurso('reporte', reporte.id)).toEqual([
			centros[0].id
		]);
		expect(await repos.centrosCosto.centrosDeRecurso('partida', reporte.partidaId)).toEqual([
			centros[0].id
		]);
	});
});

describe('migración 0023', () => {
	it('convierte cada proyecto asignado en los centros de costo de sus contratos', async () => {
		const migraciones = await leerMigraciones();
		const previas = migraciones.filter((m) => m.nombre < '0023');
		const cliente = await crearClientePglite(undefined, previas);
		try {
			const { bd } = cliente;
			const valor = async (sql: string) => (await bd.query<{ id: string }>(sql)).rows[0].id;
			const proyecto = await valor(
				"insert into clientes (clave, nombre, razon_social) values ('p-ficticio', 'P', 'R') returning id"
			);
			const contrato = await valor(
				`insert into contratos (cliente_id, numero, vigencia_inicio, vigencia_fin)
				values ('${proyecto}', 'K', '2026-01-01', '2026-12-31') returning id`
			);
			const sitios = [
				await valor("insert into sitios (clave) values ('EM-97001') returning id"),
				await valor("insert into sitios (clave) values ('EM-97002') returning id")
			];
			for (const sitio of sitios) {
				await bd.query(
					`insert into contrato_sitios (contrato_id, sitio_id) values ('${contrato}', '${sitio}')`
				);
			}
			const persona = await valor(
				`insert into personal (nombre, apellido_paterno, rol, activo)
				values ('Persona', 'Ficticia', 'reporteador', true) returning id`
			);
			const admin = await valor(
				`insert into personal (nombre, apellido_paterno, rol, activo)
				values ('Admin', 'Ficticio', 'administrador', true) returning id`
			);
			await bd.query(
				`insert into personal_proyectos (personal_id, cliente_id)
				values ('${persona}', '${proyecto}'), ('${admin}', '${proyecto}')`
			);

			await aplicarMigraciones(bd, migraciones);

			const asignados = await bd.query<{ personal_id: string; sitio_id: string }>(
				'select personal_id, sitio_id from personal_centros_costo order by sitio_id'
			);
			expect(asignados.rows).toEqual(
				[...sitios].sort().map((sitio) => ({ personal_id: persona, sitio_id: sitio }))
			);
			const tabla = await bd.query<{ existe: string | null }>(
				"select to_regclass('public.personal_proyectos')::text as existe"
			);
			expect(tabla.rows[0].existe).toBeNull();
		} finally {
			await cliente.cerrar();
		}
	}, 60_000);
});
