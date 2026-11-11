// Política de acceso de cada petición (cambio inicio-sesion-roles, D7 y D8). Función pura: con el
// estado del acceso y la petición, decide permitir, llevar a iniciar sesión o rechazar. La aplica
// `hooks.server.ts` antes de que se ejecute ninguna carga o acción.
import type { ContextoAcceso } from '../../dominio/esquemas.ts';
import { rolPuede, type Capacidad } from '../../dominio/permisos.ts';

export const RUTA_ACCESO = '/acceso';
export const RUTA_PERFIL = '/perfil';

export interface PeticionAcceso {
	/** Ruta sin la base de la aplicación. */
	ruta: string;
	/** Consulta con su «?», o cadena vacía. */
	busqueda: string;
	metodo: string;
	/** La respuesta es una página para una persona (documento HTML o los datos de una navegación). */
	navegacion: boolean;
}

export type DecisionAcceso =
	| { tipo: 'permitir' }
	| { tipo: 'redirigir'; a: string }
	| { tipo: 'rechazar'; estado: 401 | 403; mensaje: string };

/**
 * Capacidad que exige modificar algo bajo cada ruta. «sesion» basta con haber entrado. Lo que no
 * está aquí solo lo puede modificar el administrador: una ruta nueva nace cerrada.
 */
const MODIFICACIONES: readonly (readonly [prefijo: string, capacidad: Capacidad | 'sesion'])[] = [
	['/reportes', 'capturar'],
	['/captura', 'capturar'],
	['/planeacion', 'ajustarPrograma'],
	['/seguimiento', 'editarSeguimiento'],
	// Cada acción comprueba su capacidad: contrato, enlace del programa o cobranza.
	['/cobranza', 'sesion'],
	['/catalogo', 'editarCatalogo'],
	['/equipos', 'editarCatalogo'],
	['/personal', 'administrarPersonal'],
	[RUTA_PERFIL, 'sesion']
];

const PERMITIR: DecisionAcceso = { tipo: 'permitir' };

const bajo = (ruta: string, prefijo: string) => ruta === prefijo || ruta.startsWith(`${prefijo}/`);

/**
 * Destino tras iniciar sesión: solo una ruta de esta aplicación. Una dirección externa, una ruta
 * que el navegador pueda leer como externa («//sitio», barras invertidas o caracteres de control)
 * o la propia página de acceso se cambian por el inicio.
 */
export function destinoSeguro(destino: string | null | undefined): string {
	if (!destino || !destino.startsWith('/') || destino.startsWith('//')) return '/';
	// eslint-disable-next-line no-control-regex -- se rechazan justo los caracteres de control
	if (/[\\\u0000-\u001f\u007f]/.test(destino)) return '/';
	if (bajo(destino.split(/[?#]/)[0], RUTA_ACCESO)) return '/';
	return destino;
}

export function decidirAcceso(contexto: ContextoAcceso, peticion: PeticionAcceso): DecisionAcceso {
	// Sin cuentas todavía, la aplicación funciona abierta como antes de este cambio.
	if (!contexto.activada) return PERMITIR;
	const { ruta, metodo } = peticion;
	// Entrar, salir y la activación: cada página decide qué mostrar según haya sesión o no.
	if (bajo(ruta, RUTA_ACCESO)) return PERMITIR;
	const lectura = metodo === 'GET' || metodo === 'HEAD';
	const usuario = contexto.usuario;
	if (!usuario) {
		if (lectura && peticion.navegacion) {
			const destino = destinoSeguro(ruta + peticion.busqueda);
			return {
				tipo: 'redirigir',
				a: destino === '/' ? RUTA_ACCESO : `${RUTA_ACCESO}?destino=${encodeURIComponent(destino)}`
			};
		}
		return { tipo: 'rechazar', estado: 401, mensaje: 'Su sesión terminó. Inicie sesión de nuevo.' };
	}
	// Con una contraseña temporal solo se puede cambiarla (o salir).
	if (usuario.debeCambiar && !bajo(ruta, RUTA_PERFIL)) {
		if (lectura && peticion.navegacion) return { tipo: 'redirigir', a: RUTA_PERFIL };
		return {
			tipo: 'rechazar',
			estado: 403,
			mensaje: 'Cambie su contraseña temporal para continuar.'
		};
	}
	if (lectura) return PERMITIR;
	const regla = MODIFICACIONES.find(([prefijo]) => bajo(ruta, prefijo));
	const permitido = regla
		? regla[1] === 'sesion' || rolPuede(usuario.rol, regla[1])
		: usuario.rol === 'administrador';
	return permitido
		? PERMITIR
		: { tipo: 'rechazar', estado: 403, mensaje: 'No tiene permiso para hacer este cambio.' };
}
