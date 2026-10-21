<!-- Diálogo modal sobre <dialog>: el navegador atrapa el foco, cierra con Esc y deja el fondo inerte.
     El foco inicial va a la opción segura (Cancelar) y, al cerrar, vuelve al elemento que lo abrió. -->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';

	/** Prefijo de los `id` internos; debe ser único en la página. */
	export let id: string;
	export let abierto = false;
	export let titulo: string;
	export let textoConfirmar = 'Aceptar';
	export let textoCancelar = 'Cancelar';

	const dispatch = createEventDispatcher<{ confirmar: void; cancelar: void }>();

	let dialogo: HTMLDialogElement | undefined;
	let botonCancelar: HTMLButtonElement | undefined;
	let origen: HTMLElement | null = null;

	$: if (dialogo) sincronizar(abierto);

	async function sincronizar(abrir: boolean) {
		if (!dialogo) return;
		if (abrir && !dialogo.open) {
			origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			dialogo.showModal();
			await tick();
			botonCancelar?.focus();
		} else if (!abrir && dialogo.open) {
			dialogo.close();
		}
	}

	/** Se dispara al cerrar por cualquier vía (botones, Esc o `close()`). */
	function alCerrar() {
		abierto = false;
		origen?.focus();
		origen = null;
	}

	function cancelar() {
		dispatch('cancelar');
		abierto = false;
	}

	function confirmar() {
		dispatch('confirmar');
		abierto = false;
	}
</script>

<dialog
	bind:this={dialogo}
	class="dialogo"
	aria-labelledby={`${id}-titulo`}
	aria-describedby={`${id}-contenido`}
	on:close={alCerrar}
	on:cancel={() => dispatch('cancelar')}
>
	<h2 id={`${id}-titulo`} class="titulo-dialogo">{titulo}</h2>
	<div id={`${id}-contenido`} class="contenido-dialogo"><slot /></div>
	<div class="acciones-dialogo">
		<button bind:this={botonCancelar} class="boton" type="button" on:click={cancelar}
			>{textoCancelar}</button
		>
		<button class="boton primario" type="button" on:click={confirmar}>{textoConfirmar}</button>
	</div>
</dialog>

<style>
	.dialogo {
		width: min(480px, calc(100vw - 32px));
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow);
	}
	.dialogo::backdrop {
		background: rgba(15, 23, 42, 0.6);
	}
	.titulo-dialogo {
		margin: 0 0 12px;
		font-size: 1.1rem;
	}
	.contenido-dialogo {
		display: grid;
		gap: 8px;
		font-size: 0.95rem;
	}
	.acciones-dialogo {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 20px;
	}
</style>
