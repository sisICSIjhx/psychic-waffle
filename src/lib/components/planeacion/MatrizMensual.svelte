<!-- Matriz de la vista mensual: las partidas con trabajo en el mes por semanas de lunes a domingo
     recortadas al mes (número de semana del año y días), con la semana en curso resaltada. Cada celda
     es una tarjeta con el estado de la semana, el documento y «Visualizar» (semanasDePartida). Usa los
     estilos de la matriz anual (planeacion/programa.css) dentro de .programa-anual. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { ETIQUETA_PERIODICIDAD, ocurrenciasDelMes, rangoDelPeriodo } from '$lib/dominio/captura';
	import {
		ETIQUETA_EJECUCION,
		semanasDePartida,
		type CeldaSemana,
		type EjecucionDelMes
	} from '$lib/dominio/cumplimiento';
	import type { AvancePrograma } from '$lib/dominio/esquemas';
	import { textoMes, textoOracion, textoRango } from '$lib/dominio/textos';

	/** Partidas con trabajo en el mes, en el orden del programa. */
	export let partidas: AvancePrograma['partidas'] = [];
	export let mes: string;
	export let hoy: string;
	export let ejecuciones: EjecucionDelMes[] = [];
	/** Id del título que nombra la matriz. */
	export let titulo: string;
	/** Enlace a los reportes emitidos de la partida en el mes (historial filtrado). */
	export let enlaceReportes: (partidaId: string, mes: string) => string;

	const ICONO_DOCUMENTO =
		'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>';

	/** Número de semana ISO 8601 (la del año al que pertenece el jueves de esa semana). */
	function semanaDelAnio(fecha: string): number {
		const DIA = 86_400_000;
		const instante = Date.parse(`${fecha}T00:00:00Z`);
		const jueves = instante + (3 - ((new Date(instante).getUTCDay() + 6) % 7)) * DIA;
		const inicioAnio = Date.UTC(new Date(jueves).getUTCFullYear(), 0, 1);
		return Math.floor((jueves - inicioAnio) / DIA / 7) + 1;
	}

	$: semanas = ocurrenciasDelMes('semana', mes).map((numero) => ({
		numero,
		...rangoDelPeriodo(mes, { tipo: 'semana', numero })!
	}));
	$: actual = semanas.find((s) => s.desde <= hoy && hoy <= s.hasta)?.numero ?? null;
	$: filas = partidas.map((partida) => {
		const celda = partida.celdas.find((c) => c.mes === mes);
		const propias = ejecuciones.filter((e) => e.partidaId === partida.id);
		return {
			partida,
			celdas: semanasDePartida(partida.periodicidad, celda, propias, semanas, hoy)
		};
	});

	const diaYMes = (fecha: string) => Number(fecha.slice(8, 10));
	/** «01–04 oct». */
	const textoDias = (s: { desde: string; hasta: string }) =>
		`${String(diaYMes(s.desde)).padStart(2, '0')}–${String(diaYMes(s.hasta)).padStart(2, '0')} ${textoMes(s.desde, { corto: true }).slice(0, 3)}`;

	/** «Visualizar»: el único reporte de la semana o, si son varios, los emitidos del mes. */
	function enlaceVisualizar(partidaId: string, c: CeldaSemana): string | null {
		if (c.reportes.length === 1) return resolve('/reportes/[id]', { id: c.reportes[0].id });
		const abierto = c.reportes.find((r) => r.estado !== 'emitido');
		if (abierto && !c.reportes.some((r) => r.estado === 'emitido'))
			return resolve('/reportes/[id]', { id: abierto.id });
		return c.reportes.length ? enlaceReportes(partidaId, mes) : null;
	}

	const nombreCelda = (
		numero: string,
		s: { numero: number; desde: string; hasta: string },
		c: CeldaSemana
	) =>
		`Partida ${numero}, semana ${s.numero} (${textoRango(s)}): ${ETIQUETA_EJECUCION[c.estado]}, ${c.documento}${c.detalle ? `, ${c.detalle}` : ''}`;
</script>

<section class="matriz-programa" aria-label="Matriz del mes por semanas">
	{#if filas.length === 0}
		<p class="sin-resultados">No hay partidas con trabajo en {textoMes(mes)}.</p>
	{:else}
		<div class="tabla-desplazable" role="region" aria-labelledby={titulo} tabindex="-1">
			<table class="matriz semanal">
				<thead>
					<tr class="fila-anios">
						<th scope="col" rowspan="2" class="columna-numero">#</th>
						<th scope="col" rowspan="2" class="columna-partida">Partida</th>
						<th scope="col" rowspan="2" class="columna-periodicidad">Periodicidad</th>
						{#each semanas as s (s.numero)}
							<th scope="col" class="semana" class:mes-actual={s.numero === actual}
								>Semana {semanaDelAnio(s.desde)}{s.numero === actual ? ' (actual)' : ''}</th
							>
						{/each}
					</tr>
					<tr class="fila-meses">
						{#each semanas as s (s.numero)}
							<th scope="col" class="columna-mes" class:mes-actual={s.numero === actual}
								><span aria-hidden="true">{textoDias(s)}</span><span class="sr-only"
									>{textoRango(s)}</span
								></th
							>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each filas as f (f.partida.id)}
						<tr>
							<td class="columna-numero">{f.partida.numero}</td>
							<th scope="row" class="columna-partida">{textoOracion(f.partida.actividad)}</th>
							<td class="columna-periodicidad"
								><span class="insignia-periodicidad"
									>{ETIQUETA_PERIODICIDAD[f.partida.periodicidad]}</span
								></td
							>
							{#each f.celdas as c, i (semanas[i].numero)}
								{@const s = semanas[i]}
								<td
									class="celda {c?.estado ?? 'sin_programa'}"
									class:mes-actual={s.numero === actual}
								>
									{#if c}
										{@const enlace = enlaceVisualizar(f.partida.id, c)}
										<div class="tarjeta-celda e-{c.estado}">
											<span class="sr-only">{nombreCelda(f.partida.numero, s, c)}</span>
											<span class="linea-celda estado" aria-hidden="true"
												><span class="punto"></span><span class="texto-linea"
													>{ETIQUETA_EJECUCION[c.estado]}</span
												></span
											>
											<span
												class="linea-celda documento {c.documental}"
												class:alerta={c.documental === 'sin_reporte' && c.estado === 'vencido'}
												aria-hidden="true"
												><span class="punto"></span><span class="texto-linea">{c.documento}</span
												></span
											>
											{#if enlace}
												<!-- enlaceVisualizar aplica resolve() a la ruta; los filtros van en la consulta. -->
												<!-- eslint-disable svelte/no-navigation-without-resolve -->
												<a
													class="linea-celda visualizar"
													href={enlace}
													aria-label={`Visualizar ${c.reportes.length === 1 ? 'el reporte' : 'los reportes'} de la partida ${f.partida.numero}, semana ${s.numero} de ${textoMes(mes)}`}
													><svg
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														aria-hidden="true"
														><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
														{@html ICONO_DOCUMENTO}</svg
													>Visualizar</a
												>
												<!-- eslint-enable svelte/no-navigation-without-resolve -->
											{:else}
												<span class="linea-celda visualizar inactivo" aria-hidden="true"
													><svg
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
														{@html ICONO_DOCUMENTO}</svg
													>Visualizar</span
												>
											{/if}
										</div>
									{:else}
										<span class="vacio" aria-hidden="true">—</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
