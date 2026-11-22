<!-- Campos de un adicional (alta y edición): lo que llena administración. Lo cobrado es de
     contabilidad y no está aquí. -->
<script lang="ts">
	/** Distingue los campos de cada formulario (`adicional-nuevo`, `adicional-<id>`). */
	export let prefijo: string;
	export let ordenCompra = '';
	export let descripcion = '';
	export let fechaSolicitud = '';
	export let periodoInicio = '';
	export let periodoFin = '';
	export let montoPactado = '';
</script>

<div class="campos">
	<div class="form-group">
		<label for={`${prefijo}-orden`}>Orden de compra</label>
		<input
			id={`${prefijo}-orden`}
			type="text"
			name="ordenCompra"
			required
			maxlength="100"
			autocomplete="off"
			value={ordenCompra}
		/>
	</div>
	<div class="form-group">
		<label for={`${prefijo}-monto`}>Monto pactado (opcional)</label>
		<input
			id={`${prefijo}-monto`}
			type="number"
			name="montoPactado"
			min="0"
			max="999999999999.99"
			step="0.01"
			inputmode="decimal"
			value={montoPactado}
		/>
	</div>
	<div class="form-group ancho">
		<label for={`${prefijo}-descripcion`}>Descripción (opcional)</label>
		<input
			id={`${prefijo}-descripcion`}
			type="text"
			name="descripcion"
			maxlength="500"
			autocomplete="off"
			value={descripcion}
		/>
	</div>
	<div class="form-group">
		<label for={`${prefijo}-solicitud`}>Fecha de solicitud (opcional)</label>
		<input id={`${prefijo}-solicitud`} type="date" name="fechaSolicitud" value={fechaSolicitud} />
	</div>
	<div class="form-group">
		<label for={`${prefijo}-inicio`}>Inicio de la ejecución (opcional)</label>
		<input id={`${prefijo}-inicio`} type="date" name="periodoInicio" bind:value={periodoInicio} />
	</div>
	<div class="form-group">
		<label for={`${prefijo}-fin`}>Fin de la ejecución (opcional)</label>
		<input
			id={`${prefijo}-fin`}
			type="date"
			name="periodoFin"
			min={periodoInicio || undefined}
			value={periodoFin}
		/>
	</div>
</div>

<style>
	.campos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
		gap: 12px 16px;
		margin-bottom: 12px;
	}
	.form-group {
		margin: 0;
		min-width: 0;
	}
	.ancho {
		grid-column: 1 / -1;
	}
</style>
