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
	/** Trazos de las fichas de icono (24 × 24, línea de 2 px). */
	const ICONOS = {
		meta: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
		rayo: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
		documento:
			'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M9 15l2 2 4-4"/>'
	};

	$: tarjetas = [
		{
			texto: 'Cumplimiento',
			tono: 'azul',
			icono: ICONOS.meta,
			formula: 'E / (E + N)',
			valor: p.cumplimiento,
			umbrales: UMBRALES.cumplimiento
		},
		{
			texto: 'Efectividad',
			tono: 'verde',
			icono: ICONOS.rayo,
			formula: 'E / (E + R)',
			valor: p.efectividad,
			umbrales: UMBRALES.efectividad
		},
		{
			texto: 'Con reporte',
			tono: 'violeta',
			icono: ICONOS.documento,
			formula: 'con reporte / E',
			valor: p.conReporte,
			umbrales: null
		}
	];
</script>

<div class="porcentajes">
	{#each tarjetas as t (t.texto)}
		<div class="tarjeta tono-{t.tono}">
			<span class="ficha" aria-hidden="true"
				><svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
					{@html t.icono}</svg
				></span
			>
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
	/* Tres lecturas como tarjetas de DashStack: nombre, cifra, semáforo y ficha de icono a la derecha. */
	.porcentajes {
		display: grid;
		gap: 16px;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
	}
	.tarjeta {
		--ficha: var(--ficha-azul);
		--ficha-icono: var(--ficha-azul-icono);
		position: relative;
		display: grid;
		gap: 4px;
		align-content: start;
		justify-items: start;
		padding: 18px 84px 18px 20px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-panel);
	}
	.tono-verde {
		--ficha: var(--ficha-verde);
		--ficha-icono: var(--ficha-verde-icono);
	}
	.tono-violeta {
		--ficha: var(--ficha-violeta);
		--ficha-icono: var(--ficha-violeta-icono);
	}
	.ficha {
		position: absolute;
		top: 18px;
		right: 18px;
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: var(--ficha);
		color: var(--ficha-icono);
	}
	.ficha svg {
		width: 24px;
		height: 24px;
	}
	.nombre,
	.valor,
	.sin-datos {
		margin: 0;
	}
	.nombre {
		color: var(--tinta-secundaria);
		font-weight: 700;
	}
	.formula {
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
		font-weight: 400;
	}
	.valor {
		font-size: 2rem;
		font-weight: 800;
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
		gap: 8px;
		margin: 16px 0 0;
	}
	/* Cada cifra en una pastilla gris, como los filtros de DashStack. */
	.cifras > div {
		min-width: 110px;
		padding: 10px 16px;
		border-radius: 12px;
		background: var(--superficie-alta);
	}
	.cifras dt {
		font-size: var(--texto-xs);
		color: var(--tinta-tenue);
	}
	.cifras dd {
		margin: 0;
		font-size: var(--texto-lg);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	abbr {
		text-decoration: none;
		font-weight: 700;
	}
</style>
