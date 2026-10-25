<!-- Cabecera de ventanas estrechas (marca y botón del menú) y aviso de conexión. En escritorio el
     título de cada página vive en su contenido y la cabecera no se muestra. -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

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
			<svg
				aria-hidden="true"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg
			>
		</button>
		<span class="marca-cabecera">ICSI <span>Reportes</span></span>
	</div>
</header>

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

<style>
	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.marca-cabecera {
		font-family: var(--fuente-marca);
		font-size: var(--texto-lg);
		font-weight: 800;
		color: var(--accion);
	}
	.marca-cabecera span {
		color: var(--tinta);
		font-family: var(--fuente);
		font-size: var(--texto-sm);
		font-weight: 700;
	}
	/* Flota sobre el contenido para verse en cualquier página sin ocupar una barra propia. */
	.estado-conexion {
		position: fixed;
		top: 12px;
		right: 16px;
		z-index: 60;
	}
	.sin-conexion {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 10px;
		border: 1px solid var(--peligro-borde);
		border-radius: 3px;
		background: var(--peligro-fondo);
		color: var(--peligro);
		font-size: var(--texto-sm);
		font-weight: 600;
	}
	.sin-conexion svg {
		width: 16px;
		height: 16px;
	}
</style>
