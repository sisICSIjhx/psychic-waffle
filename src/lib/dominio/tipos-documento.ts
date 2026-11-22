// Tipos de documento que genera la plataforma y el formato en que se descarga cada uno. Cada tipo
// declara su formato; quien sirve la descarga toma de aquí la extensión y el tipo MIME en vez de
// suponer que todo es Word.

export type FormatoDescarga = 'docx' | 'xlsx';

export const FORMATOS_DESCARGA: Record<
	FormatoDescarga,
	{ extension: string; mime: string; nombre: string }
> = {
	docx: {
		extension: '.docx',
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		nombre: 'Word'
	},
	xlsx: {
		extension: '.xlsx',
		mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		nombre: 'Excel'
	}
};

export const TIPOS_DOCUMENTO = {
	'reporte-mantenimiento': { nombre: 'Reporte de mantenimiento FOR-ICSI-RMT-01', formato: 'docx' },
	'reporte-fotografico': { nombre: 'Reporte fotográfico de estimación', formato: 'xlsx' }
} as const satisfies Record<string, { nombre: string; formato: FormatoDescarga }>;

export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

/** Extensión, tipo MIME y nombre del formato en que se descarga un tipo de documento. */
export function formatoDeDocumento(tipo: TipoDocumento) {
	return FORMATOS_DESCARGA[TIPOS_DOCUMENTO[tipo].formato];
}
