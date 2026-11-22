<script lang="ts">
	import { onMount } from 'svelte';
	import { normalizarBusqueda } from '$lib/dominio/seleccion';

	/**
	 * Varias personas de una lista: casillas con búsqueda. Sin JavaScript es la lista completa de
	 * casillas; el formulario recibe un campo `nombre` por cada persona elegida.
	 */
	export let id: string;
	export let leyenda: string;
	export let nombre: string;
	export let personas: { id: string; nombre: string }[];
	export let elegidas: string[] = [];

	let conBusqueda = false;
	let busqueda = '';
	let seleccion = [...elegidas];

	onMount(() => {
		conBusqueda = true;
	});

	$: termino = normalizarBusqueda(busqueda);
	const coincide = (termino: string, nombre: string) =>
		termino === '' || normalizarBusqueda(nombre).includes(termino);
	// Una persona ya elegida nunca se oculta: quien busca no debe perder de vista lo que marcó.
	$: ocultas = personas
		.filter((p) => !seleccion.includes(p.id) && !coincide(termino, p.nombre))
		.map((p) => p.id);
	$: sinCoincidencias = termino !== '' && personas.every((p) => !coincide(termino, p.nombre));
	$: cuenta =
		seleccion.length === 0
			? 'Nadie elegido'
			: seleccion.length === 1
				? '1 persona elegida'
				: `${seleccion.length} personas elegidas`;

	function alternar(persona: string, marcada: boolean) {
		seleccion = marcada ? [...seleccion, persona] : seleccion.filter((id) => id !== persona);
	}
</script>

<fieldset class="selector-personas">
	<legend>{leyenda}</legend>
	{#if personas.length === 0}
		<p class="view-note">No hay personal disponible.</p>
	{:else}
		{#if conBusqueda && personas.length > 6}
			<div class="buscar">
				<label for={`${id}-buscar`}>Buscar persona</label>
				<input
					id={`${id}-buscar`}
					type="search"
					autocomplete="off"
					enterkeyhint="search"
					bind:value={busqueda}
					on:keydown={(evento) => {
						// Intro no debe enviar el formulario que contiene al selector.
						if (evento.key === 'Enter') evento.preventDefault();
					}}
				/>
			</div>
		{/if}
		<ul class="lista">
			{#each personas as persona (persona.id)}
				<li hidden={ocultas.includes(persona.id)}>
					<label>
						<input
							type="checkbox"
							name={nombre}
							value={persona.id}
							checked={seleccion.includes(persona.id)}
							on:change={(evento) => alternar(persona.id, evento.currentTarget.checked)}
						/>
						<span>{persona.nombre}</span>
					</label>
				</li>
			{/each}
		</ul>
		{#if sinCoincidencias}
			<p class="view-note">Nadie coincide con «{busqueda.trim()}».</p>
		{/if}
		{#if conBusqueda}
			<p class="view-note cuenta" role="status">{cuenta}</p>
		{/if}
	{/if}
</fieldset>

<style>
	.selector-personas {
		min-width: 0;
		margin: 0 0 16px 0;
		padding: 0;
		border: none;
	}
	legend {
		padding: 0;
		margin-bottom: 6px;
		font-size: var(--texto-sm);
		font-weight: 600;
		color: var(--tinta);
	}
	.buscar {
		display: grid;
		gap: 6px;
		margin-bottom: 8px;
	}
	.buscar label {
		font-size: var(--texto-sm);
		color: var(--tinta-secundaria);
	}
	.buscar input {
		width: 100%;
	}
	.lista {
		max-height: 240px;
		margin: 0;
		padding: 4px 12px;
		overflow-y: auto;
		list-style: none;
		border: 1px solid var(--borde-campo);
		border-radius: var(--radio-control);
		background: var(--campo-fondo);
	}
	.lista li:not([hidden]) ~ li {
		border-top: 1px solid var(--linea);
	}
	.lista li[hidden] {
		display: none;
	}
	.lista label {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		cursor: pointer;
	}
	.lista span {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.cuenta {
		margin-top: 6px;
	}
</style>
