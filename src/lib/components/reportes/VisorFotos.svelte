<!-- Vista ampliada de las fotos de un alcance sobre <dialog> modal: la foto de 1600 px, «3 de 12», ‹ y ›
     (← y → fuera de los campos) y, en un borrador, la descripción, Reemplazar, Mover a otro alcance y
     Quitar. Bajo el modal la notificación global queda inerte, así que la vista ofrece su propio
     «Deshacer». Se monta al abrirse; al cerrarse avisa qué foto mostraba. -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { pieIlustracion } from '$lib/dominio/documento';
	import { ACEPTA_FOTOS } from '$lib/dominio/fotos';
	import type { Foto } from '$lib/dominio/esquemas';

	/** Fotos visibles del alcance en orden de aparición. */
	export let lista: Foto[];
	export let fotoId: string;
	export let posicionAlcance = 1;
	export let tituloAlcance = '';
	export let reporteId = '';
	export let soloLectura = false;
	export let otrosAlcances: { id: string; etiqueta: string }[] = [];
	export let reemplazando: Record<string, unknown> = {};
	export let ocultas: Record<string, unknown> = {};

	const dispatch = createEventDispatcher<{
		cerrar: { fotoId: string | null };
		quitar: { fotoId: string; pie: string };
		deshacer: { fotoId: string };
		reemplazar: { fotoId: string; archivo: File; pie: string };
		moverA: { fotoId: string; alcanceId: string };
		describir: { fotoId: string; descripcion: string };
	}>();

	let dialogo: HTMLDialogElement | undefined;
	let entradaArchivo: HTMLInputElement | undefined;
	let actualId = fotoId;
	let indice = 0;
	let moverAbierto = false;
	/** Última foto quitada o reemplazada desde la vista, para ofrecer «Deshacer» mientras se pueda. */
	let pendiente: { fotoId: string; texto: string } | null = null;

	// Si la foto mostrada deja la lista (se quitó, se movió o se reemplazó), se muestra la que quedó en
	// su lugar o, si era la última, la anterior. Sin fotos, la vista se cierra.
	$: if (lista.some((f) => f.id === actualId)) indice = lista.findIndex((f) => f.id === actualId);
	else if (lista.length) actualId = lista[Math.min(indice, lista.length - 1)].id;
	else cerrar();
	$: foto = lista.find((f) => f.id === actualId);
	$: pie = pieIlustracion(posicionAlcance, indice + 1);
	$: precargar(lista[indice - 1], lista[indice + 1]);
	$: avisoDeshacer = pendiente && ocultas[pendiente.fotoId] ? pendiente : null;

	onMount(() => {
		dialogo?.showModal();
	});

	const urlDe = (id: string) => `/reportes/${reporteId}/fotos/${id}`;

	function precargar(...vecinas: (Foto | undefined)[]) {
		for (const vecina of vecinas) if (vecina && reporteId) new Image().src = urlDe(vecina.id);
	}

	function ir(paso: -1 | 1) {
		const destino = lista[indice + paso];
		if (!destino) return;
		actualId = destino.id;
		moverAbierto = false;
	}

	function cerrar() {
		if (dialogo?.open) dialogo.close();
		else dispatch('cerrar', { fotoId: null });
	}

	function tecla(evento: KeyboardEvent) {
		const destino = evento.target as HTMLElement;
		if (destino.closest('input, textarea, select')) return;
		if (evento.key === 'ArrowLeft') ir(-1);
		else if (evento.key === 'ArrowRight') ir(1);
		else return;
		evento.preventDefault();
	}

	function quitar() {
		if (!foto) return;
		pendiente = { fotoId: foto.id, texto: `Se quitó la ${pie}.` };
		dispatch('quitar', { fotoId: foto.id, pie });
	}

	function deshacer() {
		if (!pendiente) return;
		const { fotoId: id } = pendiente;
		pendiente = null;
		dispatch('deshacer', { fotoId: id });
		actualId = id;
	}

	function elegirArchivo(evento: Event) {
		const entrada = evento.currentTarget as HTMLInputElement;
		const archivo = entrada.files?.[0];
		entrada.value = '';
		if (!archivo || !foto) return;
		pendiente = { fotoId: foto.id, texto: `Se reemplazó la ${pie}.` };
		dispatch('reemplazar', { fotoId: foto.id, archivo, pie });
	}

	function moverA(alcanceId: string) {
		if (!foto) return;
		moverAbierto = false;
		dispatch('moverA', { fotoId: foto.id, alcanceId });
	}
</script>

<dialog
	bind:this={dialogo}
	class="visor"
	aria-labelledby="visor-titulo"
	on:keydown={tecla}
	on:close={() => dispatch('cerrar', { fotoId: foto?.id ?? null })}
>
	<header class="encabezado">
		<h2 id="visor-titulo">
			<span>2.{posicionAlcance} {tituloAlcance}</span>
			<span aria-hidden="true">·</span>
			<span>{pie}</span>
			<span aria-hidden="true">·</span>
			<span class="contador">{indice + 1} de {lista.length}</span>
		</h2>
		<button type="button" class="boton" on:click={cerrar}>Cerrar</button>
	</header>
	<div class="escenario">
		<button
			type="button"
			class="navegar anterior"
			aria-label="Foto anterior"
			disabled={indice === 0}
			on:click={() => ir(-1)}>‹</button
		>
		<div class="caja">
			{#if foto && reporteId}
				<img src={urlDe(foto.id)} alt={foto.descripcion || pie} />
			{/if}
		</div>
		<button
			type="button"
			class="navegar siguiente"
			aria-label="Foto siguiente"
			disabled={indice >= lista.length - 1}
			on:click={() => ir(1)}>›</button
		>
	</div>
	{#if foto}
		<footer class="pie-visor">
			<label class="sr-only" for="visor-descripcion">Descripción de la {pie}</label>
			<input
				id="visor-descripcion"
				placeholder="Descripción del pie (opcional)"
				value={foto.descripcion}
				disabled={soloLectura}
				on:input={(e) =>
					foto &&
					dispatch('describir', {
						fotoId: foto.id,
						descripcion: (e.currentTarget as HTMLInputElement).value
					})}
			/>
			{#if !soloLectura}
				<div class="acciones">
					<button
						type="button"
						class="boton"
						disabled={!!reemplazando[foto.id]}
						on:click={() => entradaArchivo?.click()}
						>{reemplazando[foto.id] ? 'Reemplazando…' : 'Reemplazar'}</button
					>
					<input
						bind:this={entradaArchivo}
						class="sr-only"
						type="file"
						accept={ACEPTA_FOTOS}
						tabindex="-1"
						aria-hidden="true"
						on:change={elegirArchivo}
					/>
					{#if otrosAlcances.length}
						<button
							type="button"
							class="boton"
							aria-expanded={moverAbierto}
							aria-controls="visor-mover"
							on:click={() => (moverAbierto = !moverAbierto)}>Mover a otro alcance</button
						>
					{/if}
					<button type="button" class="boton peligro" on:click={quitar}>Quitar</button>
				</div>
				<div class="mover" id="visor-mover" hidden={!moverAbierto}>
					{#each otrosAlcances as otro (otro.id)}
						<button type="button" class="boton" on:click={() => moverA(otro.id)}
							>{otro.etiqueta}</button
						>
					{/each}
				</div>
			{/if}
			<div class="estado" role="status">
				{#if avisoDeshacer}
					<span>{avisoDeshacer.texto}</span>
					<button type="button" class="boton" on:click={deshacer}>Deshacer</button>
				{/if}
			</div>
		</footer>
	{/if}
</dialog>

<style>
	.visor {
		width: min(1100px, calc(100vw - 32px));
		height: min(860px, calc(100vh - 32px));
		padding: 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow);
	}
	.visor[open] {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 12px;
	}
	.visor::backdrop {
		background: rgba(15, 23, 42, 0.75);
	}
	.encabezado {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-width: 0;
	}
	.encabezado h2 {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		font-size: 1rem;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.contador {
		color: var(--muted);
		font-weight: 500;
	}
	.escenario {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
		min-height: 0;
	}
	.caja {
		height: 100%;
		min-height: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: var(--surface-2);
	}
	.caja img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.navegar {
		width: var(--objetivo-min);
		height: calc(var(--objetivo-min) * 2);
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font-size: 1.6rem;
		cursor: pointer;
	}
	.navegar:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.pie-visor {
		display: grid;
		gap: 8px;
	}
	.pie-visor input {
		min-width: 0;
	}
	.acciones,
	.mover,
	.estado {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.mover[hidden] {
		display: none;
	}
	.mover .boton {
		overflow-wrap: anywhere;
		text-align: left;
	}
	.boton.peligro {
		color: var(--danger);
	}
	.estado:empty {
		display: none;
	}
</style>
