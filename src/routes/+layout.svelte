<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  import Sidebar from '$lib/layout/Sidebar.svelte';
  import HeaderBar from '$lib/layout/HeaderBar.svelte';

  import '../app.css';

  let sidebarCollapsed = false;
  let mobileMenuOpen = false;
  let theme = 'dark';

  const titles = {
    dashboard: 'Panel de Control',
    planeacion: 'Planeación Anual',
    prosasa: 'Captura: Prosasa',
    virtual: 'Captura: Virtual',
    proagro: 'Captura: Proagro',
    historial: 'Historial Global',
    personal: 'Administración de Personal',
    usuario: 'Mi Perfil'
  };

  const routesByView = {
    dashboard: '/dashboard',
    planeacion: '/planeacion',
    prosasa: '/prosasa',
    virtual: '/virtual',
    proagro: '/proagro',
    historial: '/historial',
    personal: '/personal',
    usuario: '/usuario'
  };

  // view actual basado en URL (ya no por estado manual)
  $: pathname = $page.url.pathname;
  $: currentView =
    pathname === '/' ? 'dashboard' : (pathname.split('/')[1] || 'dashboard');

  $: pageTitle = titles[currentView] || 'ICSI Reportes';

  onMount(() => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  function handleSelectView(event) {
    const view = event.detail?.view ?? 'dashboard';
    goto(routesByView[view] ?? '/dashboard');

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
</script>

<div
  class="sidebar-overlay"
  class:active={mobileMenuOpen}
  on:click={toggleMobileMenu}
></div>

<div class="layout" class:is-collapsed={sidebarCollapsed}>
  <Sidebar
    {currentView}
    {sidebarCollapsed}
    {mobileMenuOpen}
    {theme}
    on:selectView={handleSelectView}
    on:toggleCollapse={toggleSidebarCollapse}
    on:toggleTheme={toggleTheme}
  />

  <HeaderBar {pageTitle} on:toggleMobileMenu={toggleMobileMenu} />

  <main class="main">
    <div class="view-section">
      <slot />
    </div>
  </main>
</div>
