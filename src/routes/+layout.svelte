<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	import Sidebar from '$lib/layout/Sidebar.svelte';
	import HeaderBar from '$lib/layout/HeaderBar.svelte';
	import EncabezadoPagina from '$lib/components/ui/EncabezadoPagina.svelte';
	import Notificaciones from '$lib/components/ui/Notificaciones.svelte';
	import { encabezadoDePagina, tituloDePagina, vistaDesdeRuta } from '$lib/layout/navegacion';
	import { nombreCompleto } from '$lib/dominio/personal';
	import { SESION_ABIERTA, type SesionArmazon } from '$lib/dominio/permisos';
	import {
		CLAVE_TEMA,
		guardarPreferencia,
		leerPreferencia,
		temaInicial,
		type Tema
	} from '$lib/layout/preferencias';

	// Nunito Sans: interfaz. Inter: diseño original del programa. Manrope: marca.
	import '@fontsource-variable/nunito-sans';
	import '@fontsource-variable/inter';
	import '@fontsource-variable/manrope';
	// Subconjunto latino (español) de cada fuente: se precarga para que el texto no espere al CSS.
	// Vite les da la misma URL que usa el @font-face, así que no se descargan dos veces.
	import interLatina from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
	import manropeLatina from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';
	import '../app.css';

	let mobileMenuOpen = false;
	// El script de app.html ya aplicó el tema al documento; aquí solo se sincroniza el botón.
	let theme: Tema = 'dark';

	// La vista activa y el título se derivan de la URL (rutas declaradas en navegacion.ts).
	$: pathname = $page.url.pathname;
	$: cliente = $page.url.searchParams.get('cliente');
	$: currentView = vistaDesdeRuta(pathname);
	// Entrar y activar el inicio de sesión se muestran sin menú ni cabecera.
	$: enAcceso = ($page.route.id ?? '').startsWith('/acceso');
	$: sesion = ($page.data as { sesion?: SesionArmazon }).sesion ?? SESION_ABIERTA;
	$: tituloReporte = ($page.data as { reporte?: { titulo?: string } }).reporte?.titulo ?? null;
	$: pageTitle = tituloDePagina(pathname, cliente, tituloReporte);
	$: datosPagina = $page.data as {
		contrato?: { numero?: string };
		partida?: { numero?: string };
		persona?: Parameters<typeof nombreCompleto>[0] | null;
		equipo?: { tag?: string } | null;
	};
	$: encabezado = encabezadoDePagina(pathname, cliente, {
		contrato: datosPagina.contrato?.numero,
		partida: datosPagina.partida?.numero,
		persona: datosPagina.persona ? nombreCompleto(datosPagina.persona) : null,
		equipo: datosPagina.equipo?.tag ?? null
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
	<title>{enAcceso ? 'Acceso' : pageTitle} · ICSI Reportes</title>
	<link rel="preload" href={interLatina} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={manropeLatina} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<a class="saltar-contenido" href="#contenido" on:click={saltarAlContenido}>Saltar al contenido</a>

{#if enAcceso}
	<main class="pagina-acceso" id="contenido" tabindex="-1">
		<slot />
	</main>
{:else}
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
			{sesion}
			on:navigate={handleNavigate}
			on:toggleTheme={toggleTheme}
		/>

		<HeaderBar
			menuAbierto={mobileMenuOpen}
			puedeCapturar={sesion.permisos.capturar}
			on:toggleMobileMenu={toggleMobileMenu}
		/>

		<main class="main" id="contenido" tabindex="-1">
			<div class="view-section">
				{#if encabezado}
					<EncabezadoPagina ceja={encabezado.ceja} titulo={encabezado.titulo} />
				{/if}
				<slot />
			</div>
		</main>
	</div>
{/if}

<Notificaciones />
