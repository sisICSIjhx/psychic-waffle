<!-- Selector con búsqueda (patrón «combobox» de ARIA 1.2): se escribe para filtrar, las flechas
     recorren las opciones agrupadas, Enter elige y Esc cierra. El foco se queda en el campo; la opción
     activa se anuncia con aria-activedescendant. -->
<script lang="ts" module>
	export interface OpcionSelector {
		valor: string;
		texto: string;
		grupo: string;
		/** Estado breve junto al texto (p. ej., «Vencida · junio 2026»). */
		insignia?: string;
		/** Símbolo de la insignia; es decorativo, el texto ya dice el estado. */
		icono?: string;
		/** Línea secundaria (p. ej., la periodicidad). */
		detalle?: string;
	}
</script>

<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { normalizarBusqueda } from '$lib/dominio/seleccion';

	export let id: string;
	export let etiqueta: string;
	export let opciones: OpcionSelector[] = [];
	/** Grupos en el orden en que se muestran; los vacíos no aparecen. */
	export let grupos: { clave: string; titulo: string }[] = [];
	export let valor: string | null = null;
	export let placeholder = 'Escriba para buscar';
	/** Filtro de las opciones; por omisión, todas las palabras sin acentos ni mayúsculas. */
	export let filtrar: (opciones: OpcionSelector[], consulta: string) => OpcionSelector[] = (
		lista,
		consulta
	) => {
		const palabras = normalizarBusqueda(consulta).split(' ').filter(Boolean);
		return lista.filter((o) =>
			palabras.every((p) => normalizarBusqueda(`${o.texto} ${o.detalle ?? ''}`).includes(p))
		);
	};

	const dispatch = createEventDispatcher<{ elegir: string }>();

	let consulta = opciones.find((o) => o.valor === valor)?.texto ?? '';
	let abierto = false;
	let activa: string | null = null;
	let lista: HTMLElement | undefined;

	$: elegida = opciones.find((o) => o.valor === valor) ?? null;
	// Con la opción elegida a la vista, el campo muestra todas; al escribir, filtra.
	$: filtradas = elegida && consulta === elegida.texto ? opciones : filtrar(opciones, consulta);
	$: visibles = grupos
		.map((g) => ({ ...g, opciones: filtradas.filter((o) => o.grupo === g.clave) }))
		.filter((g) => g.opciones.length);
	$: orden = visibles.flatMap((g) => g.opciones);
	$: if (activa && !orden.some((o) => o.valor === activa)) activa = null;

	const idOpcion = (o: OpcionSelector) => `${id}-opcion-${o.valor}`;

	async function mover(paso: 1 | -1) {
		if (!orden.length) return;
		abierto = true;
		const actual = orden.findIndex((o) => o.valor === activa);
		const siguiente =
			actual < 0
				? paso === 1
					? 0
					: orden.length - 1
				: (actual + paso + orden.length) % orden.length;
		activa = orden[siguiente].valor;
		await tick();
		lista?.querySelector(`#${CSS.escape(idOpcion(orden[siguiente]))}`)?.scrollIntoView({
			block: 'nearest'
		});
	}

	function elegir(opcion: OpcionSelector) {
		consulta = opcion.texto;
		abierto = false;
		activa = null;
		if (opcion.valor !== valor) {
			valor = opcion.valor;
			dispatch('elegir', opcion.valor);
		}
	}

	function teclear(evento: KeyboardEvent) {
		if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
			evento.preventDefault();
			mover(evento.key === 'ArrowDown' ? 1 : -1);
		} else if (evento.key === 'Enter') {
			// Un combobox no envía el formulario que lo contiene.
			evento.preventDefault();
			const opcion =
				orden.find((o) => o.valor === activa) ?? (orden.length === 1 ? orden[0] : null);
			if (abierto && opcion) elegir(opcion);
		} else if (evento.key === 'Escape' && abierto) {
			evento.preventDefault();
			abierto = false;
			activa = null;
		}
	}

	function escribir() {
		abierto = true;
		activa = null;
	}

	/** Al salir sin elegir, el campo vuelve a mostrar la opción elegida. */
	function salir() {
		abierto = false;
		activa = null;
		if (elegida) consulta = elegida.texto;
	}
</script>

<div class="selector">
	<label for={id}>{etiqueta}</label>
	<input
		{id}
		type="text"
		role="combobox"
		autocomplete="off"
		aria-autocomplete="list"
		aria-expanded={abierto}
		aria-controls={`${id}-lista`}
		aria-activedescendant={abierto && activa ? `${id}-opcion-${activa}` : undefined}
		{placeholder}
		bind:value={consulta}
		on:input={escribir}
		on:focus={() => (abierto = true)}
		on:click={() => (abierto = true)}
		on:keydown={teclear}
		on:blur={salir}
	/>
	<div
		bind:this={lista}
		id={`${id}-lista`}
		class="lista"
		role="listbox"
		aria-label={etiqueta}
		hidden={!abierto || !orden.length}
	>
		{#each visibles as grupo (grupo.clave)}
			<div class="grupo" role="group" aria-labelledby={`${id}-grupo-${grupo.clave}`}>
				<div id={`${id}-grupo-${grupo.clave}`} class="titulo-grupo" role="presentation">
					{grupo.titulo}
				</div>
				{#each grupo.opciones as opcion (opcion.valor)}
					<div
						id={idOpcion(opcion)}
						class="opcion"
						class:activa={opcion.valor === activa}
						class:elegida={opcion.valor === valor}
						role="option"
						tabindex="-1"
						aria-selected={opcion.valor === activa}
						on:mousedown|preventDefault={() => elegir(opcion)}
					>
						<span class="texto">{opcion.texto}</span>
						{#if opcion.insignia}<span class="insignia"
								>{#if opcion.icono}<span class="icono" aria-hidden="true">{opcion.icono}</span>
								{/if}{opcion.insignia}</span
							>{/if}
						{#if opcion.detalle}<span class="detalle">{opcion.detalle}</span>{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
	<p class="resultado" role="status">
		{#if abierto && !orden.length}
			Ninguna opción coincide con «{consulta}».
		{/if}
	</p>
</div>

<style>
	.selector {
		position: relative;
		display: grid;
		gap: 6px;
	}
	label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--muted);
	}
	input {
		width: 100%;
	}
	.lista {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 5;
		max-height: min(420px, 60vh);
		overflow-y: auto;
		margin-top: 4px;
		padding: 4px;
		border: 1px solid var(--borde-campo);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	.lista[hidden] {
		display: none;
	}
	.titulo-grupo {
		padding: 8px 8px 4px;
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.opcion {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2px 12px;
		align-items: center;
		min-height: var(--objetivo-min);
		padding: 6px 8px;
		border-radius: 6px;
		cursor: pointer;
	}
	.opcion:hover,
	.opcion.activa {
		background: var(--primary-soft);
	}
	.opcion.activa {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}
	.opcion.elegida .texto {
		font-weight: 600;
	}
	.icono {
		margin-right: 4px;
	}
	.insignia {
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.detalle {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 0.8rem;
	}
	/* Sobre el fondo de la opción activa el gris atenuado no llega a 4.5:1. */
	.opcion:hover .detalle,
	.opcion.activa .detalle {
		color: var(--text);
	}
	.resultado {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.resultado:empty {
		display: none;
	}
</style>
