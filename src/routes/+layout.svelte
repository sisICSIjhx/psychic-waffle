<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	import Sidebar from '$lib/layout/Sidebar.svelte';
	import HeaderBar from '$lib/layout/HeaderBar.svelte';
	import { tituloDePagina, vistaDesdeRuta } from '$lib/layout/navegacion';

	import '../app.css';

	let sidebarCollapsed = false;
	let mobileMenuOpen = false;
	let theme = 'dark';

	// La vista activa y el título se derivan de la URL (rutas declaradas en navegacion.ts).
	$: pathname = $page.url.pathname;
	$: cliente = $page.url.searchParams.get('cliente');
	$: currentView = vistaDesdeRuta(pathname);
	$: pageTitle = tituloDePagina(pathname, cliente);

	onMount(() => {
		document.documentElement.setAttribute('data-theme', theme);
	});

	function handleNavigate() {
		if (typeof window !== 'undefined' && window.innerWidth <= 768) {
			mobileMenuOpen = false;
		}
	}

	function toggleSidebarCollapse() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', theme);
		}
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
