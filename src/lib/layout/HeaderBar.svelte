<!-- Barra superior: en escritorio, la fecha de hoy, el aviso de conexión y el acceso rápido a
     capturar (como la barra de búsqueda y acciones de DashStack); en ventanas estrechas, además, el
     botón del menú y la marca. El título de cada página vive en su contenido. -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ZONA_HORARIA } from '$lib/dominio/fechas';

	export let menuAbierto = false;
	/** «Nuevo reporte» solo se ofrece a quien puede capturar. */
	export let puedeCapturar = true;

	/** Fecha de hoy en la zona del proyecto, con mayúscula inicial («Jueves, 5 de noviembre de 2026»). */
	const textoHoy = new Intl.DateTimeFormat('es-MX', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: ZONA_HORARIA
	})
		.format(new Date())
		.replace(/^./, (letra) => letra.toUpperCase());

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
		<p class="fecha-hoy">
			<svg
				aria-hidden="true"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M8 2v4M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path
					d="M3 10h18"
				/></svg
			>
			<span>{textoHoy}</span>
		</p>
	</div>

	<div class="header-right">
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
						/><path d="M5 13a10 10 0 0 1 5.24-2.76" /><line
							x1="12"
							y1="20"
							x2="12.01"
							y2="20"
						/></svg
					>
					Sin conexión
				</span>
			{/if}
		</div>
		{#if puedeCapturar}
			<a class="boton primario compacto acceso-captura" href={resolve('/captura')}>
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.25"
					stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg
				>
				Nuevo reporte
			</a>
		{/if}
	</div>
</header>

<style>
	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-left: auto;
	}
	.marca-cabecera {
		display: none;
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
	/* Fecha en una píldora gris, como el campo de búsqueda de la barra de DashStack. */
	.fecha-hoy {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		padding: 9px 18px;
		border-radius: 999px;
		background: var(--lienzo);
		color: var(--tinta-secundaria);
		font-size: var(--texto-sm);
		font-weight: 600;
		white-space: nowrap;
	}
	.fecha-hoy svg {
		width: 16px;
		height: 16px;
		color: var(--tinta-tenue);
	}
	.acceso-captura {
		min-height: 38px;
		padding: 6px 16px;
		border-radius: 10px;
	}
	.sin-conexion {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border-radius: 999px;
		background: var(--peligro-fondo);
		color: var(--peligro);
		font-size: var(--texto-sm);
		font-weight: 700;
	}
	.sin-conexion svg {
		width: 16px;
		height: 16px;
	}
	@media (max-width: 768px) {
		.marca-cabecera {
			display: inline;
		}
		.fecha-hoy {
			display: none;
		}
	}
	@media (max-width: 420px) {
		.acceso-captura {
			display: none;
		}
	}
</style>
