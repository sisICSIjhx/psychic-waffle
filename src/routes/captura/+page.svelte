<script lang="ts">
	import CapturaView from '$lib/components/views/CapturaView.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<!-- La clave de la partida reinicia el formulario al cambiar de selección. -->
{#key data.partida?.id}
	<CapturaView {...data} {form} />
{/key}
