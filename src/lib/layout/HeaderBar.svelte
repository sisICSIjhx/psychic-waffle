<!-- Barra superior: fecha de hoy, aviso de conexión y acceso rápido a capturar. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ZONA_HORARIA } from '$lib/dominio/fechas';
	import BotonPanel from './BotonPanel.svelte';

	export let menuAbierto = true;
	/** «Capturar» (actividad o reporte) solo se ofrece a quien puede capturar. */
	export let puedeCapturar = true;

	// «Actividad» abre la ventana «Capturar actividad» (cambio capturar-actividad). Su código se
	// descarga la primera vez que se pide, no con cada página.
	let VentanaActividad:
		| typeof import('$lib/components/actividades/DialogoActividad.svelte').default
		| null = null;
	let actividadAbierta = false;
	async function abrirActividad() {
		cerrarCapturar();
		if (!VentanaActividad) {
			VentanaActividad = (await import('$lib/components/actividades/DialogoActividad.svelte'))
				.default;
		}
		actividadAbierta = true;
	}

	// «Capturar» despliega sus opciones como el menú de descargas; se cierra al elegir una, con Esc
	// o con un clic fuera.
	let menuCapturar: HTMLDetailsElement | undefined;
	function cerrarCapturar(devolverFoco = false) {
		if (!menuCapturar?.open) return;
		menuCapturar.open = false;
		if (devolverFoco) menuCapturar.querySelector('summary')?.focus();
	}
	function alHacerClic(evento: MouseEvent) {
		if (menuCapturar && !menuCapturar.contains(evento.target as Node)) cerrarCapturar();
	}

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
</script>

<header class="header">
	<div class="header-left">
		<BotonPanel abierto={menuAbierto} on:click />
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
			<details class="menu-capturar" bind:this={menuCapturar}>
				<summary
					class="boton primario compacto resumen-boton acceso-captura"
					aria-label="Capturar"
					title="Capturar"
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.25"
						stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg
					>
					<span>Capturar</span>
					<svg
						class="flecha"
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.25"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg
					>
				</summary>
				<div class="opciones-captura">
					<button type="button" class="opcion-captura" on:click={abrirActividad}>
						<span class="titulo-opcion">Actividad</span>
						<span class="nota-opcion">Si se realizó o no una actividad del programa anual.</span>
					</button>
					<a class="opcion-captura" href={resolve('/captura')} on:click={() => cerrarCapturar()}>
						<span class="titulo-opcion">Reporte</span>
						<span class="nota-opcion">Nuevo reporte FOR-ICSI-RMT-01 de una partida.</span>
					</a>
				</div>
			</details>
		{/if}
	</div>
</header>

{#if VentanaActividad}
	<svelte:component this={VentanaActividad} bind:abierto={actividadAbierta} />
{/if}

<svelte:window
	on:click={alHacerClic}
	on:keydown={(e) => e.key === 'Escape' && cerrarCapturar(true)}
/>

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
	/* Menú «Capturar»: «Actividad» y «Reporte» bajo el botón, alineados a su borde derecho. */
	.menu-capturar {
		position: relative;
	}
	.menu-capturar[open] > .acceso-captura {
		margin-bottom: 0;
	}
	.acceso-captura svg {
		width: 16px;
		height: 16px;
	}
	.acceso-captura .flecha {
		width: 14px;
		height: 14px;
		transition: transform 0.15s ease-out;
	}
	.menu-capturar[open] .flecha {
		transform: rotate(180deg);
	}
	.opciones-captura {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 30;
		display: grid;
		gap: 2px;
		min-width: 260px;
		padding: 6px;
		border-radius: var(--radio-flotante);
		background: var(--superficie-flotante);
		box-shadow: var(--sombra-flotante);
	}
	.opcion-captura {
		display: grid;
		gap: 2px;
		width: 100%;
		padding: 8px 12px;
		border: 0;
		border-radius: var(--radio-control);
		background: none;
		color: var(--tinta);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.opcion-captura:hover,
	.opcion-captura:focus-visible {
		background: var(--superficie-hover);
	}
	.titulo-opcion {
		font-size: var(--texto-sm);
		font-weight: 700;
	}
	.nota-opcion {
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	/* Con el dedo, 44 px también entre 421 y 768 px (un teléfono de 430 px cae ahí). Con «.boton»
	   para ganarle al alto de «.boton.compacto» de app.css. */
	@media (pointer: coarse) {
		.boton.acceso-captura {
			min-height: 44px;
		}
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
			flex-shrink: 0;
			width: 44px;
			height: 44px;
			padding: 0;
		}
		.acceso-captura span,
		.acceso-captura .flecha {
			display: none;
		}
		.acceso-captura {
			justify-content: center;
		}
	}
</style>
