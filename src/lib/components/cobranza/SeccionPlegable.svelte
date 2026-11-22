<!-- Tarjeta de /cobranza que se pliega: abierta en escritorio y, en teléfono, cerrada si es de consulta
     ocasional (contrato, órdenes de compra, carta). Un <details>: funciona sin JavaScript. -->
<script lang="ts">
	/** Ancla de la sección (`contrato`, `carta`…); su título es `titulo-<id>`. */
	export let id: string;
	export let titulo: string;
	/** Texto breve junto al título (se ve también con la sección cerrada). */
	export let nota = '';
	export let abierta = true;
</script>

<section class="card seccion" {id} aria-labelledby={`titulo-${id}`}>
	<details bind:open={abierta}>
		<summary>
			<h2 class="view-heading" id={`titulo-${id}`} tabindex="-1">{titulo}</h2>
			{#if nota}<span class="view-note nota">{nota}</span>{/if}
			<svg
				class="chevron"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.25"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
			>
		</summary>
		<div class="contenido">
			<slot />
		</div>
	</details>
</section>

<style>
	.seccion {
		min-width: 0;
		scroll-margin-top: 12px;
	}
	summary {
		display: flex;
		align-items: center;
		gap: 4px 12px;
		min-height: 44px;
		padding-block: 0;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::marker {
		content: '';
	}
	h2 {
		margin: 0;
	}
	.nota {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.chevron {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		margin-left: auto;
		color: var(--tinta-secundaria);
		transition: transform 0.15s var(--curva-salida);
	}
	details[open] .chevron {
		transform: rotate(180deg);
	}
	.contenido {
		padding-top: 12px;
	}
</style>
