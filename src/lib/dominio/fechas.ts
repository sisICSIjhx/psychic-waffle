// Fecha de calendario en la zona horaria del negocio. `toISOString()` da la fecha en UTC, que en
// México ya es el día siguiente durante las últimas horas de la tarde y la noche.

export const ZONA_HORARIA = 'America/Mexico_City';

/** Fecha «AAAA-MM-DD» del instante dado en la zona indicada. */
export function fechaEnZona(instante: Date = new Date(), zona: string = ZONA_HORARIA): string {
	// El formato canadiense en inglés es AAAA-MM-DD.
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: zona,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(instante);
}
