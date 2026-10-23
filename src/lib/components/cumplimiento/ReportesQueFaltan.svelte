<!-- Reportes que faltan en los meses evaluados, en tres grupos (borradores abiertos, vencidos sin
     reporte y ejecutados sin reporte), 10 por grupo y el resto bajo «Ver los N». -->
<script lang="ts">
	import type { ReporteQueFalta } from '$lib/dominio/cumplimiento';
	import ElementoQueFalta from './ElementoQueFalta.svelte';

	export let abiertos: ReporteQueFalta[] = [];
	export let vencidos: ReporteQueFalta[] = [];
	export let ejecutadosSinReporte: ReporteQueFalta[] = [];

	const VISIBLES = 10;

	$: grupos = [
		{ clave: 'abiertos', titulo: 'Borradores abiertos', lista: abiertos },
		{ clave: 'vencidos', titulo: 'Vencidos sin reporte', lista: vencidos },
		{ clave: 'ejecutados', titulo: 'Ejecutados sin reporte', lista: ejecutadosSinReporte }
	];
</script>

{#each grupos as g (g.clave)}
	<section class="grupo" aria-labelledby={`faltan-${g.clave}`}>
		<h3 id={`faltan-${g.clave}`}>{g.titulo} ({g.lista.length})</h3>
		{#if g.lista.length === 0}
			<p class="view-note">Ninguno.</p>
		{:else}
			<ul class="lista">
				{#each g.lista.slice(0, VISIBLES) as r (`${r.partidaId}-${r.mes}`)}
					<li><ElementoQueFalta reporte={r} /></li>
				{/each}
			</ul>
			{#if g.lista.length > VISIBLES}
				<details>
					<summary>Ver los {g.lista.length}</summary>
					<ul class="lista">
						{#each g.lista.slice(VISIBLES) as r (`${r.partidaId}-${r.mes}`)}
							<li><ElementoQueFalta reporte={r} /></li>
						{/each}
					</ul>
				</details>
			{/if}
		{/if}
	</section>
{/each}

<style>
	.grupo h3 {
		margin: 12px 0 4px;
		font-size: 0.95rem;
	}
	.lista {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 4px;
	}
</style>
