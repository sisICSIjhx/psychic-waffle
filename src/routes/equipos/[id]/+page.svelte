<script lang="ts">
	import EquipoEditor from '$lib/components/equipos/EquipoEditor.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

{#key data.equipo?.id ?? 'nuevo'}
	<EquipoEditor
		equipo={data.equipo}
		proyecto={data.proyecto}
		sitios={data.sitios}
		hoy={data.hoy}
		puedeEditar={data.puedeEditar}
		form={form ?? (data.creado ? { mensaje: 'Equipo registrado.' } : null)}
	/>
{/key}
