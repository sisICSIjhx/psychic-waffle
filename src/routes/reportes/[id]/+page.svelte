<script lang="ts">
	import EditorReporte from '$lib/components/reportes/EditorReporte.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<!-- Al abrir otro reporte (p. ej. una revisión nueva) el editor empieza de cero. -->
{#key data.reporte.id}
	<EditorReporte
		reporte={data.reporte}
		equiposPartida={data.equiposPartida}
		catalogoCambiado={data.catalogoCambiado}
		partidaPorConfirmar={data.partidaPorConfirmar}
	/>
{/key}
