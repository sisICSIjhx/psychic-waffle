<script lang="ts">
	import { navigating, page } from '$app/stores';
	import CumplimientoView from '$lib/components/views/CumplimientoView.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Cambio de mes, de filtro o de búsqueda: la misma página con otra consulta.
	$: cargando = $navigating?.to?.url.pathname === $page.url.pathname;
</script>

<CumplimientoView {...data} {cargando} />
