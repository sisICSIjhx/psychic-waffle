<!-- Riel de navegación: marca, destinos, cuenta y cambio de tema. En ventanas estrechas se abre
     desde la cabecera. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { resolve } from '$app/paths';
	import { base } from '$app/paths';
	import IconoAnimado from '$lib/components/ui/IconoAnimado.svelte';
	import { SESION_ABIERTA, type SesionArmazon } from '$lib/dominio/permisos';
	import { ETIQUETAS_ROL } from '$lib/dominio/personal';
	import type { VistaId } from './navegacion';

	export let activeView: VistaId | null = 'dashboard';
	export let isMobileOpen = false;
	export let colapsado = false;
	export let theme = 'dark';
	/** Quién entró y qué puede hacer; sin inicio de sesión activado, todo está a la vista. */
	export let sesion: SesionArmazon = SESION_ABIERTA;

	// El enlace navega por sí mismo; el evento avisa al layout (por ejemplo, para cerrar el menú móvil).
	const dispatch = createEventDispatcher<{
		navigate: { view: VistaId };
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
			vista: 'seguimiento',
			ruta: resolve('/seguimiento'),
			etiqueta: 'Seguimiento',
			titulo: 'Seguimiento operativo',
			icono:
				'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="m8 10 1.5 1.5L12 9m2 2h2m-8 5 1.5 1.5L12 15m2 2h2"/>'
		},
		{
			vista: 'cobranza',
			ruta: resolve('/cobranza'),
			etiqueta: 'Contrato y cobranza',
			titulo: 'Contrato y cobranza',
			icono:
				'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6M12 18v-7M14.5 12.5h-3.25a1.25 1.25 0 0 0 0 2.5h1.5a1.25 1.25 0 0 1 0 2.5H9.5"/>'
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
			vista: 'equipos',
			ruta: resolve('/equipos'),
			etiqueta: 'Equipos',
			titulo: 'Catálogo de equipos',
			icono: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>'
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

	$: destinos = DESTINOS.filter(
		(d) =>
			(d.vista !== 'personal' || sesion.permisos.verPersonal) &&
			(d.vista !== 'cobranza' || sesion.permisos.verContrato || sesion.permisos.verEnlacePrograma)
	);

	function navigate(view: VistaId) {
		dispatch('navigate', { view });
	}

	function toggleTheme() {
		dispatch('toggleTheme');
	}
</script>

<aside id="menu-principal" class="sidebar" class:mobile-open={isMobileOpen} class:colapsado>
	<a
		class="marca"
		href={resolve('/')}
		aria-label="ICSI Reportes"
		title="ICSI Reportes"
		on:click={() => navigate('dashboard')}
	>
		<span class="logo" aria-hidden="true">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.25"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M4 18 9.5 11l4 4L20 6" /><path d="M15 6h5v5" /></svg
			>
		</span>
		<span class="marca-texto">
			<span class="marca-icsi">ICSI</span>
			<span class="marca-producto">Reportes</span>
		</span>
	</a>

	<p class="titulo-seccion" aria-hidden="true">Menú</p>
	<nav class="nav" aria-label="Navegación principal">
		{#each destinos as destino (destino.vista)}
			{@const activo = activeView === destino.vista}
			<!-- La ruta de cada destino ya pasó por resolve() en DESTINOS. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={destino.ruta}
				class="nav-item"
				class:active={activo}
				aria-current={activo ? 'page' : undefined}
				aria-label={destino.etiqueta}
				title={destino.titulo}
				on:click={() => navigate(destino.vista)}
			>
				<span class="icono-destino">
					{#if destino.vista === 'planeacion'}
						<IconoAnimado ruta={base + '/iconos/calendar.json'}>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
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
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
							{@html destino.icono}</svg
						>
					{/if}
				</span>
				<span class="etiqueta">{destino.etiqueta}</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</nav>

	<div class="sidebar-footer">
		{#if sesion.usuario}
			<div class="cuenta">
				<p class="cuenta-nombre">{sesion.usuario.nombre}</p>
				<p class="cuenta-rol">{ETIQUETAS_ROL[sesion.usuario.rol]}</p>
			</div>
			<a
				class="btn-icon"
				class:active={activeView === 'perfil'}
				href={resolve('/perfil')}
				aria-current={activeView === 'perfil' ? 'page' : undefined}
				aria-label="Mi perfil"
				title="Mi perfil"
				on:click={() => navigate('perfil')}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg
				>
				<span class="etiqueta">Mi perfil</span>
			</a>
			<!-- Formulario sin `enhance`: al salir, la página se carga completa y sin datos de la sesión. -->
			<form method="POST" action={`${resolve('/acceso')}?/salir`}>
				<button class="btn-icon" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg
					>
					<span class="etiqueta">Cerrar sesión</span>
				</button>
			</form>
		{:else if !sesion.activada}
			<a
				class="btn-icon aviso-abierta"
				aria-label="Activar inicio de sesión"
				href={resolve('/acceso/configurar')}
				title="La aplicación está abierta: cualquiera con esta dirección puede ver y cambiar todo"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					><rect x="3" y="11" width="18" height="11" rx="2" /><path
						d="M7 11V7a5 5 0 0 1 9.9-1"
					/></svg
				>
				<span class="etiqueta">Activar inicio de sesión</span>
			</a>
		{/if}
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
			<span class="texto-tema etiqueta" aria-hidden="true"
				>{theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span
			>
		</button>
	</div>
</aside>

<style>
	.sidebar {
		grid-area: sidebar;
		display: flex;
		flex-direction: column;
		gap: 8px;
		height: 100%;
		padding: 20px 16px 16px;
		overflow-x: hidden;
		overflow-y: auto;
		z-index: 50;
		border-right: 1px solid var(--linea);
		background: var(--lienzo-riel);
	}
	.marca {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0 0 16px;
		padding: 4px 0;
		border-radius: var(--radio-control);
		color: var(--tinta);
	}
	.logo {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 38px;
		height: 38px;
		margin-inline: 1px;
		border-radius: 12px;
		background: var(--relleno-accion);
		color: var(--relleno-accion-texto);
		box-shadow: var(--sombra-boton-primario);
	}
	.logo svg {
		width: 20px;
		height: 20px;
	}
	.marca-texto {
		display: grid;
		gap: 1px;
	}
	.marca-icsi {
		font-family: var(--fuente-marca);
		font-size: 1.25rem;
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -0.01em;
		color: var(--accion);
	}
	.marca-producto {
		color: var(--tinta-tenue);
		font-size: var(--texto-2xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.titulo-seccion {
		margin: 8px 0 4px;
		padding: 0 12px;
		color: var(--tinta-tenue);
		font-size: var(--texto-2xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	/* El resaltado incluye la etiqueta cuando el panel la muestra. */
	.nav-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 46px;
		padding: 3px 14px 3px 0;
		border-radius: 10px;
		color: var(--tinta-secundaria);
		font-size: var(--texto-base);
		font-weight: 600;
		line-height: 1.3;
		transition:
			background-color 0.12s var(--curva-salida),
			color 0.12s var(--curva-salida);
	}
	.nav-item:not(.active):hover {
		background: var(--superficie-hover);
		color: var(--tinta);
	}
	.nav-item.active {
		background: var(--relleno-accion);
		box-shadow: var(--sombra-boton-primario);
		color: var(--relleno-accion-texto);
	}
	.icono-destino {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 10px;
	}
	.nav-item.active::before {
		position: absolute;
		top: 6px;
		bottom: 6px;
		left: -16px;
		width: 4px;
		border-radius: 0 4px 4px 0;
		background: var(--relleno-accion);
	}
	.nav-item svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--tinta-tenue);
	}
	.nav-item:hover svg {
		color: var(--tinta);
	}
	.nav-item.active svg {
		color: var(--relleno-accion-texto);
	}
	/* El icono animado del programa trae su propio color; aquí sigue al de la fila. */
	.nav-item :global(.icono) {
		color: var(--tinta-tenue);
	}
	.nav-item.active :global(.icono) {
		color: var(--relleno-accion-texto);
	}
	.sidebar-footer {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: auto;
		padding-top: 12px;
		border-top: 1px solid var(--linea);
	}
	.btn-icon {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 44px;
		padding: 8px 10px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--tinta-secundaria);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.12s var(--curva-salida),
			color 0.12s var(--curva-salida);
	}
	.btn-icon:hover {
		background: var(--superficie-hover);
		color: var(--tinta);
	}
	.btn-icon.active {
		background: var(--accion-suave);
		color: var(--accion);
	}
	.btn-icon.aviso-abierta {
		color: var(--alerta);
	}
	.sidebar-footer form {
		display: flex;
	}
	.cuenta {
		padding: 4px 14px 8px;
	}
	.cuenta-nombre {
		margin: 0;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.cuenta-rol {
		margin: 0;
		color: var(--tinta-tenue);
		font-size: var(--texto-sm);
	}
	.btn-icon svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	@media (width > 768px) {
		.sidebar.colapsado {
			/* La columna de la cuadrícula conserva el ancho compacto al desplegar el panel. */
			justify-self: start;
			inline-size: 100%;
		}
		.sidebar.colapsado:is(:hover, :has(:focus-visible)) {
			inline-size: var(--sidebar-w);
			box-shadow: var(--sombra-flotante);
		}
		.colapsado:not(:hover, :has(:focus-visible)) {
			padding-inline: 13px 12px;
		}
		.colapsado:not(:hover, :has(:focus-visible)) :is(.marca-texto, .cuenta, .etiqueta) {
			display: none;
		}
		.colapsado:not(:hover, :has(:focus-visible)) .titulo-seccion {
			visibility: hidden;
			white-space: nowrap;
		}
		.colapsado:not(:hover, :has(:focus-visible)) :is(.marca, .nav-item, .btn-icon) {
			justify-content: center;
			gap: 0;
			padding-inline: 0;
		}
		.colapsado:not(:hover, :has(:focus-visible)) .nav-item.active {
			background: transparent;
			box-shadow: none;
		}
		.colapsado:not(:hover, :has(:focus-visible)) .nav-item.active .icono-destino {
			background: var(--relleno-accion);
			box-shadow: var(--sombra-boton-primario);
		}
		.colapsado:not(:hover, :has(:focus-visible)) .nav-item.active::before {
			left: -13px;
		}
	}
	@media (max-width: 768px) {
		.nav-item.active::before {
			display: none;
		}
	}
</style>
