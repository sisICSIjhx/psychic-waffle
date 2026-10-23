<!-- Indicadores al mes de corte: PR, E, R, N, P y extras, y los tres porcentajes (cumplimiento y
     efectividad con semáforo; con reporte sin semáforo). -->
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
	$: cifras = [
		{ clave: 'PR', texto: 'Programado', valor: indicadores.PR },
		{ clave: 'E', texto: 'Ejecutado', valor: indicadores.E },
		{ clave: 'R', texto: 'Reprogramado', valor: indicadores.R },
		{ clave: 'N', texto: 'No ejecutado', valor: indicadores.N },
		{ clave: 'P', texto: 'Pendiente', valor: indicadores.P },
		{ clave: '+', texto: 'Extras', valor: indicadores.extras }
	];
	$: tarjetas = [
		{
			texto: 'Cumplimiento',
			formula: 'E / (E + N)',
			valor: p.cumplimiento,
			umbrales: UMBRALES.cumplimiento
		},
		{
			texto: 'Efectividad',
			formula: 'E / (E + R)',
			valor: p.efectividad,
			umbrales: UMBRALES.efectividad
		},
		{ texto: 'Con reporte', formula: 'con reporte / E', valor: p.conReporte, umbrales: null }
	];
</script>

<div class="porcentajes">
	{#each tarjetas as t (t.texto)}
		<div class="tarjeta">
			<p class="nombre">{t.texto} <span class="formula">{t.formula}</span></p>
			<p class="valor">{textoPorcentaje(t.valor)}</p>
			{#if t.valor === null}
				<p class="sin-datos">Sin datos</p>
			{:else if t.umbrales}
				<Semaforo valor={t.valor} umbrales={t.umbrales} />
			{/if}
		</div>
	{/each}
</div>
<dl class="cifras">
	{#each cifras as c (c.clave)}
		<div>
			<dt><abbr title={c.texto}>{c.clave}</abbr> {c.texto}</dt>
			<dd>{c.valor}</dd>
		</div>
	{/each}
</dl>

<style>
	.porcentajes {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
	}
	.tarjeta {
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.nombre,
	.valor,
	.sin-datos {
		margin: 0;
	}
	.nombre {
		font-weight: 600;
	}
	.formula {
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 400;
	}
	.valor {
		font-size: 1.8rem;
		font-weight: 700;
	}
	.sin-datos {
		color: var(--muted);
	}
	.cifras {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 20px;
		margin: 12px 0 0;
	}
	.cifras dt {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.cifras dd {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
	}
	abbr {
		text-decoration: none;
		font-weight: 700;
	}
</style>
