import JSZip from 'jszip';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aGuardado } from '../dominio/captura';
import type { Partida, Reporte } from '../dominio/esquemas';
import { AlmacenamientoLocal } from './almacenamiento';
import type { ClienteSql } from './bd/cliente';
import { crearClientePglite } from './bd/pglite';
import { ErrorValidacion, rutaMiniatura, ServicioCaptura } from './captura';
import { texto } from './documentos/ooxml';
import { crearRepositorios, type Repositorios } from './repositorios/index';

const jpeg = (color = '#556677') =>
	sharp({ create: { width: 320, height: 240, channels: 3, background: color } })
		.jpeg()
		.toBuffer();

let repos: Repositorios;
let carpeta: string;
let servicio: ServicioCaptura;
let partida: Partida;
let equipoId: string;

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	carpeta = await mkdtemp(join(tmpdir(), 'captura-'));
	servicio = new ServicioCaptura(repos, new AlmacenamientoLocal(carpeta));
	const cliente = await repos.catalogo.guardarCliente({
		clave: 'ficticio',
		nombre: 'Ficticio',
		razonSocial: 'CLIENTE FICTICIO'
	});
	const contrato = await repos.catalogo.guardarContrato({
		clienteId: cliente.id,
		numero: 'OC-FICTICIA',
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30'
	});
	const sitio = await repos.catalogo.guardarSitio({ clave: 'EM-99999', nombre: 'SITIO FICTICIO' });
	await repos.catalogo.asociarSitio(contrato.id, sitio.id);
	const equipo = await repos.catalogo.guardarEquipo({ sitioId: sitio.id, tag: 'PI-0001' });
	equipoId = equipo.id;
	for (const [funcion, nombre] of [
		['elaboro', 'Persona Ficticia Uno'],
		['aprobo', 'Persona Ficticia Dos'],
		['recibio', 'Persona Ficticia Tres']
	] as const) {
		await repos.catalogo.guardarFirmante({
			contratoId: contrato.id,
			funcion,
			nombre,
			cargo: 'Cargo',
			empresa: 'Empresa',
			vigenteDesde: '2026-05-01'
		});
	}
	partida = await repos.catalogo.guardarPartida({
		contratoId: contrato.id,
		sitioId: sitio.id,
		numero: '13',
		actividad: 'Mantenimiento de manómetros',
		periodicidad: 'mensual',
		objetivo: 'Verificar los manómetros.',
		conclusionesBase: 'Equipos operando.',
		proponeVerificacion: true,
		alcances: [
			{ tipo: 'alcance', texto: 'Inspección visual\nRevisión de carátula.' },
			{ tipo: 'nota', texto: 'Nota: No incluye refacciones.' }
		],
		herramientas: [{ cantidad: '1', descripcion: 'Manómetro patrón' }],
		equipoIds: [equipo.id]
	});
}, 60_000);

afterAll(async () => {
	await repos.cerrar();
	await rm(carpeta, { recursive: true, force: true });
});

const crear = () =>
	servicio.crearReporte({
		partidaId: partida.id,
		periodoMes: '2026-06-01',
		ocurrencia: null,
		equipoIds: [equipoId]
	});

async function esperarValidacion(promesa: Promise<unknown>): Promise<string[]> {
	try {
		await promesa;
	} catch (error) {
		expect(error).toBeInstanceOf(ErrorValidacion);
		return (error as ErrorValidacion).observaciones.map((o) => o.campo);
	}
	throw new Error('Se esperaba un error de validación');
}

describe('recorrido completo de la captura', () => {
	it('crea, captura, emite y descarga el DOCX registrado', async () => {
		const reporte = await crear();
		expect(reporte).toMatchObject({
			titulo: '13.- MANTENIMIENTO DE MANÓMETROS. JUNIO 2026',
			usuario: 'CLIENTE FICTICIO',
			sitioTexto: 'EM-99999 SITIO FICTICIO',
			periodicidad: 'Mensual',
			incluyeVerificacion: true,
			estado: 'borrador'
		});
		expect(reporte.alcances.map((a) => [a.titulo, a.descripcion])).toEqual([
			['Inspección visual', 'Revisión de carátula.']
		]);
		expect(reporte.equipos.map((e) => e.tag)).toEqual(['PI-0001']);
		expect(reporte.firmantes.recibio?.nombre).toBe('Persona Ficticia Tres');

		// Sin días ni estado de verificación no se puede enviar a revisión.
		expect(
			await esperarValidacion(servicio.cambiarEstado(reporte.id, reporte.version, 'en_revision'))
		).toEqual(['diasEjecucion', 'alcances.0.estado']);

		const alcanceId = reporte.alcances[0].id;
		const carga = await servicio.cargarFotos({
			reporteId: reporte.id,
			alcanceId,
			version: reporte.version,
			momento: null,
			archivos: [
				{ nombre: 'uno.jpg', datos: await jpeg() },
				{ nombre: 'documento.pdf', datos: new TextEncoder().encode('%PDF-1.4 no es foto') },
				{ nombre: 'dos.jpg', datos: await jpeg('#887766') }
			]
		});
		expect(carga.fotos).toHaveLength(2);
		expect(carga.rechazadas).toEqual([
			{ nombre: 'documento.pdf', motivo: expect.stringContaining('JPEG, PNG o HEIC') }
		]);
		expect(carga.version).toBe(reporte.version + 2);

		const conFotos = await servicio.obtener(reporte.id);
		const guardado = aGuardado(conFotos);
		guardado.diasEjecucion = [{ desde: '2026-06-18', hasta: '2026-06-18' }];
		guardado.alcances[0].estadoVerificacion = 'ok';
		guardado.alcances[0].fotos[0].descripcion = 'Vista general';
		const capturado = await servicio.guardar(guardado);

		const enRevision = await servicio.cambiarEstado(capturado.id, capturado.version, 'en_revision');
		const emitido = await servicio.cambiarEstado(enRevision.id, enRevision.version, 'emitido');
		expect(emitido.estado).toBe('emitido');

		// Un DOCX registrado con la plantilla v1 (índice con aviso al abrir) ya no se reutiliza.
		const anterior = await repos.reportes.registrarDocumento({
			reporteId: emitido.id,
			reporteVersion: emitido.version,
			versionPlantilla: 'FOR-ICSI-RMT-01.v1',
			ruta: 'documentos/plantilla-anterior.docx',
			nombreArchivo: 'plantilla-anterior.docx',
			bytes: 10
		});
		const descarga = await servicio.generarDocumento(emitido.id);
		expect(descarga.documento.id).not.toBe(anterior.id);
		expect(descarga.nombreArchivo).toBe('P13_MANTENIMIENTO-MANOMETROS_PI-0001_2026-06.docx');
		const documento = await (await JSZip.loadAsync(descarga.datos))
			.file('word/document.xml')!
			.async('string');
		expect(texto(documento)).toContain('Ilustración 2.1.1 Vista general');
		expect(texto(documento)).toContain('18 / JUNIO / 2026');
		expect((documento.match(/<pic:pic/g) ?? []).length).toBe(2);

		// La segunda descarga de la misma versión reutiliza el documento registrado.
		const otraVez = await servicio.generarDocumento(emitido.id);
		expect(otraVez.documento.id).toBe(descarga.documento.id);
		expect(otraVez.documento.versionPlantilla).toBe('FOR-ICSI-RMT-01.v2');
		expect((await servicio.obtener(emitido.id)).documentos).toHaveLength(2);

		// Un documento generado con una versión que ya cambió no se registra.
		await expect(
			repos.reportes.registrarDocumento({
				reporteId: emitido.id,
				reporteVersion: emitido.version - 1,
				versionPlantilla: 'FOR-ICSI-RMT-01.v1',
				ruta: 'documentos/obsoleto.docx',
				nombreArchivo: 'obsoleto.docx',
				bytes: 10
			})
		).rejects.toMatchObject({ tipo: 'conflicto' });

		// La versión es obligatoria aunque el llamador no use el repositorio.
		const sql = (repos.reportes as unknown as { sql: ClienteSql }).sql;
		await expect(
			sql.llamar('api_registrar_documento', {
				reporteId: emitido.id,
				versionPlantilla: 'FOR-ICSI-RMT-01.v1',
				ruta: 'documentos/sin-version.docx',
				nombreArchivo: 'sin-version.docx',
				bytes: 10
			})
		).rejects.toMatchObject({ tipo: 'invalido' });

		// La revisión conserva la huella del original: no ofrece cambios del catálogo inexistentes.
		const revision = await servicio.crearRevision(emitido.id);
		expect(revision).toMatchObject({ estado: 'borrador', revision: 1 });
		expect(revision.alcances[0].fotos).toHaveLength(2);
		expect((await servicio.estadoCatalogo(revision)).cambiado).toBe(false);
	});

	it('rechaza el guardado de una versión anterior sin sobrescribir', async () => {
		const reporte = await crear();
		const primero = aGuardado(reporte);
		primero.conclusiones = 'Primera persona';
		await servicio.guardar(primero);
		const segundo = aGuardado(reporte);
		segundo.conclusiones = 'Segunda persona';
		await expect(servicio.guardar(segundo)).rejects.toMatchObject({ tipo: 'conflicto' });
		expect((await servicio.obtener(reporte.id)).conclusiones).toBe('Primera persona');
	});

	it('ofrece aplicar los cambios del catálogo y conserva las fotos al hacerlo', async () => {
		const reporte = await crear();
		expect((await servicio.estadoCatalogo(reporte)).cambiado).toBe(false);
		const carga = await servicio.cargarFotos({
			reporteId: reporte.id,
			alcanceId: reporte.alcances[0].id,
			version: reporte.version,
			momento: null,
			archivos: [{ nombre: 'uno.jpg', datos: await jpeg() }]
		});
		// Guardar la partida sin cambios de contenido no cuenta como cambio del catálogo.
		const detalle = await repos.catalogo.obtenerPartida(partida.id);
		await repos.catalogo.guardarPartida({ ...detalle, equipoIds: [equipoId] });
		let actual: Reporte = await servicio.obtener(reporte.id);
		expect((await servicio.estadoCatalogo(actual)).cambiado).toBe(false);

		await repos.catalogo.guardarPartida({
			...detalle,
			objetivo: 'Objetivo actualizado.',
			alcances: [
				{ tipo: 'alcance', texto: 'Inspección visual' },
				{ tipo: 'alcance', texto: 'Limpieza' }
			],
			equipoIds: [equipoId]
		});
		expect((await servicio.estadoCatalogo(actual)).cambiado).toBe(true);
		// El borrador conserva su contenido hasta aplicar los cambios.
		expect(actual.objetivo).toBe('Verificar los manómetros.');

		actual = await servicio.aplicarCatalogo(reporte.id, carga.version);
		expect(actual.objetivo).toBe('Objetivo actualizado.');
		expect(actual.alcances.map((a) => [a.titulo, a.fotos.length])).toEqual([
			['Inspección visual', 1],
			['Limpieza', 0]
		]);
		expect((await servicio.estadoCatalogo(actual)).cambiado).toBe(false);
	});

	it('valida la selección del periodo y del TAG', async () => {
		expect(
			await esperarValidacion(
				servicio.crearReporte({
					partidaId: partida.id,
					periodoMes: '2027-05-01',
					ocurrencia: null,
					equipoIds: [equipoId]
				})
			)
		).toEqual(['periodoMes']);
		expect(
			await esperarValidacion(
				servicio.crearReporte({
					partidaId: partida.id,
					periodoMes: '2026-06-01',
					ocurrencia: null,
					equipoIds: []
				})
			)
		).toEqual(['seleccion']);
	});
});

describe('miniaturas de las fotos', () => {
	const existe = (ruta: string) =>
		new AlmacenamientoLocal(carpeta)
			.leer(ruta)
			.then(() => true)
			.catch(() => false);

	async function conFoto(otro: ServicioCaptura = servicio) {
		const reporte = await crear();
		const carga = await otro.cargarFotos({
			reporteId: reporte.id,
			alcanceId: reporte.alcances[0].id,
			version: reporte.version,
			momento: null,
			archivos: [
				{
					nombre: 'grande.jpg',
					datos: await sharp({
						create: { width: 2000, height: 1500, channels: 3, background: '#335577' }
					})
						.jpeg()
						.toBuffer()
				}
			]
		});
		return { reporte: await servicio.obtener(reporte.id), foto: carga.fotos[0] };
	}

	it('genera al cargar una miniatura de 480 px junto a la optimizada', async () => {
		const { foto } = await conFoto();
		expect(rutaMiniatura(foto.rutaOptimizada)).toBe(
			foto.rutaOptimizada.replace(/\.jpg$/, '-mini.jpg')
		);
		const datos = await new AlmacenamientoLocal(carpeta).leer(rutaMiniatura(foto.rutaOptimizada));
		const { width, height } = await sharp(datos).metadata();
		expect([width, height]).toEqual([480, 360]);
	});

	it('registra la foto aunque no se pueda crear la miniatura', async () => {
		const local = new AlmacenamientoLocal(carpeta);
		const fallida = new ServicioCaptura(repos, {
			guardar: (ruta, datos) =>
				ruta.endsWith('-mini.jpg')
					? Promise.reject(new Error('disco lleno'))
					: local.guardar(ruta, datos),
			leer: (ruta) => local.leer(ruta),
			eliminar: (ruta) => local.eliminar(ruta)
		});
		const { reporte, foto } = await conFoto(fallida);
		expect(reporte.alcances[0].fotos.map((f) => f.id)).toEqual([foto.id]);
		expect(await existe(rutaMiniatura(foto.rutaOptimizada))).toBe(false);

		// La primera lectura la genera y la conserva para la siguiente.
		const generada = await servicio.leerMiniatura(reporte, foto.id);
		expect((await sharp(generada!).metadata()).width).toBe(480);
		expect(await existe(rutaMiniatura(foto.rutaOptimizada))).toBe(true);
		expect(await servicio.leerMiniatura(reporte, 'otra')).toBeNull();
	});

	it('quitar una foto borra sus tres archivos salvo si los comparte una revisión', async () => {
		const { reporte, foto } = await conFoto();
		const rutas = [foto.rutaOriginal, foto.rutaOptimizada, rutaMiniatura(foto.rutaOptimizada)];
		const guardado = aGuardado(reporte);
		guardado.diasEjecucion = [{ desde: '2026-06-18', hasta: '2026-06-18' }];
		for (const alcance of guardado.alcances) alcance.estadoVerificacion = 'ok';
		const capturado = await servicio.guardar(guardado);
		const enRevision = await servicio.cambiarEstado(capturado.id, capturado.version, 'en_revision');
		const emitido = await servicio.cambiarEstado(enRevision.id, enRevision.version, 'emitido');

		// La revisión comparte los archivos con el emitido: quitarla ahí no borra ninguno.
		const revision = await servicio.crearRevision(emitido.id);
		const sinFoto = aGuardado(revision);
		sinFoto.alcances[0].fotos = [];
		await servicio.guardar(sinFoto);
		for (const ruta of rutas) expect(await existe(ruta)).toBe(true);

		// En un borrador que es el único dueño, se borran original, optimizada y miniatura.
		const otro = await conFoto();
		const propias = [
			otro.foto.rutaOriginal,
			otro.foto.rutaOptimizada,
			rutaMiniatura(otro.foto.rutaOptimizada)
		];
		for (const ruta of propias) expect(await existe(ruta)).toBe(true);
		const vacio = aGuardado(otro.reporte);
		vacio.alcances[0].fotos = [];
		await servicio.guardar(vacio);
		for (const ruta of propias) expect(await existe(ruta)).toBe(false);
	});
});
