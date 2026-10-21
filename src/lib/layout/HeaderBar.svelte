<!-- HeaderBar.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let pageTitle = 'Panel de Control';
	export let menuAbierto = false;

	const dispatch = createEventDispatcher<{ toggleMobileMenu: void }>();

	function toggleMobileMenu() {
		dispatch('toggleMobileMenu');
	}
</script>

<header class="header">
	<div class="header-left">
		<button
			class="mobile-menu-trigger"
			type="button"
			aria-label={menuAbierto ? 'Cerrar el menú' : 'Abrir el menú'}
			aria-expanded={menuAbierto}
			aria-controls="menu-principal"
			on:click={toggleMobileMenu}
		>
			<div class="brand-logo" style="width: 28px; height: 28px; box-shadow: none">
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
				</svg>
			</div>
		</button>
		<h1 class="header-title">{pageTitle}</h1>
	</div>

	<div style="font-size: 0.9rem; color: var(--muted); display: flex; align-items: center; gap: 8px">
		<span
			style="width: 8px; height: 8px; background: var(--success); border-radius: 50%; display: block"
		></span>
		<span>Conectado</span>
	</div>
</header>
