<!-- Celdas de una fila de la tabla del tablero: cifras y porcentajes con semáforo. -->
<script lang="ts">
	import {
		porcentajes,
		textoPorcentaje,
		UMBRALES,
		type Indicadores
	} from '$lib/dominio/cumplimiento';
	import Semaforo from './Semaforo.svelte';

	export let indicadores: Indicadores;

	$: p = porcentajes(indicadores);
</script>

<td>{indicadores.PR}</td>
<td>{indicadores.E}</td>
<td>{indicadores.R}</td>
<td>{indicadores.N}</td>
<td>{indicadores.P}</td>
<td>{indicadores.extras}</td>
<td
	>{textoPorcentaje(p.cumplimiento)}
	<Semaforo valor={p.cumplimiento} umbrales={UMBRALES.cumplimiento} /></td
>
<td
	>{textoPorcentaje(p.efectividad)}
	<Semaforo valor={p.efectividad} umbrales={UMBRALES.efectividad} /></td
>
<td>{textoPorcentaje(p.conReporte)}</td>

<style>
	td {
		white-space: nowrap;
		text-align: center;
	}
</style>
