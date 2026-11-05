<!-- Índice del reporte: avance persistente, una entrada por sección con su completitud (icono, texto y
     cuenta) y los alcances bajo «Alcance» cuando es la sección abierta. Elegir una entrada muestra esa
     sección sin perder lo escrito. En escritorio es una columna fija; en pantallas angostas se
     despliega con un botón. -->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { plural } from '$lib/dominio/textos';

	type Entrada = { id: string; texto: string; pendientes: number };

	export let entradas: Entrada[] = [];
	/** Alcances, mostrados bajo la sección `conSubentradas` cuando está activa. */
	export let subentradas: Entrada[] = [];
	export let conSubentradas = '';
	export let activa = '';
	export let subactiva = '';
	/** Sin datos por revisar (p. ej., un reporte emitido) no se marcan pendientes ni completos. */
	export let conCompletitud = true;
	/** Resumen del primer pendiente («Firmas: faltan 3 nombres») y el texto del enlace que lleva a él. */
	export let resumenPendiente = '';
	export let textoIrPendiente = '';

	const dispatch = createEventDispatcher<{
		ir: { seccion: string; subentrada?: string };
		pendiente: void;
	}>();
	let abierto = false;
	let lista: HTMLOListElement | undefined;

	$: completas = entradas.filter((e) => e.pendientes === 0).length;
	$: total = entradas.reduce((suma, e) => suma + e.pendientes, 0);

	function ir(seccion: string, subentrada?: string) {
		abierto = false;
		dispatch('ir', { seccion, subentrada });
	}

	/** Lleva el foco a la entrada activa (desde «Índice del documento»). */
	export async function enfocar() {
		abierto = true;
		await tick();
		lista?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
	}
</script>

<nav id="indice-reporte" class="indice" aria-label="Secciones del reporte">
	<button
		class="boton alternar-indice"
		type="button"
		aria-expanded={abierto}
		aria-controls="lista-indice"
		on:click={() => (abierto = !abierto)}
	>
		Secciones{conCompletitud ? ` · ${total ? `faltan ${total}` : 'completo'}` : ''}
	</button>

	<div class="avance">
		<p class="rotulo-grupo">Contenido del reporte</p>
		{#if conCompletitud}
			<p class="cuenta-secciones">
				{completas} de {plural(entradas.length, 'sección completa', 'secciones completas')}
			</p>
			<progress class="barra" max={entradas.length} value={completas}
				>{completas} de {entradas.length}</progress
			>
			{#if resumenPendiente}<p class="resumen-pendiente">{resumenPendiente}</p>{/if}
		{/if}
	</div>

	<ol id="lista-indice" class="lista-indice" class:abierto bind:this={lista}>
		{#each entradas as entrada (entrada.id)}
			{@const esActiva = entrada.id === activa}
			<li>
				<a
					href={`#seccion-${entrada.id}`}
					class:activa={esActiva}
					aria-current={esActiva ? 'true' : undefined}
					on:click|preventDefault={() => ir(entrada.id)}
				>
					{#if conCompletitud}
						<span class="marca" class:pendiente={entrada.pendientes > 0}
							>{#if entrada.pendientes > 0}<svg viewBox="0 0 24 24" aria-hidden="true"
									><circle
										cx="12"
										cy="12"
										r="7"
										fill="none"
										stroke="currentColor"
										stroke-width="2.25"
									/></svg
								>{:else}<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg
								>{/if}</span
						>
					{/if}
					<span class="texto-entrada"
						>{entrada.texto}{#if conCompletitud && entrada.pendientes > 0}<span aria-hidden="true"
								>{` · ${entrada.pendientes}`}</span
							>{/if}{#if conCompletitud}<span class="sr-only"
								>{entrada.pendientes > 0
									? `, ${plural(entrada.pendientes, 'pendiente')}`
									: ', completo'}</span
							>{/if}</span
					>
				</a>
				{#if esActiva && entrada.id === conSubentradas && subentradas.length}
					<ol class="subentradas">
						{#each subentradas as sub (sub.id)}
							<li>
								<a
									href={`#alcance-${sub.id}`}
									class:activa={sub.id === subactiva}
									class:pendiente={conCompletitud && sub.pendientes > 0}
									on:click|preventDefault={() => ir(entrada.id, sub.id)}
									>{sub.texto}{#if conCompletitud && sub.pendientes > 0}<span class="sr-only"
											>, {plural(sub.pendientes, 'pendiente')}</span
										>{/if}</a
								>
							</li>
						{/each}
					</ol>
				{/if}
			</li>
		{/each}
	</ol>

	{#if conCompletitud && textoIrPendiente}
		<div class="pie-indice">
			<p>Puede abrir cualquier sección sin perder los cambios.</p>
			<button class="ir-pendiente" type="button" on:click={() => dispatch('pendiente')}
				>{textoIrPendiente}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg
				></button
			>
		</div>
	{/if}
</nav>

<style>
	.indice {
		display: grid;
		gap: 20px;
		align-content: start;
		font-size: var(--texto-base);
	}
	.alternar-indice {
		width: 100%;
		justify-content: flex-start;
	}
	.avance {
		display: none;
		gap: 8px;
	}
	.cuenta-secciones {
		margin: 4px 0 0;
		font-weight: 600;
	}
	.barra {
		width: 100%;
		height: 4px;
		border: 0;
		border-radius: 2px;
		background: var(--linea);
		overflow: hidden;
		appearance: none;
	}
	.barra::-webkit-progress-bar {
		background: var(--linea);
	}
	.barra::-webkit-progress-value {
		background: var(--accion);
	}
	.barra::-moz-progress-bar {
		background: var(--accion);
	}
	.resumen-pendiente {
		margin: 0;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.lista-indice {
		display: none;
		list-style: none;
		margin: 0;
		padding: 6px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-panel);
		background: var(--superficie);
	}
	.lista-indice.abierto {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 4px;
	}
	.lista-indice li {
		min-width: 0;
	}
	.lista-indice a {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 6px 10px;
		border-radius: var(--radio-control);
		color: var(--tinta);
	}
	.lista-indice a:hover {
		background: var(--superficie-hover);
	}
	.lista-indice a.activa {
		background: var(--accion-suave);
		color: var(--accion);
		font-weight: 600;
	}
	.marca {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		color: var(--accion);
	}
	.marca svg {
		width: 14px;
		height: 14px;
	}
	.marca.pendiente {
		color: var(--alerta);
	}
	.texto-entrada {
		flex: 1;
		min-width: 0;
	}
	.subentradas {
		display: grid;
		gap: 2px;
		margin: 4px 0 4px 28px;
		padding: 0;
		list-style: none;
	}
	.lista-indice .subentradas a {
		min-height: 32px;
		padding: 4px 0;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
		line-height: 1.4;
	}
	.lista-indice .subentradas a:hover {
		background: none;
		color: var(--tinta);
		text-decoration: underline;
	}
	.lista-indice .subentradas a.activa {
		background: none;
		color: var(--accion);
		font-weight: 400;
	}
	.lista-indice .subentradas a.pendiente {
		color: var(--alerta);
	}
	.pie-indice {
		display: none;
		gap: 8px;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.pie-indice p {
		margin: 0;
	}
	.ir-pendiente {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		justify-self: start;
		min-height: var(--objetivo-min);
		padding: 0;
		border: 0;
		background: none;
		color: var(--accion);
		font-size: var(--texto-base);
		font-weight: 600;
		cursor: pointer;
	}
	.ir-pendiente:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.ir-pendiente svg {
		width: 15px;
		height: 15px;
	}
	/* En escritorio el índice es una columna fija junto al contenido. */
	@media (min-width: 1100px) {
		.indice {
			position: sticky;
			top: 24px;
		}
		.alternar-indice {
			display: none;
		}
		.avance,
		.pie-indice {
			display: grid;
		}
		/* En la columna, el índice va sobre el lienzo sin caja propia. */
		.lista-indice {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
			padding: 0;
			border: none;
			background: none;
		}
	}
</style>
