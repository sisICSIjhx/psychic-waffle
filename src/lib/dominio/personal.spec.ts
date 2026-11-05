import { describe, expect, it } from 'vitest';
import { nombreCompleto, requiereProyectos, textoProyectos } from './personal';

const proyecto = (nombre: string) => ({
	id: '00000000-0000-4000-8000-000000000001',
	clave: nombre.toLowerCase(),
	nombre
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

	it('el administrador no requiere proyectos y los ve todos', () => {
		expect(requiereProyectos('administrador')).toBe(false);
		expect(requiereProyectos('reporteador')).toBe(true);
		expect(textoProyectos({ rol: 'administrador', proyectos: [] })).toBe('Todos los proyectos');
		expect(
			textoProyectos({
				rol: 'lider_operativo',
				proyectos: [proyecto('Cerritos'), proyecto('Proagro')]
			})
		).toBe('Cerritos, Proagro');
	});
});
