<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { resolve } from '$app/paths';
	import { clientesCaptura, type VistaId } from './navegacion';

	export let activeView: VistaId | null = 'dashboard';
	export let activeCliente: string | null = null;
	export let isCollapsed = false;
	export let isMobileOpen = false;
	export let theme = 'dark';

	// El enlace navega por sí mismo; el evento avisa al layout (por ejemplo, para cerrar el menú móvil).
	const dispatch = createEventDispatcher<{
		navigate: { view: VistaId; cliente?: string };
		toggleTheme: void;
		toggleCollapse: void;
	}>();

	function navigate(view: VistaId, cliente?: string) {
		dispatch('navigate', { view, cliente });
	}

	function toggleTheme() {
		dispatch('toggleTheme');
	}

	function toggleCollapse() {
		dispatch('toggleCollapse');
	}
</script>

<aside
	id="menu-principal"
	class="sidebar {isCollapsed ? 'collapsed' : ''}"
	class:mobile-open={isMobileOpen}
>
	<div class="sidebar-header-fixed">
		<div class="brand">
			<div class="brand-logo">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg
				>
			</div>
			{#if !isCollapsed}<span class="brand-title">ICSI Reportes</span>{/if}
		</div>
	</div>

	<div class="sidebar-content-scroll">
		<nav class="nav" aria-label="Navegación principal">
			<a
				href={resolve('/')}
				class="nav-item {activeView === 'dashboard' ? 'active' : ''}"
				aria-current={activeView === 'dashboard' ? 'page' : undefined}
				title="Mi trabajo"
				on:click={() => navigate('dashboard')}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><rect x="3" y="3" width="7" height="9" rx="1" /><rect
						x="14"
						y="3"
						width="7"
						height="5"
						rx="1"
					/><rect x="14" y="12" width="7" height="9" rx="1" /><rect
						x="3"
						y="16"
						width="7"
						height="5"
						rx="1"
					/></svg
				>
				{#if !isCollapsed}<span>Mi trabajo</span>{/if}
			</a>

			{#if !isCollapsed}<div class="nav-header">Planeación</div>{/if}
			<a
				href={resolve('/planeacion')}
				class="nav-item {activeView === 'planeacion' ? 'active' : ''}"
				aria-current={activeView === 'planeacion' ? 'page' : undefined}
				title="Planeación Anual"
				on:click={() => navigate('planeacion')}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line
						x1="16"
						y1="2"
						x2="16"
						y2="6"
					/><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg
				>
				{#if !isCollapsed}<span>Anual</span>{/if}
			</a>

			{#if !isCollapsed}<div class="nav-header">Captura</div>{/if}
			{#each clientesCaptura as cliente (cliente.clave)}
				<!-- resolve() se aplica a la ruta; el filtro por cliente va en la consulta. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={`${resolve('/captura')}?cliente=${cliente.clave}`}
					class="nav-item {activeView === 'captura' && activeCliente === cliente.clave
						? 'active'
						: ''}"
					aria-current={activeView === 'captura' && activeCliente === cliente.clave
						? 'page'
						: undefined}
					title={`Captura: ${cliente.etiqueta}`}
					on:click={() => navigate('captura', cliente.clave)}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
							points="14 2 14 8 20 8"
						/><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg
					>
					{#if !isCollapsed}<span>{cliente.etiqueta}</span>{/if}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}

			{#if !isCollapsed}<div class="nav-header">Reportes</div>{/if}
			<a
				href={resolve('/historial')}
				class="nav-item {activeView === 'historial' ? 'active' : ''}"
				aria-current={activeView === 'historial' ? 'page' : undefined}
				title="Historial Global"
				on:click={() => navigate('historial')}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg
				>
				{#if !isCollapsed}<span>Historial Global</span>{/if}
			</a>
			<a
				href={resolve('/catalogo')}
				class="nav-item {activeView === 'catalogo' ? 'active' : ''}"
				aria-current={activeView === 'catalogo' ? 'page' : undefined}
				title="Catálogo de Contratos"
				on:click={() => navigate('catalogo')}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path
						d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
					/></svg
				>
				{#if !isCollapsed}<span>Catálogo</span>{/if}
			</a>

			<!-- «Personal» y «Mi Perfil» vuelven al menú con la autenticación; hoy no tienen contenido. -->
		</nav>

		<div class="sidebar-footer">
			<button
				class="btn-icon btn-contraer"
				type="button"
				title={isCollapsed ? 'Expandir el menú' : 'Contraer el menú'}
				aria-label={isCollapsed ? 'Expandir el menú' : 'Contraer el menú'}
				aria-expanded={!isCollapsed}
				on:click={toggleCollapse}
			>
				<svg
					class={isCollapsed ? 'rotate-180' : ''}
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg
				>
			</button>
			<button
				class="btn-icon"
				type="button"
				title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
				aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
				on:click={toggleTheme}
			>
				{#if theme === 'dark'}
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line
							x1="12"
							y1="21"
							x2="12"
							y2="23"
						/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line
							x1="18.36"
							y1="18.36"
							x2="19.78"
							y2="19.78"
						/><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line
							x1="4.22"
							y1="19.78"
							x2="5.64"
							y2="18.36"
						/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg
					>
				{:else}
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg
					>
				{/if}
			</button>
		</div>
	</div>
</aside>

<style>
	/* Estilos específicos del Sidebar traídos de tu CSS */
	.sidebar {
		background: var(--bg-soft);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		z-index: 50;
	}
	.sidebar-header-fixed {
		padding: 20px 16px 10px 16px;
		flex-shrink: 0;
		background: var(--bg-soft);
		z-index: 10;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 40px;
		white-space: nowrap;
		overflow: hidden;
		margin-bottom: 12px;
	}
	.brand-logo {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--accent-grad);
		display: grid;
		place-items: center;
		color: white;
		flex-shrink: 0;
		box-shadow: 0 0 15px var(--primary-soft);
	}
	.brand-title {
		font-weight: 700;
		font-size: 1.1rem;
	}
	.sidebar-content-scroll {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0 16px 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.nav {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 10px;
	}
	.nav-header {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		margin: 16px 0 8px 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 10px;
		color: var(--muted);
		font-weight: 500;
		transition: all 0.2s ease;
		cursor: pointer;
		white-space: nowrap;
	}
	.nav-item:hover {
		background: var(--hover);
		color: var(--text);
	}
	.nav-item.active {
		background: var(--primary-soft);
		color: var(--primary);
	}
	.nav-item svg {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
	}
	.sidebar-footer {
		margin-top: auto;
		display: flex;
		gap: 8px;
		border-top: 1px solid var(--border);
		padding-top: 16px;
	}
	.btn-icon {
		width: 100%;
		height: var(--alto-control);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		transition: 0.2s;
	}
	.btn-icon:hover {
		background: var(--hover);
		color: var(--text);
		border-color: var(--muted);
	}

	/* Estado Colapsado */
	.sidebar.collapsed .brand {
		justify-content: center;
	}
	.sidebar.collapsed .sidebar-header-fixed {
		padding: 20px 10px;
	}
	.sidebar.collapsed .sidebar-content-scroll {
		padding: 0 10px 20px;
	}
	.sidebar.collapsed .nav-item {
		justify-content: center;
		padding: 10px;
	}
	.sidebar.collapsed .sidebar-footer {
		flex-direction: column;
	}
	.rotate-180 {
		transform: rotate(180deg);
	}
	/* En móvil el menú se abre y cierra desde la cabecera; contraerlo no aplica. */
	@media (max-width: 768px) {
		.btn-contraer {
			display: none;
		}
	}
</style>
