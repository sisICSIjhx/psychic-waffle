<script lang="ts">
	import AlcancesPredeterminados from '$lib/components/catalogo/AlcancesPredeterminados.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<AlcancesPredeterminados
	clientes={data.clientes}
	proyecto={data.proyecto}
	alcances={data.alcances}
	puedeEditar={data.puedeEditar}
	{form}
/>
