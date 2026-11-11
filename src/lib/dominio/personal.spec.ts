import { describe, expect, it } from 'vitest';
import {
	dividirNombre,
	leerListaPersonal,
	nombreCompleto,
	requiereCentros,
	textoAcceso,
	textoCentros
} from './personal';

const centro = (clave: string) => ({
	id: '00000000-0000-4000-8000-000000000001',
	clave,
	nombre: ''
});

describe('personal', () => {
	it('arma el nombre completo sin el materno vacío', () => {
		expect(
			nombreCompleto({ nombre: 'Ana', apellidoPaterno: 'Ficticia', apellidoMaterno: null })
		).toBe('Ana Ficticia');
		expect(
			nombreCompleto({ nombre: ' Ana ', apellidoPaterno: 'Ficticia', apellidoMaterno: 'Prueba' })
		).toBe('Ana Ficticia Prueba');
	});

	it('el administrador no requiere centros de costo y los ve todos', () => {
		expect(requiereCentros('administrador')).toBe(false);
		expect(requiereCentros('reporteador')).toBe(true);
		expect(textoCentros({ rol: 'administrador', centrosCosto: [] })).toBe(
			'Todos los centros de costo'
		);
		expect(
			textoCentros({
				rol: 'lider_operativo',
				centrosCosto: [centro('EM-90001'), centro('EM-90002')]
			})
		).toBe('EM-90001, EM-90002');
	});

	it('mesa directiva y contabilidad abarcan todos los centros de costo', () => {
		expect(requiereCentros('mesa_directiva')).toBe(false);
		expect(requiereCentros('contabilidad')).toBe(false);
		expect(requiereCentros('lider_administrativo')).toBe(true);
		expect(textoCentros({ rol: 'contabilidad', centrosCosto: [] })).toBe(
			'Todos los centros de costo'
		);
		expect(textoCentros({ rol: 'reporteador', centrosCosto: [] })).toBe('Sin centros de costo');
	});

	it('describe el estado de la cuenta', () => {
		const acceso = { debeCambiar: false, bloqueadaHasta: null, ultimoAccesoEn: null };
		expect(textoAcceso({ acceso: null })).toBe('Sin cuenta');
		expect(textoAcceso({ acceso })).toBe('Con cuenta');
		expect(textoAcceso({ acceso: { ...acceso, debeCambiar: true } })).toBe('Contraseña temporal');
		expect(
			textoAcceso({ acceso: { ...acceso, bloqueadaHasta: '2026-11-10T12:00:00+00:00' } })
		).toBe('Bloqueada');
	});
});

describe('división del nombre completo', () => {
	const dividir = (completo: string) => {
		const d = dividirNombre(completo);
		return d ? [d.nombre, d.apellidoPaterno, d.apellidoMaterno] : null;
	};

	it('toma como apellidos los dos últimos', () => {
		expect(dividir('LUIS RAMOS DÍAZ')).toEqual(['LUIS', 'RAMOS', 'DÍAZ']);
		expect(dividir('  MARÍA   FERNANDA  RUIZ LÓPEZ ')).toEqual(['MARÍA FERNANDA', 'RUIZ', 'LÓPEZ']);
	});

	it('une las partículas al apellido que preceden', () => {
		expect(dividir('JUAN PABLO DE LA TORRE SALAS')).toEqual(['JUAN PABLO', 'DE LA TORRE', 'SALAS']);
		expect(dividir('ROSA MEDINA DE LOS SANTOS')).toEqual(['ROSA', 'MEDINA', 'DE LOS SANTOS']);
		expect(dividir('Elena del Río Vega')).toEqual(['Elena', 'del Río', 'Vega']);
	});

	it('deja en el nombre lo que queda, también con partículas', () => {
		expect(dividir('ANA DEL CARMEN RUIZ LÓPEZ')).toEqual(['ANA DEL CARMEN', 'RUIZ', 'LÓPEZ']);
		expect(dividir('JOSÉ DE JESÚS RAMOS DÍAZ')).toEqual(['JOSÉ DE JESÚS', 'RAMOS', 'DÍAZ']);
	});

	it('con dos palabras la segunda es el apellido paterno', () => {
		expect(dividir('LUIS RAMOS')).toEqual(['LUIS', 'RAMOS', null]);
		expect(dividir('LUIS DE LA TORRE')).toEqual(['LUIS', 'DE LA TORRE', null]);
	});

	it('sin nombre y apellido no hay división', () => {
		expect(dividir('LUIS')).toBeNull();
		expect(dividir('   ')).toBeNull();
	});
});

describe('lectura de una lista de personal', () => {
	it('acepta tabulador, punto y coma o coma, y salta las líneas vacías', () => {
		const texto = [
			'ANA RUIZ LÓPEZ\tSEDE UNO\tana@ficticio.test',
			'',
			' LUIS RAMOS ; SEDE DOS ; luis@ficticio.test ',
			'ROSA MEDINA,,rosa@ficticio.test',
			'SOLO NOMBRE'
		].join('\r\n');
		expect(leerListaPersonal(texto)).toEqual([
			{ linea: 1, completo: 'ANA RUIZ LÓPEZ', sede: 'SEDE UNO', correo: 'ana@ficticio.test' },
			{ linea: 3, completo: 'LUIS RAMOS', sede: 'SEDE DOS', correo: 'luis@ficticio.test' },
			{ linea: 4, completo: 'ROSA MEDINA', sede: null, correo: 'rosa@ficticio.test' },
			{ linea: 5, completo: 'SOLO NOMBRE', sede: null, correo: null }
		]);
	});
});
