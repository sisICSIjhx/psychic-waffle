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
	/* Tres lecturas en columnas, sin caja propia: el panel ya las agrupa. */
	.porcentajes {
		display: grid;
		gap: 16px 32px;
		grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
	}
	.tarjeta {
		display: grid;
		gap: 2px;
		align-content: start;
		justify-items: start;
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
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
		font-weight: 400;
	}
	.valor {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.sin-datos {
		color: var(--tinta-tenue);
	}
	.cifras {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 32px;
		margin: 20px 0 0;
		padding-top: 16px;
		border-top: 1px solid var(--linea);
	}
	.cifras dt {
		font-size: var(--texto-xs);
		color: var(--tinta-tenue);
	}
	.cifras dd {
		margin: 0;
		font-size: var(--texto-lg);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	abbr {
		text-decoration: none;
		font-weight: 700;
	}
</style>
