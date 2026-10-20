import { describe, expect, it } from 'vitest';
import {
	aplicarCatalogo,
	mesesDeVigencia,
	ocurrenciasDelMes,
	prellenarReporte,
	rangoDelPeriodo,
	separarAlcance,
	tipoOcurrencia,
	validarParaRevision,
	type ReporteValidable
} from './captura';
import type { Contrato, Partida, Reporte, Sitio } from './esquemas';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function partida(cambios: Partial<Partida> = {}): Partida {
	return {
		id: ID(1),
		contratoId: ID(2),
		sitioId: ID(3),
		numero: '7',
		actividad: 'Toma de potenciales tubo-suelo',
		nombreCorto: null,
		descripcion: 'Descripción general de la actividad.',
		distribucion: null,
		periodicidad: 'mensual',
		cantidadAnual: 12,
		entrega: null,
		entregaOma: null,
		entregaPropuesta: null,
		requiereOdm: false,
		requierePt: false,
		requiereAst: false,
		materialesPor: null,
		reportesHomologados: null,
		tipoMantenimiento: 'Preventivo',
		objetivo: 'Verificar la protección catódica.',
		conclusionesBase: 'Sistema operando.',
		disposicionFotos: 'cuadricula',
		proponeVerificacion: false,
		estadoCatalogo: 'confirmado',
		actualizadoEn: '2026-05-01T00:00:00Z',
		alcances: [
			{ id: ID(10), orden: 1, tipo: 'alcance', texto: 'Medición de potenciales\nCon electrodo.' },
			{ id: ID(11), orden: 2, tipo: 'nota', texto: 'Nota: No incluye materiales.' },
			{ id: ID(12), orden: 3, tipo: 'alcance', texto: 'Registro de lecturas' }
		],
		herramientas: [{ id: ID(20), orden: 1, cantidad: null, descripcion: 'Multímetro' }],
		equipos: [],
		...cambios
	};
}

const contrato: Contrato = {
	id: ID(2),
	clienteId: ID(4),
	numero: 'OC-FICTICIA',
	descripcion: null,
	vigenciaInicio: '2026-05-01',
	vigenciaFin: '2027-04-30',
	cliente: { id: ID(4), clave: 'ficticio', nombre: 'Ficticio', razonSocial: 'CLIENTE FICTICIO' },
	vigente: true
};
const sitio: Sitio = { id: ID(3), clave: 'EM-99999', nombre: 'SITIO FICTICIO' };
const firmantes = {
	elaboro: {
		id: ID(30),
		contratoId: ID(2),
		funcion: 'elaboro' as const,
		nombre: 'Persona Ficticia Uno',
		cargo: 'Cargo',
		empresa: 'Empresa',
		vigenteDesde: '2026-05-01',
		vigenteHasta: null
	},
	aprobo: null,
	recibio: null
};

describe('periodos de captura', () => {
	it('pide la ocurrencia solo en periodicidades menores a mensual', () => {
		expect(tipoOcurrencia('semanal')).toBe('semana');
		expect(tipoOcurrencia('diaria')).toBe('dia');
		expect(tipoOcurrencia('quincenal')).toBe('quincena');
		expect(tipoOcurrencia('mensual')).toBeNull();
		expect(ocurrenciasDelMes('semana', '2026-05-01')).toEqual([1, 2, 3, 4, 5]);
		expect(ocurrenciasDelMes('dia', '2026-02-01')).toHaveLength(28);
		expect(ocurrenciasDelMes('quincena', '2026-05-01')).toEqual([1, 2]);
	});

	it('lista los meses de la vigencia del contrato', () => {
		const meses = mesesDeVigencia('2026-05-01', '2027-04-30');
		expect(meses).toHaveLength(12);
		expect(meses[0]).toBe('2026-05-01');
		expect(meses.at(-1)).toBe('2027-04-01');
	});
});

describe('prellenado desde el catálogo', () => {
	it('compone el encabezado y el título sin captura manual', () => {
		const nuevo = prellenarReporte({
			partida: partida(),
			contrato,
			sitio,
			firmantes,
			periodoMes: '2026-05-01',
			ocurrencia: null,
			equipoIds: []
		});
		expect(nuevo).toMatchObject({
			titulo: '07.- TOMA DE POTENCIALES TUBO-SUELO. MAYO 2026',
			usuario: 'CLIENTE FICTICIO',
			contratoTexto: 'OC-FICTICIA',
			sitioTexto: 'EM-99999 SITIO FICTICIO',
			periodicidad: 'Mensual',
			tipoMantenimiento: 'Preventivo',
			objetivo: 'Verificar la protección catódica.',
			introduccion: 'Descripción general de la actividad.',
			conclusiones: 'Sistema operando.',
			incluyeVerificacion: false,
			fechaEjecucion: null
		});
		// Solo los alcances ejecutables; el primer renglón es el título.
		expect(nuevo.alcances).toEqual([
			{
				titulo: 'Medición de potenciales',
				descripcion: 'Con electrodo.',
				partidaAlcanceId: ID(10)
			},
			{ titulo: 'Registro de lecturas', descripcion: '', partidaAlcanceId: ID(12) }
		]);
		expect(nuevo.herramientas).toEqual([{ cantidad: null, descripcion: 'Multímetro' }]);
		expect(nuevo.firmantes).toEqual({
			elaboro: { nombre: 'Persona Ficticia Uno', cargo: 'Cargo', empresa: 'Empresa' }
		});
	});

	it('titula la partida semanal con la semana y exige elegirla', () => {
		const semanal = partida({ numero: '15', actividad: 'Limpieza', periodicidad: 'semanal' });
		const base = { partida: semanal, contrato, sitio, firmantes, equipoIds: [] };
		expect(
			prellenarReporte({
				...base,
				periodoMes: '2026-05-01',
				ocurrencia: { tipo: 'semana', numero: 2 }
			}).titulo
		).toBe('15.- LIMPIEZA. SEMANA 2 MAYO 2026');
		expect(() => prellenarReporte({ ...base, periodoMes: '2026-05-01', ocurrencia: null })).toThrow(
			/Semana/
		);
	});

	it('exige un TAG de la partida cuando tiene equipos y rechaza los ajenos', () => {
		const equipo = {
			id: ID(40),
			sitioId: ID(3),
			tag: 'PI-0001',
			tipo: null,
			marca: null,
			modelo: null,
			rango: null,
			numeroSerie: null
		};
		const conEquipos = partida({ equipos: [equipo, { ...equipo, id: ID(41), tag: 'PI-1001' }] });
		const base = { partida: conEquipos, contrato, sitio, firmantes, periodoMes: '2026-05-01' };
		expect(() => prellenarReporte({ ...base, ocurrencia: null, equipoIds: [] })).toThrow(/TAG/);
		expect(() => prellenarReporte({ ...base, ocurrencia: null, equipoIds: [ID(99)] })).toThrow(
			/no pertenecen/
		);
		expect(
			prellenarReporte({ ...base, ocurrencia: null, equipoIds: [ID(40), ID(41)] }).equipoIds
		).toEqual([ID(40), ID(41)]);
	});

	it('separa título y descripción del alcance', () => {
		expect(separarAlcance('Título\r\nLínea 1\nLínea 2')).toEqual({
			titulo: 'Título',
			descripcion: 'Línea 1\nLínea 2'
		});
	});
});

function validable(cambios: Partial<ReporteValidable> = {}): ReporteValidable {
	return {
		periodoMes: '2026-05-01',
		ocurrencia: null,
		fechaEjecucion: '2026-05-18',
		titulo: '07.- TOMA DE POTENCIALES TUBO-SUELO. MAYO 2026',
		usuario: 'CLIENTE FICTICIO',
		contratoTexto: 'OC-FICTICIA',
		sitioTexto: 'EM-99999 SITIO FICTICIO',
		periodicidad: 'Mensual',
		tipoMantenimiento: 'Preventivo',
		objetivo: 'Objetivo',
		conclusiones: 'Conclusiones',
		incluyeVerificacion: true,
		firmantes: {
			elaboro: { nombre: 'Uno', cargo: '', empresa: '' },
			aprobo: { nombre: 'Dos', cargo: '', empresa: '' },
			recibio: { nombre: 'Tres', cargo: '', empresa: '' }
		},
		alcances: [{ titulo: 'Inspección', estadoVerificacion: 'ok', observaciones: '' }],
		equipos: [],
		...cambios
	};
}

describe('validaciones para enviar a revisión', () => {
	it('acepta un reporte completo', () => {
		expect(validarParaRevision(validable())).toEqual([]);
	});

	it('señala la fecha incompleta o fuera del mes', () => {
		expect(validarParaRevision(validable({ fechaEjecucion: null })).map((o) => o.campo)).toEqual([
			'fechaEjecucion'
		]);
		expect(validarParaRevision(validable({ fechaEjecucion: '2026-06-01' }))[0].mensaje).toBe(
			'La fecha de ejecución debe estar dentro del periodo del reporte (del 1 de mayo al 31 de mayo).'
		);
	});

	it('exige la fecha dentro de la semana, quincena o día del reporte', () => {
		// Mayo de 2026 inicia en viernes: la semana 1 va del 1 al 3 y la 2 del 4 al 10.
		expect(rangoDelPeriodo('2026-05-01', { tipo: 'semana', numero: 1 })).toEqual({
			desde: '2026-05-01',
			hasta: '2026-05-03'
		});
		expect(rangoDelPeriodo('2026-05-01', { tipo: 'semana', numero: 5 })).toEqual({
			desde: '2026-05-25',
			hasta: '2026-05-31'
		});
		expect(rangoDelPeriodo('2026-05-01', { tipo: 'quincena', numero: 2 })).toEqual({
			desde: '2026-05-16',
			hasta: '2026-05-31'
		});
		expect(rangoDelPeriodo('2026-02-01', { tipo: 'dia', numero: 29 })).toBeNull();

		const semana2 = { ocurrencia: { tipo: 'semana' as const, numero: 2 } };
		expect(validarParaRevision(validable({ ...semana2, fechaEjecucion: '2026-05-08' }))).toEqual(
			[]
		);
		expect(
			validarParaRevision(validable({ ...semana2, fechaEjecucion: '2026-05-31' }))[0].mensaje
		).toBe(
			'La fecha de ejecución debe estar dentro del periodo del reporte (del 4 de mayo al 10 de mayo).'
		);
		expect(validarParaRevision(validable({ ocurrencia: { tipo: 'dia', numero: 18 } }))).toEqual([]);
		expect(
			validarParaRevision(validable({ ocurrencia: { tipo: 'semana', numero: 7 } })).map(
				(o) => o.campo
			)
		).toEqual(['ocurrencia']);
	});

	it('rechaza textos de relleno en el encabezado', () => {
		const campos = validarParaRevision(
			validable({
				usuario: 'Cambiar',
				sitioTexto: 'N/A',
				tipoMantenimiento: '',
				contratoTexto: '4500057477 (Cambiar)'
			})
		).map((o) => o.campo);
		expect(campos).toEqual(['usuario', 'contratoTexto', 'sitioTexto', 'tipoMantenimiento']);
		// «Cambiar» dentro de un título legítimo no es relleno.
		expect(
			validarParaRevision(validable({ titulo: '05.- CAMBIAR FILTROS DE GAS. MAYO 2026' }))
		).toEqual([]);
	});

	it('exige la observación de un alcance «Con observación» y el estado de cada alcance', () => {
		const observaciones = validarParaRevision(
			validable({
				alcances: [
					{ titulo: 'A', estadoVerificacion: 'con_observacion', observaciones: ' ' },
					{ titulo: 'B', estadoVerificacion: 'pendiente', observaciones: '' }
				]
			})
		);
		expect(observaciones.map((o) => o.campo)).toEqual([
			'alcances.0.observaciones',
			'alcances.1.estado'
		]);
		// Sin tabla de verificación los estados no se exigen.
		expect(
			validarParaRevision(
				validable({
					incluyeVerificacion: false,
					alcances: [{ titulo: 'B', estadoVerificacion: 'pendiente', observaciones: '' }]
				})
			)
		).toEqual([]);
	});

	it('exige conclusiones, firmantes y TAG cuando la partida tiene equipos', () => {
		const campos = validarParaRevision(
			validable({
				conclusiones: '  ',
				firmantes: { elaboro: { nombre: 'Uno', cargo: '', empresa: '' } }
			}),
			{ requiereTag: true }
		).map((o) => o.campo);
		expect(campos).toEqual(['equipos', 'firmantes.aprobo', 'firmantes.recibio', 'conclusiones']);
	});
});

describe('aplicar los cambios del catálogo a un borrador', () => {
	const foto = {
		id: ID(60),
		alcanceId: ID(50),
		orden: 1,
		descripcion: 'Vista',
		momento: null,
		rutaOriginal: 'a',
		rutaOptimizada: 'b',
		ancho: 10,
		alto: 10,
		bytes: 10,
		tipoMime: 'image/jpeg'
	};
	const reporte = {
		id: ID(70),
		version: 3,
		fechaEjecucion: null,
		titulo: 'T',
		tipoMantenimiento: 'Preventivo',
		objetivo: 'Objetivo anterior',
		introduccion: '',
		conclusiones: 'Conclusión capturada',
		incluyeVerificacion: true,
		firmantes: {},
		alcances: [
			{
				id: ID(50),
				orden: 1,
				titulo: 'Medición de potenciales',
				descripcion: 'Texto del técnico',
				estadoVerificacion: 'ok' as const,
				observaciones: '',
				partidaAlcanceId: ID(10),
				fotos: [foto]
			},
			{
				id: ID(51),
				orden: 2,
				titulo: 'Alcance retirado',
				descripcion: '',
				estadoVerificacion: 'pendiente' as const,
				observaciones: '',
				partidaAlcanceId: ID(12),
				fotos: []
			}
		],
		herramientas: [],
		equipos: []
	} as unknown as Reporte;

	it('renueva el contenido y conserva fotos y estados de los alcances que siguen', () => {
		const actualizado = aplicarCatalogo(
			reporte,
			partida({
				objetivo: 'Objetivo nuevo',
				conclusionesBase: null,
				alcances: [
					{ id: ID(80), tipo: 'alcance', texto: 'Alcance nuevo' },
					{ id: ID(81), tipo: 'alcance', texto: 'MEDICION DE POTENCIALES\nDescripción nueva' }
				]
			})
		);
		expect(actualizado.version).toBe(3);
		expect(actualizado.objetivo).toBe('Objetivo nuevo');
		expect(actualizado.conclusiones).toBe('Conclusión capturada');
		expect(actualizado.alcances.map((a) => [a.id, a.titulo, a.fotos.length])).toEqual([
			[undefined, 'Alcance nuevo', 0],
			[ID(50), 'MEDICION DE POTENCIALES', 1]
		]);
		expect(actualizado.alcances[1]).toMatchObject({
			descripcion: 'Descripción nueva',
			estadoVerificacion: 'ok',
			partidaAlcanceId: ID(81)
		});
	});
});
