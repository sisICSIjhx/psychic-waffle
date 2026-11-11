import { describe, expect, it } from 'vitest';
import { ROLES_PERSONAL } from '../../dominio/constantes';
import type { ContextoAcceso, RolPersonal } from '../../dominio/esquemas';
import {
	CAPACIDADES,
	CAPACIDADES_CON_SESION,
	permisosDe,
	PERMISOS_ABIERTOS,
	rolPuede
} from '../../dominio/permisos';
import { permisos, puedeAdministrarPersonal, puedeVerPersonal } from '../permisos';
import { decidirAcceso, destinoSeguro, type PeticionAcceso } from './acceso';

const usuario = (rol: RolPersonal, debeCambiar = false) => ({
	id: '00000000-0000-4000-8000-000000000001',
	nombre: 'Persona Ficticia',
	correo: 'persona@ficticio.test',
	rol,
	debeCambiar,
	centrosCosto: null
});

const con = (rol: RolPersonal | null, debeCambiar = false): ContextoAcceso => ({
	activada: true,
	usuario: rol ? usuario(rol, debeCambiar) : null
});

const peticion = (
	ruta: string,
	metodo = 'GET',
	extra: Partial<PeticionAcceso> = {}
): PeticionAcceso => ({ ruta, busqueda: '', metodo, navegacion: metodo === 'GET', ...extra });

const PERMITIR = { tipo: 'permitir' };

describe('matriz de capacidades', () => {
	it('da a cada rol exactamente lo que dice la especificación', () => {
		const tabla = Object.fromEntries(
			ROLES_PERSONAL.map((rol) => [rol, CAPACIDADES.filter((c) => rolPuede(rol, c))])
		);
		expect(tabla).toEqual({
			administrador: [
				'capturar',
				'ajustarPrograma',
				'editarSeguimiento',
				'editarCatalogo',
				'verPersonal',
				'administrarPersonal',
				'verContrato',
				'editarContrato',
				'verEnlacePrograma',
				'editarCobranza'
			],
			lider_administrativo: [
				'capturar',
				'ajustarPrograma',
				'editarSeguimiento',
				'verContrato',
				'editarContrato',
				'verEnlacePrograma'
			],
			lider_operativo: ['capturar', 'ajustarPrograma', 'editarSeguimiento', 'verEnlacePrograma'],
			reporteador: ['capturar', 'editarSeguimiento'],
			mesa_directiva: ['verPersonal', 'verContrato', 'verEnlacePrograma'],
			contabilidad: ['verContrato', 'editarCobranza']
		});
	});

	it('sin activar se permite todo menos contrato y cobranza; activado y sin sesión, nada', () => {
		expect(permisosDe({ activada: false, rol: null })).toEqual(PERMISOS_ABIERTOS);
		expect(CAPACIDADES.filter((c) => !PERMISOS_ABIERTOS[c])).toEqual(CAPACIDADES_CON_SESION);
		expect(Object.values(permisosDe({ activada: true, rol: null })).some(Boolean)).toBe(false);
	});

	it('los permisos del servidor toleran que falte `locals`', () => {
		expect(permisos(undefined)).toEqual(PERMISOS_ABIERTOS);
		expect(puedeVerPersonal({ autenticacion: true, usuario: usuario('mesa_directiva') })).toBe(
			true
		);
		expect(
			puedeAdministrarPersonal({ autenticacion: true, usuario: usuario('mesa_directiva') })
		).toBe(false);
		expect(puedeVerPersonal({ autenticacion: true, usuario: usuario('contabilidad') })).toBe(false);
	});
});

describe('política de acceso', () => {
	it('sin cuentas todo se permite, también modificar', () => {
		const abierto: ContextoAcceso = { activada: false, usuario: null };
		expect(decidirAcceso(abierto, peticion('/catalogo', 'POST'))).toEqual(PERMITIR);
		expect(decidirAcceso(abierto, peticion('/personal/nuevo'))).toEqual(PERMITIR);
	});

	it('sin sesión lleva las páginas a /acceso recordando el destino', () => {
		expect(
			decidirAcceso(con(null), peticion('/historial', 'GET', { busqueda: '?estado=emitido' }))
		).toEqual({
			tipo: 'redirigir',
			a: '/acceso?destino=%2Fhistorial%3Festado%3Demitido'
		});
		expect(decidirAcceso(con(null), peticion('/'))).toEqual({ tipo: 'redirigir', a: '/acceso' });
	});

	it('sin sesión responde 401 a lo que no es una página: fotos, documentos y acciones', () => {
		const foto = peticion('/reportes/x/fotos/y', 'GET', { navegacion: false });
		expect(decidirAcceso(con(null), foto)).toMatchObject({ tipo: 'rechazar', estado: 401 });
		for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			expect(decidirAcceso(con(null), peticion('/reportes/x', metodo))).toMatchObject({
				tipo: 'rechazar',
				estado: 401
			});
		}
	});

	it('entrar, salir y la activación no exigen sesión', () => {
		expect(decidirAcceso(con(null), peticion('/acceso'))).toEqual(PERMITIR);
		expect(decidirAcceso(con(null), peticion('/acceso', 'POST'))).toEqual(PERMITIR);
		expect(decidirAcceso(con(null), peticion('/acceso/configurar'))).toEqual(PERMITIR);
		// Una ruta que solo empieza igual no es la de acceso.
		expect(decidirAcceso(con(null), peticion('/accesorios'))).toMatchObject({ tipo: 'redirigir' });
	});

	it('con contraseña temporal solo deja cambiarla o salir', () => {
		const temporal = con('administrador', true);
		expect(decidirAcceso(temporal, peticion('/historial'))).toEqual({
			tipo: 'redirigir',
			a: '/perfil'
		});
		expect(decidirAcceso(temporal, peticion('/catalogo', 'POST'))).toMatchObject({
			tipo: 'rechazar',
			estado: 403
		});
		expect(
			decidirAcceso(temporal, peticion('/reportes/x/fotos/y', 'GET', { navegacion: false }))
		).toMatchObject({ tipo: 'rechazar', estado: 403 });
		expect(decidirAcceso(temporal, peticion('/perfil'))).toEqual(PERMITIR);
		expect(decidirAcceso(temporal, peticion('/perfil', 'POST'))).toEqual(PERMITIR);
		expect(decidirAcceso(temporal, peticion('/acceso', 'POST'))).toEqual(PERMITIR);
	});

	it('toda persona con sesión consulta cualquier página', () => {
		for (const rol of ROLES_PERSONAL) {
			for (const ruta of [
				'/',
				'/planeacion',
				'/seguimiento',
				'/historial',
				'/reportes/x',
				'/catalogo',
				'/equipos'
			]) {
				expect(decidirAcceso(con(rol), peticion(ruta))).toEqual(PERMITIR);
			}
		}
	});

	it('modificar exige la capacidad de la ruta', () => {
		const puedeModificar = (rol: RolPersonal, ruta: string) =>
			decidirAcceso(con(rol), peticion(ruta, 'POST')).tipo === 'permitir';
		const quienes = (ruta: string) => ROLES_PERSONAL.filter((rol) => puedeModificar(rol, ruta));

		const capturan = ['administrador', 'lider_administrativo', 'lider_operativo', 'reporteador'];
		expect(quienes('/reportes/x')).toEqual(capturan);
		expect(quienes('/captura')).toEqual(capturan);
		expect(quienes('/seguimiento')).toEqual(capturan);
		expect(quienes('/planeacion')).toEqual([
			'administrador',
			'lider_administrativo',
			'lider_operativo'
		]);
		for (const ruta of ['/catalogo', '/catalogo/contratos/x', '/equipos/x', '/personal/x']) {
			expect(quienes(ruta)).toEqual(['administrador']);
		}
		expect(quienes('/perfil')).toEqual([...ROLES_PERSONAL]);
		expect(decidirAcceso(con('contabilidad'), peticion('/captura', 'POST'))).toEqual({
			tipo: 'rechazar',
			estado: 403,
			mensaje: 'No tiene permiso para hacer este cambio.'
		});
	});

	it('una ruta sin capacidad declarada solo la modifica el administrador', () => {
		for (const ruta of ['/', '/cumplimiento', '/historial', '/ruta-nueva/x']) {
			expect(decidirAcceso(con('administrador'), peticion(ruta, 'POST'))).toEqual(PERMITIR);
			expect(decidirAcceso(con('lider_administrativo'), peticion(ruta, 'DELETE'))).toMatchObject({
				tipo: 'rechazar',
				estado: 403
			});
		}
	});
});

describe('destino tras iniciar sesión', () => {
	it('acepta rutas de la aplicación con su consulta', () => {
		expect(destinoSeguro('/historial?estado=emitido')).toBe('/historial?estado=emitido');
		expect(destinoSeguro('/reportes/abc#fotos')).toBe('/reportes/abc#fotos');
	});

	it('cambia por el inicio lo externo, lo ambiguo y la propia página de acceso', () => {
		for (const destino of [
			null,
			'',
			'https://sitio.ficticio.test/',
			'//sitio.ficticio.test',
			'/\\sitio.ficticio.test',
			'/\t/sitio.ficticio.test',
			'javascript:alert(1)',
			'historial',
			'/acceso',
			'/acceso/configurar?x=1'
		]) {
			expect(destinoSeguro(destino)).toBe('/');
		}
	});
});
