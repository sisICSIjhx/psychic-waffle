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

	// La marca de la opción llega como símbolo corto y se dibuja como icono: alerta, reloj o lápiz.
	const ICONOS: Record<string, string> = {
		'!': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v5M12 16.5h.01',
		'●': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',
		'✎': 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'
	};

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
						aria-selected={opcion.valor === valor}
						on:mousedown|preventDefault={() => elegir(opcion)}
					>
						<span class="texto">{opcion.texto}</span>
						{#if opcion.insignia}<span
								class="insignia"
								class:insignia-peligro={opcion.icono === '!'}
								class:insignia-info={opcion.icono === '●'}
								>{#if opcion.icono && ICONOS[opcion.icono]}<svg
										class="icono"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.25"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"><path d={ICONOS[opcion.icono]} /></svg
									>{/if}{opcion.insignia}</span
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
		gap: 4px;
	}
	label {
		font-size: var(--texto-sm);
		font-weight: 500;
		color: var(--tinta-secundaria);
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
		border: 1px solid var(--linea-fuerte);
		border-radius: var(--radio-flotante);
		background: var(--superficie-flotante);
		box-shadow: var(--sombra-flotante);
	}
	.lista[hidden] {
		display: none;
	}
	.titulo-grupo {
		padding: 8px 8px 4px;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
		font-weight: 600;
	}
	.opcion {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2px 12px;
		align-items: center;
		min-height: var(--objetivo-min);
		padding: 6px 8px;
		border-radius: var(--radio-control);
		cursor: pointer;
	}
	.opcion:hover {
		background: var(--superficie-hover);
	}
	.opcion.activa {
		background: var(--accion-suave);
		box-shadow: inset 0 0 0 1px var(--accion);
	}
	.opcion.elegida .texto {
		font-weight: 600;
	}
	.icono {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}
	.insignia {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--tinta-secundaria);
		font-size: var(--texto-xs);
		font-weight: 600;
		white-space: nowrap;
	}
	.insignia-peligro {
		color: var(--peligro);
	}
	.insignia-info {
		color: var(--info);
	}
	.detalle {
		grid-column: 1 / -1;
		color: var(--tinta-tenue);
		font-size: var(--texto-sm);
	}
	/* Sobre el fondo de la opción activa el texto tenue baja de 5:1; el secundario lo mantiene. */
	.opcion:hover .detalle,
	.opcion.activa .detalle {
		color: var(--tinta-secundaria);
	}
	.resultado {
		margin: 0;
		color: var(--tinta-tenue);
		font-size: var(--texto-sm);
	}
	.resultado:empty {
		display: none;
	}
</style>
