<!-- Índice de secciones y alcances del reporte con su completitud (icono y texto). En escritorio es
     una columna fija; en pantallas angostas se despliega con un botón. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { plural } from '$lib/dominio/textos';

	export let entradas: { id: string; texto: string; pendientes: number; nivel: 0 | 1 }[] = [];
	export let total = 0;
	/** Sin datos por revisar (p. ej., un reporte emitido) no se marcan pendientes ni completos. */
	export let conCompletitud = true;

	const dispatch = createEventDispatcher<{ ir: string }>();
	let abierto = false;

	function ir(id: string) {
		abierto = false;
		dispatch('ir', id);
	}
</script>

<nav class="indice" aria-label="Secciones del reporte">
	<button
		class="boton alternar-indice"
		type="button"
		aria-expanded={abierto}
		aria-controls="lista-indice"
		on:click={() => (abierto = !abierto)}
	>
		Secciones{conCompletitud ? ` · ${total ? `faltan ${total}` : 'completo'}` : ''}
	</button>
	<ol id="lista-indice" class="lista-indice" class:abierto>
		{#each entradas as entrada (entrada.id)}
			<li class:subnivel={entrada.nivel === 1}>
				<a href={`#${entrada.id}`} on:click|preventDefault={() => ir(entrada.id)}>
					{#if conCompletitud}
						<span class="marca" class:pendiente={entrada.pendientes > 0} aria-hidden="true"
							>{entrada.pendientes > 0 ? '!' : '✓'}</span
						>
					{/if}
					<span class="texto-entrada"
						>{entrada.texto}{#if conCompletitud}<span class="sr-only"
								>{entrada.pendientes > 0
									? `, ${plural(entrada.pendientes, 'pendiente')}`
									: ', completo'}</span
							>{/if}</span
					>
					{#if conCompletitud && entrada.pendientes > 0}
						<span class="cuenta" aria-hidden="true">{entrada.pendientes}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.indice {
		font-size: 0.9rem;
	}
	.alternar-indice {
		width: 100%;
		justify-content: flex-start;
	}
	.lista-indice {
		display: none;
		list-style: none;
		margin: 8px 0 0;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-soft);
	}
	.lista-indice.abierto {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 2px;
	}
	.lista-indice li {
		min-width: 0;
	}
	.lista-indice a {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--objetivo-min);
		padding: 4px 8px;
		border-radius: 6px;
		color: var(--text);
	}
	.lista-indice a:hover {
		background: var(--hover);
	}
	.subnivel a {
		padding-left: 24px;
		font-size: 0.85rem;
	}
	.marca {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--success-bg);
		color: var(--success);
		font-size: 0.75rem;
		font-weight: 700;
	}
	.marca.pendiente {
		background: var(--danger-bg);
		color: var(--danger);
	}
	.texto-entrada {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cuenta {
		color: var(--danger);
		font-weight: 600;
	}
	/* En escritorio el índice es una columna fija junto al contenido. */
	@media (min-width: 1100px) {
		.indice {
			position: sticky;
			top: 56px;
		}
		.alternar-indice {
			display: none;
		}
		.lista-indice {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 2px;
			margin: 0;
		}
	}
</style>
