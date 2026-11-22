<!-- Estatus de un centro de costo en un mes: icono, texto y color (nunca solo color). La forma del
     icono cambia con cada estatus: triángulo, reloj, marca y círculo con guion. -->
<script lang="ts">
	import { AYUDA_ESTATUS, ETIQUETA_ESTATUS, type EstatusCentro } from '$lib/dominio/estatus';
	import { CLASE_ESTATUS, TRAZOS_ESTATUS } from './iconos';

	export let estatus: EstatusCentro;
	export let grande = false;
</script>

<span
	class="status-badge insignia-estatus {CLASE_ESTATUS[estatus]}"
	class:grande
	title={AYUDA_ESTATUS[estatus]}
	data-estatus={estatus}
>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.25"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#each TRAZOS_ESTATUS[estatus] as trazo (trazo)}<path d={trazo} />{/each}
	</svg>
	{ETIQUETA_ESTATUS[estatus]}
</span>

<style>
	svg {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
	}
	.grande svg {
		width: 16px;
		height: 16px;
	}
</style>
