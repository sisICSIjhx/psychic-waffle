<script lang="ts">
	import PartidaEditor from '$lib/components/catalogo/PartidaEditor.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

{#key data.partida?.id ?? 'nueva'}
	<PartidaEditor
		partida={data.partida}
		contrato={data.contrato}
		sitio={data.sitio}
		equipos={data.equipos}
		{form}
	/>
{/key}
