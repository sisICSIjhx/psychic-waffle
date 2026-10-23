<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import EditorReporte from '$lib/components/reportes/EditorReporte.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let editor: EditorReporte | undefined;

	// Una navegación interna espera a que se guarden los últimos cambios; al cerrar la pestaña avisa
	// el propio editor (beforeunload).
	beforeNavigate(({ cancel, to, type }) => {
		if (type === 'leave' || !to || !editor?.hayCambiosPendientes()) return;
		cancel();
		editor.guardarAhora().then((guardado) => {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- destino ya resuelto por SvelteKit
			if (guardado) goto(to.url);
		});
	});
</script>

<!-- Al abrir otro reporte (p. ej. una revisión nueva) el editor empieza de cero. -->
{#key data.reporte.id}
	<EditorReporte
		bind:this={editor}
		reporte={data.reporte}
		equiposPartida={data.equiposPartida}
		catalogoCambiado={data.catalogoCambiado}
		contratoCambiado={data.contratoCambiado}
		camposContrato={data.camposContrato}
		partidaPorConfirmar={data.partidaPorConfirmar}
	/>
{/key}
