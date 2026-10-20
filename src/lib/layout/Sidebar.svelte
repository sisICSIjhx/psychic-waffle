<script>
  export let activeView;
  export let isCollapsed = false;
  export let theme = 'dark';
  
  // Enviamos eventos al padre (App.svelte) para cambiar vista o tema
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  /**
	 * @param {string} view
	 */
  function setView(view) {
    dispatch('navigate', view);
  }

  function toggleTheme() {
    dispatch('toggleTheme');
  }

  function toggleCollapse() {
    dispatch('toggleCollapse');
  }
</script>

<aside class="sidebar {isCollapsed ? 'collapsed' : ''}">
  <div class="sidebar-header-fixed">
    <div class="brand">
      <div class="brand-logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      {#if !isCollapsed}<span class="brand-title">ICSI V2</span>{/if}
    </div>
  </div>

  <div class="sidebar-content-scroll">
    <nav class="nav">
      
      <a href="#" class="nav-item {activeView === 'dashboard' ? 'active' : ''}" on:click|preventDefault={() => setView('dashboard')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
        {#if !isCollapsed}<span>Panel de Control</span>{/if}
      </a>

      {#if !isCollapsed}<div class="nav-header">PLANEACIÓN</div>{/if}
      <a href="#" class="nav-item {activeView === 'planeacion' ? 'active' : ''}" on:click|preventDefault={() => setView('planeacion')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        {#if !isCollapsed}<span>Anual</span>{/if}
      </a>

      {#if !isCollapsed}<div class="nav-header">CAPTURA</div>{/if}
      <a href="#" class="nav-item {activeView === 'prosasa' ? 'active' : ''}" on:click|preventDefault={() => setView('prosasa')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        {#if !isCollapsed}<span>Prosasa</span>{/if}
      </a>

      <!-- Puedes añadir el resto de los items aquí siguiendo el mismo patrón -->
      
    </nav>

    <div class="sidebar-footer">
      <button class="btn-icon" title="Colapsar menú" on:click={toggleCollapse}>
        <svg class={isCollapsed ? 'rotate-180' : ''} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <button class="btn-icon" title="Cambiar tema" on:click={toggleTheme}>
        {#if theme === 'dark'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        {/if}
      </button>
    </div>
  </div>
</aside>

<style>
  /* Estilos específicos del Sidebar traídos de tu CSS */
  .sidebar { background: var(--bg-soft); border-right: 1px solid var(--border); display:flex; flex-direction:column; height: 100%; overflow: hidden; z-index: 50; }
  .sidebar-header-fixed { padding: 20px 16px 10px 16px; flex-shrink: 0; background: var(--bg-soft); z-index: 10; }
  .brand { display:flex; align-items:center; gap:12px; height: 40px; white-space: nowrap; overflow: hidden; margin-bottom: 12px; }
  .brand-logo { width: 32px; height: 32px; border-radius: 8px; background: var(--accent-grad); display: grid; place-items: center; color: white; flex-shrink: 0; box-shadow: 0 0 15px var(--primary-soft); }
  .brand-title { font-weight: 700; font-size: 1.1rem; }
  .sidebar-content-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 0 16px 20px 16px; display: flex; flex-direction: column; gap: 16px; }
  .nav { display:flex; flex-direction: column; gap:6px; margin-top: 10px; }
  .nav-header { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 16px 0 8px 12px; font-weight: 600; white-space: nowrap; }
  .nav-item { display:flex; align-items:center; gap:12px; padding: 10px 14px; border-radius: 10px; color: var(--muted); font-weight: 500; transition: all 0.2s ease; cursor: pointer; white-space: nowrap; }
  .nav-item:hover { background: var(--hover); color: var(--text); }
  .nav-item.active { background: var(--primary-soft); color: var(--primary); }
  .nav-item svg { flex-shrink: 0; width: 20px; height: 20px; }
  .sidebar-footer { margin-top: auto; display: flex; gap: 8px; border-top: 1px solid var(--border); padding-top: 16px; }
  .btn-icon { width: 100%; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; transition: 0.2s; }
  .btn-icon:hover { background: var(--hover); color: var(--text); border-color: var(--muted); }
  
  /* Estado Colapsado */
  .sidebar.collapsed .brand { justify-content: center; }
  .sidebar.collapsed .sidebar-header-fixed { padding: 20px 10px; }
  .sidebar.collapsed .sidebar-content-scroll { padding: 0 10px 20px; }
  .sidebar.collapsed .nav-item { justify-content: center; padding: 10px; }
  .sidebar.collapsed .sidebar-footer { flex-direction: column; }
  .rotate-180 { transform: rotate(180deg); }
</style>