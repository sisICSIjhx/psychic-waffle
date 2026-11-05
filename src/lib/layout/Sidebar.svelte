<!-- Riel de navegación persistente: marca, destinos con icono sobre la etiqueta, captura por cliente
     y cambio de tema. En ventanas estrechas se abre como panel desde la cabecera. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { resolve } from '$app/paths';
	import { base } from '$app/paths';
	import IconoAnimado from '$lib/components/ui/IconoAnimado.svelte';
	import { clientesCaptura, type VistaId } from './navegacion';

	export let activeView: VistaId | null = 'dashboard';
	export let activeCliente: string | null = null;
	export let isMobileOpen = false;
	export let theme = 'dark';

	// El enlace navega por sí mismo; el evento avisa al layout (por ejemplo, para cerrar el menú móvil).
	const dispatch = createEventDispatcher<{
		navigate: { view: VistaId; cliente?: string };
		toggleTheme: void;
	}>();

	/** Destinos principales con el trazo de su icono (24 × 24, línea de 2 px). */
	const DESTINOS: {
		vista: VistaId;
		ruta: string;
		etiqueta: string;
		titulo: string;
		icono: string;
	}[] = [
		{
			vista: 'dashboard',
			ruta: resolve('/'),
			etiqueta: 'Mi trabajo',
			titulo: 'Mi trabajo',
			icono:
				'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'
		},
		{
			vista: 'planeacion',
			ruta: resolve('/planeacion'),
			etiqueta: 'Programa',
			titulo: 'Programa anual',
			icono:
				'<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>'
		},
		{
			vista: 'cumplimiento',
			ruta: resolve('/cumplimiento'),
			etiqueta: 'Cumplimiento',
			titulo: 'Cumplimiento del programa',
			icono:
				'<path d="M12 16v5M16 14v7M20 10v11M22 3l-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15M4 18v3M8 14v7"/>'
		},
		{
			vista: 'captura',
			ruta: resolve('/captura'),
			etiqueta: 'Capturar',
			titulo: 'Capturar reporte',
			icono:
				'<path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"/><path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><path d="M8 18h1"/>'
		},
		{
			vista: 'historial',
			ruta: resolve('/historial'),
			etiqueta: 'Historial',
			titulo: 'Historial de reportes',
			icono:
				'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>'
		},
		{
			vista: 'catalogo',
			ruta: resolve('/catalogo'),
			etiqueta: 'Catálogo',
			titulo: 'Catálogo de contratos',
			icono:
				'<path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'
		},
		{
			vista: 'personal',
			ruta: resolve('/personal'),
			etiqueta: 'Personal',
			titulo: 'Personal',
			icono:
				'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'
		}
	];

	function navigate(view: VistaId, cliente?: string) {
		dispatch('navigate', { view, cliente });
	}

	function toggleTheme() {
		dispatch('toggleTheme');
	}
</script>

<aside id="menu-principal" class="sidebar" class:mobile-open={isMobileOpen}>
	<a class="marca" href={resolve('/')} on:click={() => navigate('dashboard')}>
		<span class="marca-icsi">ICSI</span>
		<span class="marca-producto">Reportes</span>
	</a>

	<nav class="nav" aria-label="Navegación principal">
		{#each DESTINOS as destino (destino.vista)}
			{@const activo =
				activeView === destino.vista && (destino.vista !== 'captura' || !activeCliente)}
			<!-- La ruta de cada destino ya pasó por resolve() en DESTINOS. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={destino.ruta}
				class="nav-item"
				class:active={activo}
				class:en-seccion={!activo && activeView === destino.vista}
				aria-current={activo ? 'page' : undefined}
				title={destino.titulo}
				on:click={() => navigate(destino.vista)}
			>
				{#if destino.vista === 'planeacion'}
					<IconoAnimado ruta={base + '/iconos/calendar.json'}>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- trazo constante del calendario -->
							{@html destino.icono}
						</svg>
					</IconoAnimado>
				{:else}
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
						{@html destino.icono}</svg
					>
				{/if}
				<span>{destino.etiqueta}</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</nav>

	<div class="captura-clientes">
		<p id="titulo-captura-clientes" class="titulo-clientes">Capturar en</p>
		<ul aria-labelledby="titulo-captura-clientes">
			{#each clientesCaptura as cliente (cliente.clave)}
				{@const activo = activeView === 'captura' && activeCliente === cliente.clave}
				<li>
					<!-- resolve() se aplica a la ruta; el filtro por cliente va en la consulta. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={`${resolve('/captura')}?cliente=${cliente.clave}`}
						class="cliente"
						class:active={activo}
						aria-current={activo ? 'page' : undefined}
						title={`Capturar reporte: ${cliente.etiqueta}`}
						on:click={() => navigate('captura', cliente.clave)}>{cliente.etiqueta}</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	</div>

	<!-- «Personal» y «Mi Perfil» vuelven al menú con la autenticación; hoy no tienen contenido. -->

	<div class="sidebar-footer">
		<button
			class="btn-icon"
			type="button"
			title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
			aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
			on:click={toggleTheme}
		>
			{#if theme === 'dark'}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					><circle cx="12" cy="12" r="4" /><path
						d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
					/></svg
				>
			{:else}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg
				>
			{/if}
		</button>
	</div>
</aside>

<style>
	.sidebar {
		grid-area: sidebar;
		display: flex;
		flex-direction: column;
		gap: 26px;
		height: 100%;
		padding: 26px 12px 16px;
		overflow-x: hidden;
		overflow-y: auto;
		z-index: 50;
		background: var(--lienzo-riel);
	}
	.marca {
		display: grid;
		justify-items: start;
		gap: 2px;
		padding: 0 4px;
		border-radius: var(--radio-control);
		color: var(--tinta);
	}
	.marca-icsi {
		font-family: var(--fuente-marca);
		font-size: var(--texto-xl);
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.01em;
		color: var(--accion);
	}
	.marca-producto {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.nav {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	/* Destino: icono sobre la etiqueta, centrados; el activo con fondo de selección suave. */
	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		padding: 12px 4px;
		border-radius: var(--radio-control);
		color: var(--tinta);
		font-size: var(--texto-2xs);
		font-weight: 600;
		line-height: 1.3;
		text-align: center;
		transition:
			background-color 0.12s var(--curva-salida),
			color 0.12s var(--curva-salida);
	}
	.nav-item:hover {
		background: var(--superficie-hover);
	}
	.nav-item.active,
	.nav-item.en-seccion {
		background: var(--accion-suave);
	}
	.nav-item.active svg,
	.nav-item.en-seccion svg {
		color: var(--accion);
	}
	.nav-item svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--tinta-secundaria);
	}
	.captura-clientes {
		display: grid;
		gap: 4px;
		padding: 0 4px;
	}
	.titulo-clientes {
		margin: 0;
		color: var(--tinta-tenue);
		font-size: 0.625rem;
	}
	.captura-clientes ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.cliente {
		display: flex;
		align-items: center;
		min-height: 24px;
		color: var(--accion);
		font-size: var(--texto-2xs);
		text-underline-offset: 3px;
	}
	.cliente:hover {
		text-decoration: underline;
	}
	.cliente.active {
		font-weight: 700;
		text-decoration: underline;
		text-decoration-thickness: 2px;
	}
	.sidebar-footer {
		display: flex;
		margin-top: auto;
		padding: 0 4px;
	}
	.btn-icon {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: var(--radio-control);
		background: transparent;
		color: var(--tinta-tenue);
		cursor: pointer;
		transition:
			background-color 0.12s var(--curva-salida),
			color 0.12s var(--curva-salida);
	}
	.btn-icon:hover {
		background: var(--superficie-hover);
		color: var(--tinta);
	}
	.btn-icon svg {
		width: 18px;
		height: 18px;
	}
	@media (pointer: coarse) {
		.cliente {
			min-height: 44px;
		}
	}
	/* Como panel móvil hay ancho de sobra: cada destino es una fila con icono y etiqueta. */
	@media (max-width: 768px) {
		.nav {
			gap: 2px;
		}
		.nav-item {
			flex-direction: row;
			gap: 12px;
			min-height: 44px;
			padding: 8px 12px;
			font-size: var(--texto-base);
			text-align: left;
		}
		.cliente {
			font-size: var(--texto-base);
		}
		.titulo-clientes {
			font-size: var(--texto-xs);
		}
	}
</style>
