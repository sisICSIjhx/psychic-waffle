<script lang="ts">
	import PersonalEditor from '$lib/components/personal/PersonalEditor.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

{#key data.persona?.id ?? 'nuevo'}
	<PersonalEditor
		persona={data.persona}
		clientes={data.clientes}
		sesionActivada={data.sesionActivada}
		form={form ?? (data.creado ? { mensaje: 'Persona registrada.' } : null)}
	/>
{/key}
