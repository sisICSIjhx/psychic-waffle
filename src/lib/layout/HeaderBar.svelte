<!-- HeaderBar.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let pageTitle = 'Mi trabajo';
	export let menuAbierto = false;

	const dispatch = createEventDispatcher<{ toggleMobileMenu: void }>();

	// Estado real de la red del navegador; solo se avisa cuando falta. El guardado del editor
	// informa su propio estado junto al reporte.
	let enLinea = true;

	onMount(() => {
		const actualizar = () => (enLinea = navigator.onLine);
		actualizar();
		window.addEventListener('online', actualizar);
		window.addEventListener('offline', actualizar);
		return () => {
			window.removeEventListener('online', actualizar);
			window.removeEventListener('offline', actualizar);
		};
	});

	function toggleMobileMenu() {
		dispatch('toggleMobileMenu');
	}
</script>

<header class="header">
	<div class="header-left">
		<button
			class="mobile-menu-trigger"
			type="button"
			aria-label={menuAbierto ? 'Cerrar el menú' : 'Abrir el menú'}
			aria-expanded={menuAbierto}
			aria-controls="menu-principal"
			on:click={toggleMobileMenu}
		>
			<div class="brand-logo" style="width: 28px; height: 28px; box-shadow: none">
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
				</svg>
			</div>
		</button>
		<h1 class="header-title"><span class="texto-titulo">{pageTitle}</span></h1>
	</div>

	<div class="estado-conexion" role="status">
		{#if !enLinea}
			<span class="sin-conexion">
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><line x1="2" y1="2" x2="22" y2="22" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path
						d="M2 8.82a15 15 0 0 1 4.17-2.65"
					/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" /><path
						d="M16.85 11.25a10 10 0 0 1 2.22 1.68"
					/><path d="M5 13a10 10 0 0 1 5.24-2.76" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg
				>
				Sin conexión
			</span>
		{/if}
	</div>
</header>

<style>
	/* Títulos largos (p. ej. el del reporte abierto) se recortan con puntos suspensivos. */
	.header-left,
	.header-title {
		min-width: 0;
	}
	.texto-titulo {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.estado-conexion {
		flex-shrink: 0;
	}
	.sin-conexion {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border: 1px solid var(--danger);
		border-radius: 999px;
		background: var(--danger-bg);
		color: var(--danger);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.sin-conexion svg {
		width: 16px;
		height: 16px;
	}
</style>
