<script lang="ts">
	import ContratoView from '$lib/components/catalogo/ContratoView.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	$: resultado = form as Record<string, unknown> | null;
</script>

<ContratoView
	contrato={data.contrato}
	sitios={data.sitios}
	sitio={data.sitio}
	estado={data.estado}
	partidas={data.partidas}
	equipos={data.equipos}
	firmantes={data.firmantes}
	programas={data.programas}
	form={resultado}
/>
