<script lang="ts">
	import CentrosCostoView from '$lib/components/catalogo/CentrosCostoView.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<CentrosCostoView
	centros={data.centros}
	plantillas={data.plantillas}
	puedeEditar={data.puedeEditar}
	{form}
/>
