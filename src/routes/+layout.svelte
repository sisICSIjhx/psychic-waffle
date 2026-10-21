<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	import Sidebar from '$lib/layout/Sidebar.svelte';
	import HeaderBar from '$lib/layout/HeaderBar.svelte';
	import { tituloDePagina, vistaDesdeRuta } from '$lib/layout/navegacion';
	import {
		CLAVE_MENU_CONTRAIDO,
		CLAVE_TEMA,
		guardarPreferencia,
		leerPreferencia,
		temaInicial,
		type Tema
	} from '$lib/layout/preferencias';

	import '../app.css';

	let sidebarCollapsed = false;
	let mobileMenuOpen = false;
	// El script de app.html ya aplicó el tema al documento; aquí solo se sincroniza el botón.
	let theme: Tema = 'dark';

	// La vista activa y el título se derivan de la URL (rutas declaradas en navegacion.ts).
	$: pathname = $page.url.pathname;
	$: cliente = $page.url.searchParams.get('cliente');
	$: currentView = vistaDesdeRuta(pathname);
	$: tituloReporte = ($page.data as { reporte?: { titulo?: string } }).reporte?.titulo ?? null;
	$: pageTitle = tituloDePagina(pathname, cliente, tituloReporte);

	onMount(() => {
		const sistema = window.matchMedia('(prefers-color-scheme: dark)');
		theme = temaInicial(leerPreferencia(CLAVE_TEMA), sistema.matches);
		aplicarTema(theme);
		sidebarCollapsed = leerPreferencia(CLAVE_MENU_CONTRAIDO) === '1';

		// Mientras no se elija un tema, se sigue el del sistema.
		const alCambiarSistema = (evento: MediaQueryListEvent) => {
			if (leerPreferencia(CLAVE_TEMA)) return;
			theme = evento.matches ? 'dark' : 'light';
			aplicarTema(theme);
		};
		sistema.addEventListener('change', alCambiarSistema);
		return () => sistema.removeEventListener('change', alCambiarSistema);
	});

	function aplicarTema(tema: Tema) {
		document.documentElement.setAttribute('data-theme', tema);
	}

	function handleNavigate() {
		if (typeof window !== 'undefined' && window.innerWidth <= 768) {
			mobileMenuOpen = false;
		}
	}

	function toggleSidebarCollapse() {
		sidebarCollapsed = !sidebarCollapsed;
		guardarPreferencia(CLAVE_MENU_CONTRAIDO, sidebarCollapsed ? '1' : null);
	}

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		aplicarTema(theme);
		guardarPreferencia(CLAVE_TEMA, theme);
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	// El enrutador atiende el ancla; el foco se mueve aquí para que Tab siga dentro del contenido.
	function saltarAlContenido() {
		document.getElementById('contenido')?.focus();
	}
</script>

<svelte:head>
	<title>{pageTitle} · ICSI Reportes</title>
</svelte:head>

<a class="saltar-contenido" href="#contenido" on:click={saltarAlContenido}>Saltar al contenido</a>

<div
	class="sidebar-overlay"
	class:active={mobileMenuOpen}
	role="presentation"
	on:click={toggleMobileMenu}
></div>

<div class="layout" class:is-collapsed={sidebarCollapsed}>
	<Sidebar
		activeView={currentView}
		activeCliente={cliente}
		isCollapsed={sidebarCollapsed}
		isMobileOpen={mobileMenuOpen}
		{theme}
		on:navigate={handleNavigate}
		on:toggleCollapse={toggleSidebarCollapse}
		on:toggleTheme={toggleTheme}
	/>

	<HeaderBar {pageTitle} menuAbierto={mobileMenuOpen} on:toggleMobileMenu={toggleMobileMenu} />

	<main class="main" id="contenido" tabindex="-1">
		<div class="view-section">
			<slot />
		</div>
	</main>
</div>
