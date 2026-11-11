<script lang="ts">
	import PlantillasView from '$lib/components/catalogo/PlantillasView.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<PlantillasView plantillas={data.plantillas} {form} />
