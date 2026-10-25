<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	import Sidebar from '$lib/layout/Sidebar.svelte';
	import HeaderBar from '$lib/layout/HeaderBar.svelte';
	import EncabezadoPagina from '$lib/components/ui/EncabezadoPagina.svelte';
	import Notificaciones from '$lib/components/ui/Notificaciones.svelte';
	import { encabezadoDePagina, tituloDePagina, vistaDesdeRuta } from '$lib/layout/navegacion';
	import {
		CLAVE_TEMA,
		guardarPreferencia,
		leerPreferencia,
		temaInicial,
		type Tema
	} from '$lib/layout/preferencias';

	import '@fontsource-variable/inter';
	import '@fontsource-variable/manrope';
	import '../app.css';

	let mobileMenuOpen = false;
	// El script de app.html ya aplicó el tema al documento; aquí solo se sincroniza el botón.
	let theme: Tema = 'dark';

	// La vista activa y el título se derivan de la URL (rutas declaradas en navegacion.ts).
	$: pathname = $page.url.pathname;
	$: cliente = $page.url.searchParams.get('cliente');
	$: currentView = vistaDesdeRuta(pathname);
	$: tituloReporte = ($page.data as { reporte?: { titulo?: string } }).reporte?.titulo ?? null;
	$: pageTitle = tituloDePagina(pathname, cliente, tituloReporte);
	$: datosPagina = $page.data as { contrato?: { numero?: string }; partida?: { numero?: string } };
	$: encabezado = encabezadoDePagina(pathname, cliente, {
		contrato: datosPagina.contrato?.numero,
		partida: datosPagina.partida?.numero
	});

	onMount(() => {
		const sistema = window.matchMedia('(prefers-color-scheme: dark)');
		theme = temaInicial(leerPreferencia(CLAVE_TEMA), sistema.matches);
		aplicarTema(theme);

		// Mientras no se elija un tema, se sigue el del sistema.
		const alCambiarSistema = (evento: MediaQueryListEvent) => {
			if (leerPreferencia(CLAVE_TEMA)) return;
			theme = evento.matches ? 'dark' : 'light';
			aplicarTema(theme);
		};
		sistema.addEventListener('change', alCambiarSistema);
		return () => sistema.removeEventListener('change', alCambiarSistema);
	});

	// Sin transiciones durante el cambio: se restauran después del siguiente cuadro.
	function aplicarTema(tema: Tema) {
		const raiz = document.documentElement;
		raiz.classList.add('cambiando-tema');
		raiz.setAttribute('data-theme', tema);
		void getComputedStyle(raiz).color;
		requestAnimationFrame(() =>
			requestAnimationFrame(() => raiz.classList.remove('cambiando-tema'))
		);
	}

	function handleNavigate() {
		if (typeof window !== 'undefined' && window.innerWidth <= 768) {
			mobileMenuOpen = false;
		}
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

<div class="layout">
	<Sidebar
		activeView={currentView}
		activeCliente={cliente}
		isMobileOpen={mobileMenuOpen}
		{theme}
		on:navigate={handleNavigate}
		on:toggleTheme={toggleTheme}
	/>

	<HeaderBar menuAbierto={mobileMenuOpen} on:toggleMobileMenu={toggleMobileMenu} />

	<main class="main" id="contenido" tabindex="-1">
		<div class="view-section">
			{#if encabezado}
				<EncabezadoPagina ceja={encabezado.ceja} titulo={encabezado.titulo} />
			{/if}
			<slot />
		</div>
	</main>
</div>

<Notificaciones />
