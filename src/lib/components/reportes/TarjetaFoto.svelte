<!-- Tarjeta de una foto del alcance: miniatura que abre la vista ampliada y, sobre la foto, una barra con
     Ampliar, Girar, Reemplazar, Quitar y «Más acciones» (mover antes o después, espacio y mover a otro alcance),
     visible al pasar el puntero o con el foco. El asa reordena con el teclado; la miniatura y el asa
     se arrastran. FotosAlcance decide qué hacer con cada evento. -->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { ACEPTA_FOTOS, escalaGirada, type Momento } from '$lib/dominio/fotos';
	import type { Foto } from '$lib/dominio/esquemas';

	export let foto: Foto;
	/** «Ilustración 2.n.m» */
	export let pie: string;
	export let reporteId = '';
	export let soloLectura = false;
	export let disposicion: 'cuadricula' | 'antes_durante_despues' = 'cuadricula';
	export let otrosAlcances: { id: string; etiqueta: string }[] = [];
	export let puedeAntes = false;
	export let puedeDespues = false;
	export let reemplazando = false;
	/** Lado en el que caería la foto arrastrada sobre esta tarjeta. */
	export let indicador: 'antes' | 'despues' | null = null;
	/** El indicador va arriba o abajo cuando la lista muestra una sola columna. */
	export let vertical = false;
	export let agarrada = false;
	/** `id` del texto con las instrucciones del asa. */
	export let instrucciones = '';

	const dispatch = createEventDispatcher<{
		ampliar: void;
		quitar: void;
		reemplazar: { archivo: File };
		paso: { paso: -1 | 1 };
		momento: { momento: Momento };
		moverA: { alcanceId: string };
		describir: { descripcion: string };
		girar: { sentido: -1 | 1 };
		teclaAsa: KeyboardEvent;
		soltarAsa: void;
	}>();

	const ESPACIOS: { momento: Momento; etiqueta: string }[] = [
		{ momento: 'antes', etiqueta: 'ANTES' },
		{ momento: 'durante', etiqueta: 'DURANTE' },
		{ momento: 'despues', etiqueta: 'DESPUÉS' }
	];

	let menu: 'cerrado' | 'principal' | 'alcances' = 'cerrado';
	let envoltura: HTMLElement | undefined;
	let botonMas: HTMLButtonElement | undefined;
	let entradaArchivo: HTMLInputElement | undefined;

	$: momento = foto.momento ?? 'durante';
	// El giro es un dato: la imagen se gira con CSS y se escala para caber completa en el marco 4:3.
	$: escala = escalaGirada({ ancho: foto.ancho, alto: foto.alto }, foto.rotacion, {
		ancho: 4,
		alto: 3
	});
	$: src = reporteId ? `/reportes/${reporteId}/fotos/${foto.id}?tamano=mini` : '';

	async function cerrarMenu(devolverFoco = true) {
		menu = 'cerrado';
		if (!devolverFoco) return;
		await tick();
		botonMas?.focus();
	}

	/** Ejecuta la opción del menú y lo cierra con el foco de vuelta en «Más acciones». */
	function elegir(accion: () => void) {
		accion();
		cerrarMenu();
	}

	function teclaMenu(evento: KeyboardEvent) {
		if (evento.key !== 'Escape' || menu === 'cerrado') return;
		evento.preventDefault();
		evento.stopPropagation();
		cerrarMenu();
	}

	function clicFuera(evento: MouseEvent) {
		// composedPath conserva el recorrido aunque el botón pulsado ya no exista (al cambiar de nivel).
		if (menu === 'cerrado' || (envoltura && evento.composedPath().includes(envoltura))) return;
		// El foco vuelve a «Más acciones» solo si estaba dentro del menú.
		cerrarMenu(!!envoltura?.contains(document.activeElement));
	}

	function elegirArchivo(evento: Event) {
		const entrada = evento.currentTarget as HTMLInputElement;
		const archivo = entrada.files?.[0];
		entrada.value = '';
		if (archivo) dispatch('reemplazar', { archivo });
	}
</script>

<svelte:window on:click={clicFuera} />

<li
	class="foto"
	class:insertar-antes={indicador === 'antes'}
	class:insertar-despues={indicador === 'despues'}
	class:vertical
	class:agarrada
	data-foto={foto.id}
	on:dragstart
	on:dragend
	on:dragover
	on:dragleave
	on:drop
>
	<div class="contenedor-marco">
		<div class="marco">
			<!-- Con barra, Ampliar de la barra es el que recibe el foco; la miniatura solo responde al
			     puntero y se arrastra. En solo lectura la miniatura es el único botón. -->
			<button
				type="button"
				class="miniatura"
				id={soloLectura ? `ampliar-${foto.id}` : undefined}
				tabindex={soloLectura ? 0 : -1}
				aria-hidden={soloLectura ? undefined : 'true'}
				aria-label={`Ampliar la ${pie}`}
				draggable={soloLectura ? 'false' : 'true'}
				on:click={() => dispatch('ampliar')}
			>
				<span class="giro" style:transform={`rotate(${foto.rotacion}deg) scale(${escala})`}>
					{#if src}
						<img {src} alt={foto.descripcion || pie} loading="lazy" draggable="false" />
					{/if}
				</span>
			</button>
		</div>
		{#if !soloLectura}
			<div class="barra" bind:this={envoltura} on:keydown={teclaMenu} role="presentation">
				<button
					type="button"
					class="icono"
					id={`ampliar-${foto.id}`}
					aria-label={`Ampliar la ${pie}`}
					title="Ampliar"
					on:click={() => dispatch('ampliar')}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" /></svg
					>
				</button>
				<button
					type="button"
					class="icono"
					aria-label={`Girar a la derecha la ${pie}`}
					title="Girar a la derecha"
					on:click={() => dispatch('girar', { sentido: 1 })}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg
					>
				</button>
				<button
					type="button"
					class="icono"
					aria-label={`Reemplazar la ${pie}`}
					title="Reemplazar"
					disabled={reemplazando}
					on:click={() => entradaArchivo?.click()}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h13l-4-4M20 15H7l4 4" /></svg>
				</button>
				<button
					type="button"
					class="icono peligro"
					aria-label={`Quitar la ${pie}`}
					title="Quitar"
					on:click={() => dispatch('quitar')}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg
					>
				</button>
				<button
					type="button"
					class="icono"
					bind:this={botonMas}
					aria-label={`Más acciones de la ${pie}`}
					title="Más acciones"
					aria-expanded={menu !== 'cerrado'}
					aria-controls={`menu-${foto.id}`}
					on:click={() => (menu === 'cerrado' ? (menu = 'principal') : cerrarMenu(false))}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle
							cx="19"
							cy="12"
							r="1.5"
						/></svg
					>
				</button>
				<input
					bind:this={entradaArchivo}
					class="sr-only"
					type="file"
					accept={ACEPTA_FOTOS}
					tabindex="-1"
					aria-hidden="true"
					on:change={elegirArchivo}
				/>
				<div class="menu" id={`menu-${foto.id}`} hidden={menu === 'cerrado'}>
					{#if menu === 'principal'}
						<button
							type="button"
							disabled={!puedeAntes}
							on:click={() => elegir(() => dispatch('paso', { paso: -1 }))}>Mover antes</button
						>
						<button
							type="button"
							disabled={!puedeDespues}
							on:click={() => elegir(() => dispatch('paso', { paso: 1 }))}>Mover después</button
						>
						{#if disposicion === 'antes_durante_despues'}
							<p class="titulo-menu" id={`espacio-${foto.id}`}>Espacio</p>
							<div class="espacios" role="group" aria-labelledby={`espacio-${foto.id}`}>
								{#each ESPACIOS as espacio (espacio.momento)}
									<button
										type="button"
										aria-pressed={momento === espacio.momento}
										on:click={() => elegir(() => dispatch('momento', { momento: espacio.momento }))}
										>{espacio.etiqueta}</button
									>
								{/each}
							</div>
						{/if}
						<button
							type="button"
							disabled={!otrosAlcances.length}
							on:click={() => (menu = 'alcances')}>Mover a otro alcance…</button
						>
					{:else if menu === 'alcances'}
						<button type="button" class="volver" on:click={() => (menu = 'principal')}
							>‹ Volver</button
						>
						{#each otrosAlcances as otro (otro.id)}
							<button
								type="button"
								on:click={() => {
									menu = 'cerrado';
									dispatch('moverA', { alcanceId: otro.id });
								}}>{otro.etiqueta}</button
							>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>
	<div class="fila-pie">
		{#if !soloLectura}
			<button
				type="button"
				class="asa"
				id={`asa-${foto.id}`}
				draggable="true"
				aria-label={`Reordenar la ${pie}`}
				aria-describedby={instrucciones || undefined}
				aria-pressed={agarrada}
				title="Arrastre o use Espacio y las flechas para reordenar"
				on:keydown={(e) => dispatch('teclaAsa', e)}
				on:blur={() => dispatch('soltarAsa')}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><circle cx="9" cy="6" r="1.3" /><circle cx="15" cy="6" r="1.3" /><circle
						cx="9"
						cy="12"
						r="1.3"
					/><circle cx="15" cy="12" r="1.3" /><circle cx="9" cy="18" r="1.3" /><circle
						cx="15"
						cy="18"
						r="1.3"
					/></svg
				>
			</button>
		{/if}
		<p class="pie">{pie}</p>
	</div>
	<label class="sr-only" for={`pie-${foto.id}`}>Descripción de la {pie}</label>
	<input
		id={`pie-${foto.id}`}
		class="descripcion"
		placeholder="Descripción del pie (opcional)"
		value={foto.descripcion}
		disabled={soloLectura}
		on:input={(e) =>
			dispatch('describir', { descripcion: (e.currentTarget as HTMLInputElement).value })}
	/>
	{#if reemplazando}<p class="reemplazando" role="status">Reemplazando…</p>{/if}
</li>

<style>
	.foto {
		position: relative;
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 6px;
		min-width: 0;
		background: var(--surface);
	}
	.foto.agarrada {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	/* Indicador de inserción: barra de 3 px del lado en el que caería la foto. */
	.foto.insertar-antes::before,
	.foto.insertar-despues::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		border-radius: 2px;
		background: var(--primary);
	}
	.foto.insertar-antes::before {
		left: -8px;
	}
	.foto.insertar-despues::before {
		right: -8px;
	}
	.foto.vertical.insertar-antes::before,
	.foto.vertical.insertar-despues::before {
		left: 0;
		right: 0;
		width: auto;
		height: 3px;
	}
	.foto.vertical.insertar-antes::before {
		top: -8px;
		bottom: auto;
	}
	.foto.vertical.insertar-despues::before {
		top: auto;
		bottom: -8px;
	}
	.contenedor-marco {
		position: relative;
	}
	.marco {
		aspect-ratio: 4 / 3;
		overflow: hidden;
		border-radius: 4px;
		background: var(--surface-2);
	}
	.miniatura {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: zoom-in;
	}
	.giro {
		display: block;
		width: 100%;
		height: 100%;
		transition: transform 0.15s;
	}
	@media (prefers-reduced-motion: reduce) {
		.giro {
			transition: none;
		}
	}
	.miniatura img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}
	/* opacity (y no display ni visibility) mantiene los botones en el orden de tabulación. */
	.barra {
		position: absolute;
		top: 6px;
		right: 6px;
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.foto:hover .barra,
	.foto:focus-within .barra {
		opacity: 1;
	}
	@media (hover: none) {
		.barra {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.barra {
			transition: none;
		}
	}
	.icono,
	.asa {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--objetivo-min);
		height: var(--objetivo-min);
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow);
		cursor: pointer;
	}
	.icono:hover:not(:disabled),
	.asa:hover {
		background: var(--hover);
	}
	/* Sobre la foto, el anillo de foco va entre dos bandas del color de superficie: su contraste no
	   depende de lo clara u oscura que sea la imagen. */
	.icono:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		box-shadow: 0 0 0 6px var(--surface);
	}
	.icono:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.icono.peligro {
		color: var(--danger);
	}
	.icono svg,
	.asa svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.asa {
		box-shadow: none;
		cursor: grab;
		flex: none;
	}
	.asa svg circle {
		fill: currentColor;
		stroke: none;
	}
	.menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 5;
		display: grid;
		width: max-content;
		min-width: 180px;
		max-width: min(260px, calc(100vw - 32px));
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	.menu[hidden] {
		display: none;
	}
	.menu button {
		min-height: var(--objetivo-min);
		padding: 6px 10px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--text);
		text-align: left;
		cursor: pointer;
		overflow-wrap: anywhere;
	}
	.menu button:hover:not(:disabled) {
		background: var(--hover);
	}
	.menu button:disabled {
		color: var(--muted);
		cursor: not-allowed;
	}
	.menu .espacios {
		display: flex;
		gap: 4px;
		padding: 0 6px 4px;
	}
	.menu .espacios button {
		flex: 1;
		padding: 4px 6px;
		border: 1px solid var(--border);
		font-size: 0.8rem;
		text-align: center;
	}
	.menu .espacios button[aria-pressed='true'] {
		border-color: var(--primary);
		background: var(--primary-soft);
		font-weight: 600;
	}
	.titulo-menu {
		margin: 4px 10px 2px;
		color: var(--muted);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.fila-pie {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.pie {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.descripcion {
		min-width: 0;
		max-width: 100%;
	}
	.reemplazando {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
