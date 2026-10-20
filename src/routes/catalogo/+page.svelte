<script lang="ts">
	import CatalogoView from '$lib/components/views/CatalogoView.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<CatalogoView clientes={data.clientes} contratos={data.contratos} conteos={data.conteos} {form} />
