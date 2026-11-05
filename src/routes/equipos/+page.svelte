<script lang="ts">
	import CatalogoEquipos from '$lib/components/equipos/CatalogoEquipos.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

{#key data.proyecto?.id ?? 'ninguno'}
	<CatalogoEquipos
		clientes={data.clientes}
		proyecto={data.proyecto}
		equipos={data.equipos}
		sitios={data.sitios}
		hoy={data.hoy}
		puedeEditar={data.puedeEditar}
		form={form ?? (data.eliminado ? { mensaje: 'Equipo eliminado.' } : null)}
	/>
{/key}
