<script lang="ts">
	import { clienteCaptura } from '$lib/layout/navegacion';

	export let cliente: string | null = null;

	const pasos = ['Contrato', 'Sitio', 'Partida', 'TAG', 'Periodo'];

	$: acceso = clienteCaptura(cliente);
</script>

<section class="card" aria-labelledby="titulo-captura">
	<h2 id="titulo-captura" class="view-heading">
		Nuevo reporte{acceso ? ` · ${acceso.etiqueta}` : ''}
	</h2>
	<ol class="pasos-captura">
		{#each pasos as paso (paso)}
			<li>{paso}</li>
		{/each}
	</ol>
	<p class="view-note">
		{acceso
			? `Se mostrarán solo los contratos de ${acceso.etiqueta}.`
			: 'Elige un cliente en el menú o selecciona el contrato directamente.'}
	</p>
</section>

<style>
	.pasos-captura {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0;
		margin: 0 0 12px;
		list-style: none;
		counter-reset: paso;
	}
	.pasos-captura li {
		counter-increment: paso;
		padding: 6px 12px;
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.pasos-captura li::before {
		content: counter(paso) '. ';
		font-weight: 600;
	}
</style>
