<!-- Estado de un reporte con icono, texto y color; el color nunca es el único indicio. -->
<script lang="ts">
	import { ETIQUETA_ESTADO_REPORTE, type EstadoReporte } from '$lib/dominio/captura';

	export let estado: EstadoReporte;
</script>

<span class="status-badge insignia-estado estado-{estado}">
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if estado === 'borrador'}
			<path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
		{:else if estado === 'en_revision'}
			<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
		{:else if estado === 'emitido'}
			<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
		{:else}
			<polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
		{/if}
	</svg>
	{ETIQUETA_ESTADO_REPORTE[estado]}
</span>

<style>
	.insignia-estado {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: 1px solid currentColor;
		white-space: nowrap;
	}
	svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	.estado-borrador,
	.estado-sustituido {
		background: var(--neutral-bg);
		color: var(--text);
	}
	.estado-en_revision {
		background: var(--warning-bg);
		color: var(--warning);
	}
	.estado-emitido {
		background: var(--success-bg);
		color: var(--success);
	}
	.estado-sustituido {
		border-style: dashed;
	}
</style>
