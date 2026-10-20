<script lang="ts">
	const indicadores = [
		'Programado del mes',
		'Realizado del mes',
		'Pendientes vencidos',
		'Borradores abiertos'
	];
</script>

<section aria-labelledby="titulo-indicadores">
	<h2 id="titulo-indicadores" class="view-heading">Indicadores del mes</h2>
	<div class="kpi-grid">
		{#each indicadores as indicador (indicador)}
			<div class="card kpi-card">
				<span class="kpi-value">—</span>
				<span class="kpi-label">{indicador}</span>
			</div>
		{/each}
	</div>
	<p class="view-note">
		Los indicadores se calcularán con el programa anual y los reportes emitidos.
	</p>
</section>
