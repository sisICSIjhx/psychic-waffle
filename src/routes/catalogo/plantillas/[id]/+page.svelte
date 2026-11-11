<script lang="ts">
	import PlantillaEditor from '$lib/components/catalogo/PlantillaEditor.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<!-- Tras guardar, la plantilla vuelve de la base (con los ids de los conceptos nuevos). -->
{#key data.plantilla.actualizadoEn}
	<PlantillaEditor plantilla={data.plantilla} {form} />
{/key}
