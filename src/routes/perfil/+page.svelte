<script lang="ts">
	import UsuarioView from '$lib/components/views/UsuarioView.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<UsuarioView cuenta={data.cuenta} largoMinimo={data.largoMinimo} {form} />
