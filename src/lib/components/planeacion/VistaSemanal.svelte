<!-- Vista semanal de la planeación: matriz de la semana elegida (lunes a domingo recortada al mes, como
     las ocurrencias de la captura) con un día por columna y hoy resaltado. Cada celda es una tarjeta
     con el estado del día, el documento y «Visualizar» (diasDePartida). Navega semana a semana dentro
     del periodo. Usa los estilos de la matriz (planeacion/programa.css) dentro de .programa-anual. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { ETIQUETA_PERIODICIDAD, ocurrenciasDelMes, rangoDelPeriodo } from '$lib/dominio/captura';
	import {
		diasDePartida,
		ETIQUETA_EJECUCION,
		partidasDelMes,
		type CeldaSemana,
		type EjecucionDelMes,
		type EstadoSemana
	} from '$lib/dominio/cumplimiento';
	import type { AvancePrograma } from '$lib/dominio/esquemas';
	import { plural, textoMes, textoOracion, textoRango } from '$lib/dominio/textos';

	export let partidas: AvancePrograma['partidas'] = [];
	export let mes: string;
	export let meses: string[] = [];
	/** Semana del mes pedida; sin ella, la que contiene hoy o la primera. */
	export let semana: number | null = null;
	export let hoy: string;
	export let ejecuciones: EjecucionDelMes[] = [];
	/** Enlace a otra semana (mes y número) con los filtros actuales. */
	export let enlaceSemana: (mes: string, semana: number) => string;
	/** Enlace a los reportes emitidos de la partida en el mes (historial filtrado). */
	export let enlaceReportes: (partidaId: string, mes: string) => string;

	const LEYENDA: EstadoSemana[] = ['ejecutado', 'pendiente', 'programado', 'vencido'];
	const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
	const ICONOS = {
		calendario:
			'<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
		documento:
			'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>'
	} as const;

	const DIA_MS = 86_400_000;
	/** Número de semana ISO 8601 (la del año al que pertenece el jueves de esa semana). */
	function semanaDelAnio(fecha: string): number {
		const instante = Date.parse(`${fecha}T00:00:00Z`);
		const jueves = instante + (3 - ((new Date(instante).getUTCDay() + 6) % 7)) * DIA_MS;
		const inicioAnio = Date.UTC(new Date(jueves).getUTCFullYear(), 0, 1);
		return Math.floor((jueves - inicioAnio) / DIA_MS / 7) + 1;
	}
	const diaDeSemana = (fecha: string) => (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7;
	const numeroDia = (fecha: string) => Number(fecha.slice(8, 10));

	$: semanas = ocurrenciasDelMes('semana', mes).map((numero) => ({
		numero,
		...rangoDelPeriodo(mes, { tipo: 'semana', numero })!
	}));
	$: elegida =
		semanas.find((s) => s.numero === semana) ??
		semanas.find((s) => s.desde <= hoy && hoy <= s.hasta) ??
		semanas[0];
	$: dias = Array.from(
		{ length: numeroDia(elegida.hasta) - numeroDia(elegida.desde) + 1 },
		(_, i) => `${elegida.desde.slice(0, 8)}${String(numeroDia(elegida.desde) + i).padStart(2, '0')}`
	);
	$: indiceMes = meses.indexOf(mes);
	$: anterior =
		elegida.numero > 1
			? { mes, semana: elegida.numero - 1 }
			: indiceMes > 0
				? {
						mes: meses[indiceMes - 1],
						semana: ocurrenciasDelMes('semana', meses[indiceMes - 1]).at(-1)!
					}
				: null;
	$: siguiente =
		elegida.numero < semanas.length
			? { mes, semana: elegida.numero + 1 }
			: indiceMes >= 0 && indiceMes < meses.length - 1
				? { mes: meses[indiceMes + 1], semana: 1 }
				: null;
	/** Partidas con trabajo en el mes, en el orden del programa, que tienen algo en la semana. */
	$: conTrabajo = new Set(partidasDelMes(partidas, mes, hoy).map((f) => f.partida.id));
	$: filas = partidas
		.filter((p) => conTrabajo.has(p.id))
		.map((partida) => ({
			partida,
			celdas: diasDePartida(
				partida.periodicidad,
				partida.celdas.find((c) => c.mes === mes),
				ejecuciones.filter((e) => e.partidaId === partida.id),
				elegida,
				hoy
			)
		}))
		.filter((f) => f.celdas.some(Boolean));

	/** «19–25 de octubre de 2026». */
	$: rangoSemana = textoRango(elegida).replace(/^del /, '').replace(' al ', '–');

	/** «Visualizar»: el único reporte del día o, si son varios, los emitidos del mes. */
	function enlaceVisualizar(partidaId: string, c: CeldaSemana): string | null {
		if (c.reportes.length === 1) return resolve('/reportes/[id]', { id: c.reportes[0].id });
		const abierto = c.reportes.find((r) => r.estado !== 'emitido');
		if (abierto && !c.reportes.some((r) => r.estado === 'emitido'))
			return resolve('/reportes/[id]', { id: abierto.id });
		return c.reportes.length ? enlaceReportes(partidaId, mes) : null;
	}

	const nombreCelda = (numero: string, dia: string, c: CeldaSemana) =>
		`Partida ${numero}, ${DIAS[diaDeSemana(dia)]} ${numeroDia(dia)} de ${textoMes(dia).replace(' ', ' de ')}: ${ETIQUETA_EJECUCION[c.estado]}, ${c.documento}${c.detalle ? `, ${c.detalle}` : ''}`;
</script>

<section class="cabecera-matriz" aria-labelledby="titulo-semanal">
	<div class="titulo-con-icono">
		<span class="icono-indicador e-total"
			><svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
				{@html ICONOS.calendario}</svg
			></span
		>
		<div>
			<h2 id="titulo-semanal" class="titulo-matriz">
				Programa semanal · Semana {semanaDelAnio(elegida.desde)}
			</h2>
			<p class="subtitulo-matriz">
				{rangoSemana} · {plural(filas.length, 'partida')} con trabajo en la semana
			</p>
		</div>
	</div>
	<ul class="leyenda" aria-label="Leyenda de la vista semanal">
		{#each LEYENDA as estado (estado)}
			<li class="e-{estado}"><span class="punto"></span>{ETIQUETA_EJECUCION[estado]}</li>
		{/each}
	</ul>
</section>

<nav class="navegacion-meses" aria-label="Semanas del programa">
	<!-- enlaceSemana aplica resolve() a la ruta; mes y semana van en la consulta. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if anterior}
		<a class="boton-programa" href={enlaceSemana(anterior.mes, anterior.semana)}
			>‹ Semana anterior</a
		>
	{/if}
	<p class="mes-semanal">Semana {semanaDelAnio(elegida.desde)} · {rangoSemana}</p>
	{#if siguiente}
		<a class="boton-programa" href={enlaceSemana(siguiente.mes, siguiente.semana)}
			>Semana siguiente ›</a
		>
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</nav>

<section class="matriz-programa" aria-label="Matriz de la semana por días">
	{#if filas.length === 0}
		<p class="sin-resultados">No hay partidas con trabajo en esta semana.</p>
	{:else}
		<div class="tabla-desplazable" role="region" aria-labelledby="titulo-semanal" tabindex="-1">
			<table class="matriz semanal por-dias">
				<thead>
					<tr class="fila-anios">
						<th scope="col" class="columna-numero">#</th>
						<th scope="col" class="columna-partida">Partida</th>
						<th scope="col" class="columna-periodicidad">Periodicidad</th>
						{#each dias as dia (dia)}
							<th scope="col" class="semana" class:mes-actual={dia === hoy}
								><span aria-hidden="true"
									>{DIAS[diaDeSemana(dia)].slice(0, 3)}
									{numeroDia(dia)}{dia === hoy ? ' (hoy)' : ''}</span
								><span class="sr-only"
									>{DIAS[diaDeSemana(dia)]} {numeroDia(dia)}{dia === hoy ? ', hoy' : ''}</span
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
							{#each f.celdas as c, i (dias[i])}
								{@const dia = dias[i]}
								<td class="celda {c?.estado ?? 'sin_programa'}" class:mes-actual={dia === hoy}>
									{#if c}
										{@const enlace = enlaceVisualizar(f.partida.id, c)}
										<div class="tarjeta-celda e-{c.estado}">
											<span class="sr-only">{nombreCelda(f.partida.numero, dia, c)}</span>
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
													aria-label={`Visualizar ${c.reportes.length === 1 ? 'el reporte' : 'los reportes'} de la partida ${f.partida.numero}, ${DIAS[diaDeSemana(dia)]} ${numeroDia(dia)}`}
													><svg
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														aria-hidden="true"
														><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
														{@html ICONOS.documento}</svg
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
														{@html ICONOS.documento}</svg
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
