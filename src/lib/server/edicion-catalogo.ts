// Traduce el formulario de una corrección del contrato, un sitio o un firmante a la edición del
// repositorio (D11). Las acciones `ensayarCambio` y `aplicarCambio` de /catalogo/contratos/[id] usan
// los mismos campos: el ensayo calcula el cambio y su impacto y la aplicación lo guarda con motivo.
import { validarMotivo } from '../dominio/bitacora.ts';
import type { ResultadoEdicion } from '../dominio/esquemas.ts';
import type { ContextoBitacora, RepositorioCatalogo } from './repositorios/catalogo.ts';

export const TIPOS_CAMBIO = [
	'contrato',
	'sitio',
	'quitarSitio',
	'corregirFirmante',
	'cambiarFirmante'
] as const;
export type TipoCambio = (typeof TIPOS_CAMBIO)[number];

/** Campos de cada tipo de cambio que viajan del formulario al diálogo y de vuelta. */
const CAMPOS: Record<TipoCambio, string[]> = {
	contrato: ['actualizadoEn', 'numero', 'descripcion', 'vigenciaInicio', 'vigenciaFin'],
	sitio: ['sitioId', 'actualizadoEn', 'clave', 'nombre'],
	quitarSitio: ['sitioId'],
	corregirFirmante: [
		'firmanteId',
		'actualizadoEn',
		'nombre',
		'cargo',
		'empresa',
		'vigenteDesde',
		'vigenteHasta'
	],
	cambiarFirmante: ['firmanteId', 'actualizadoEn', 'desde', 'nombre', 'cargo', 'empresa']
};

export class ErrorCambio extends Error {
	constructor(mensaje: string) {
		super(mensaje);
		this.name = 'ErrorCambio';
	}
}

export interface CambioLeido {
	tipo: TipoCambio;
	/** Campos tal como llegaron, para reenviarlos al confirmar. */
	campos: Record<string, string>;
}

export function leerCambio(formulario: FormData): CambioLeido {
	const tipo = String(formulario.get('tipo') ?? '') as TipoCambio;
	if (!TIPOS_CAMBIO.includes(tipo)) throw new ErrorCambio('Tipo de cambio no válido.');
	const campos: Record<string, string> = { tipo };
	for (const campo of CAMPOS[tipo]) campos[campo] = String(formulario.get(campo) ?? '').trim();
	return { tipo, campos };
}

/** Datos con que el formulario indica qué se aplica: motivo y propagación a los borradores. */
export function leerConfirmacion(formulario: FormData): {
	motivo: string;
	actualizarBorradores: boolean;
} {
	const motivo = String(formulario.get('motivo') ?? '');
	const { valido, mensaje } = validarMotivo(motivo);
	if (!valido) throw new ErrorCambio(`Indique el motivo del cambio. ${mensaje}`);
	return {
		motivo: motivo.trim(),
		actualizarBorradores: formulario.get('actualizarBorradores') === 'on'
	};
}

/**
 * Ejecuta el cambio del contrato `contratoId`: en ensayo calcula cambios e impacto; con `motivo`
 * lo aplica y lo registra en la bitácora con el contexto de la sesión.
 */
export async function ejecutarCambio(
	catalogo: RepositorioCatalogo,
	contratoId: string,
	{ tipo, campos }: CambioLeido,
	opciones: ContextoBitacora & {
		ensayo: boolean;
		motivo?: string;
		actualizarBorradores?: boolean;
	}
): Promise<ResultadoEdicion> {
	const c = campos;
	switch (tipo) {
		case 'contrato':
			return catalogo.editarContrato(
				{
					id: contratoId,
					actualizadoEn: c.actualizadoEn,
					numero: c.numero,
					descripcion: c.descripcion || null,
					vigenciaInicio: c.vigenciaInicio,
					vigenciaFin: c.vigenciaFin
				},
				opciones
			);
		case 'sitio':
			return catalogo.editarSitio(
				{
					id: c.sitioId,
					contratoId,
					actualizadoEn: c.actualizadoEn,
					clave: c.clave,
					nombre: c.nombre
				},
				opciones
			);
		case 'quitarSitio':
			return catalogo.quitarSitio({ contratoId, sitioId: c.sitioId }, opciones);
		case 'corregirFirmante':
			return catalogo.corregirFirmante(
				{
					id: c.firmanteId,
					contratoId,
					actualizadoEn: c.actualizadoEn,
					nombre: c.nombre,
					cargo: c.cargo,
					empresa: c.empresa,
					vigenteDesde: c.vigenteDesde,
					vigenteHasta: c.vigenteHasta || null
				},
				opciones
			);
		case 'cambiarFirmante':
			return catalogo.cambiarFirmante(
				{
					id: c.firmanteId,
					contratoId,
					actualizadoEn: c.actualizadoEn,
					desde: c.desde,
					nombre: c.nombre,
					cargo: c.cargo,
					empresa: c.empresa
				},
				opciones
			);
	}
}
