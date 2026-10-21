<!-- Opciones de una sola pulsación con el patrón «radiogroup» de ARIA: un clic o las flechas eligen,
     y solo la opción elegida (o la primera, si no hay) entra en el orden de tabulación. -->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';

	export let id: string;
	/** Nombre accesible del grupo. */
	export let etiqueta: string;
	export let opciones: { valor: string; texto: string }[] = [];
	/** Valor elegido; uno que no esté en `opciones` significa ninguna opción elegida. */
	export let valor = '';
	export let disabled = false;
	export let invalido = false;
	export let describedby: string | undefined = undefined;

	const dispatch = createEventDispatcher<{ change: string }>();
	const PASOS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
	let botones: HTMLButtonElement[] = [];

	$: elegida = opciones.findIndex((o) => o.valor === valor);
	$: tabulable = elegida >= 0 ? elegida : 0;

	function elegir(indice: number) {
		if (disabled || opciones[indice].valor === valor) return;
		valor = opciones[indice].valor;
		dispatch('change', valor);
	}

	async function alTeclear(evento: KeyboardEvent, indice: number) {
		const total = opciones.length;
		const destino =
			evento.key in PASOS
				? (indice + PASOS[evento.key] + total) % total
				: evento.key === 'Home'
					? 0
					: evento.key === 'End'
						? total - 1
						: -1;
		if (destino < 0) return;
		evento.preventDefault();
		elegir(destino);
		await tick();
		botones[destino]?.focus();
	}
</script>

<div
	{id}
	class="segmentados"
	role="radiogroup"
	aria-label={etiqueta}
	aria-invalid={invalido || undefined}
	aria-describedby={describedby}
>
	{#each opciones as opcion, i (opcion.valor)}
		<button
			bind:this={botones[i]}
			class="segmento"
			type="button"
			role="radio"
			aria-checked={i === elegida}
			tabindex={i === tabulable ? 0 : -1}
			{disabled}
			on:click={() => elegir(i)}
			on:keydown={(e) => alTeclear(e, i)}
		>
			{#if i === elegida}<span class="marca" aria-hidden="true">✓</span>{/if}
			{opcion.texto}
		</button>
	{/each}
</div>

<style>
	.segmentados {
		display: inline-flex;
		flex-wrap: wrap;
		border: 1px solid var(--borde-campo);
		border-radius: 8px;
		overflow: hidden;
	}
	.segmentados[aria-invalid='true'] {
		border-color: var(--danger);
	}
	.segmento {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: var(--alto-control);
		padding: 6px 14px;
		border: 0;
		border-right: 1px solid var(--borde-campo);
		background: var(--bg);
		color: var(--text);
		cursor: pointer;
	}
	.segmento:last-child {
		border-right: 0;
	}
	.segmento[aria-checked='true'] {
		background: var(--primary-soft);
		color: var(--primary);
		font-weight: 600;
	}
	.segmento:focus-visible {
		outline-offset: -3px;
	}
	.segmento:disabled {
		cursor: not-allowed;
	}
</style>
