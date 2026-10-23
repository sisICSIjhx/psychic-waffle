<!-- Vista semanal de la planeación (fase 2): para la semana elegida del mes (lunes a domingo recortada
     al mes), lo que corresponde a cada partida según su periodicidad, con el estado del mes y lo que
     falta. Ninguna semana se marca vencida por sí sola. -->
<script lang="ts">
	import { rangoDelPeriodo, ocurrenciasDelMes } from '$lib/dominio/captura';
	import {
		ETIQUETA_EJECUCION,
		estadoEjecucion,
		faltan,
		semanaDePartida,
		type EjecucionDelMes
	} from '$lib/dominio/cumplimiento';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import type { AvancePrograma } from '$lib/dominio/esquemas';
	import { textoMes, textoRango } from '$lib/dominio/textos';

	export let partidas: AvancePrograma['partidas'] = [];
	export let mes: string;
	export let meses: string[] = [];
	export let semana = 1;
	export let hoy: string;
	export let ejecuciones: EjecucionDelMes[] = [];
	/** Enlace a otra semana (mes y número) con los filtros actuales. */
	export let enlaceSemana: (mes: string, semana: number) => string;

	$: semanas = ocurrenciasDelMes('semana', mes);
	$: numero = semanas.includes(semana) ? semana : semanas[0];
	$: rango = rangoDelPeriodo(mes, { tipo: 'semana', numero })!;
	$: indiceMes = meses.indexOf(mes);
	$: anterior =
		numero > 1
			? { mes, semana: numero - 1 }
			: indiceMes > 0
				? {
						mes: meses[indiceMes - 1],
						semana: ocurrenciasDelMes('semana', meses[indiceMes - 1]).at(-1)!
					}
				: null;
	$: siguiente =
		numero < semanas.length
			? { mes, semana: numero + 1 }
			: indiceMes >= 0 && indiceMes < meses.length - 1
				? { mes: meses[indiceMes + 1], semana: 1 }
				: null;
	$: filas = partidas
		.map((partida) => {
			const celda = partida.celdas.find((c) => c.mes === mes);
			const propias = ejecuciones.filter((e) => e.partidaId === partida.id);
			return {
				partida,
				celda,
				semana: semanaDePartida(partida.periodicidad, celda, propias, numero, rango)
			};
		})
		.filter(
			(f) =>
				f.semana.reportes.length > 0 ||
				(f.celda && ((f.celda.programado ?? 0) > 0 || f.celda.entrada > 0))
		);
</script>

<nav class="navegacion-semana" aria-label="Semanas del programa">
	<!-- enlaceSemana aplica resolve() a la ruta; mes y semana van en la consulta. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if anterior}
		<a class="boton" href={enlaceSemana(anterior.mes, anterior.semana)}>‹ Semana anterior</a>
	{/if}
	<h3 class="titulo-semana">
		Semana {numero} de {textoMes(mes)} ({textoRango(rango)})
	</h3>
	{#if siguiente}
		<a class="boton" href={enlaceSemana(siguiente.mes, siguiente.semana)}>Semana siguiente ›</a>
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</nav>

{#if filas.length === 0}
	<p class="view-note">No hay partidas con trabajo en esta semana.</p>
{:else}
	<div class="tabla-desplazable">
		<table>
			<thead>
				<tr>
					<th>Partida</th>
					<th>Periodicidad</th>
					<th>En la semana</th>
					<th>Estado del mes</th>
					<th>Falta en el mes</th>
				</tr>
			</thead>
			<tbody>
				{#each filas as f (f.partida.id)}
					<tr>
						<td><span class="numero">{f.partida.numero}</span> {f.partida.actividad}</td>
						<td>{ETIQUETA_PERIODICIDAD[f.partida.periodicidad]}</td>
						<td>{f.semana.texto}</td>
						<td>{f.celda ? ETIQUETA_EJECUCION[estadoEjecucion(f.celda, hoy)] : '—'}</td>
						<td>{f.celda ? faltan(f.celda) : 0}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.navegacion-semana {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		margin: 8px 0 12px;
	}
	.titulo-semana {
		margin: 0;
		font-size: 1rem;
	}
	.numero {
		font-weight: 700;
		margin-right: 4px;
	}
</style>
