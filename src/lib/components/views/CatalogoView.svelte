<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { Cliente, Contrato } from '$lib/dominio/esquemas';
	import TextField from '$lib/components/fields/TextField.svelte';
	import SelectField from '$lib/components/fields/SelectField.svelte';
	import DateField from '$lib/components/fields/DateField.svelte';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';

	export let clientes: Cliente[] = [];
	export let contratos: Contrato[] = [];
	export let conteos: { contratoId: string; partidas: number; porConfirmar: number }[] = [];
	export let form: { accion?: string; mensaje?: string; error?: string } | null = null;

	$: conteosPorContrato = new Map(conteos.map((c) => [c.contratoId, c]));
	$: opcionesCliente = clientes.map((c) => ({
		value: c.id,
		label: `${c.nombre} (${c.razonSocial})`
	}));
</script>

<Aviso {form} />

<section class="card" aria-labelledby="titulo-contratos">
	<h2 id="titulo-contratos" class="view-heading">Contratos</h2>
	{#if contratos.length === 0}
		<p class="view-note">
			Aún no hay contratos. Registre un cliente y su contrato para cargar el catálogo de partidas.
		</p>
	{:else}
		<div class="tabla-desplazable">
			<table>
				<thead>
					<tr>
						<th>Cliente</th>
						<th>Contrato / OC</th>
						<th>Vigencia</th>
						<th>Partidas</th>
						<th><span class="sr-only">Acciones</span></th>
					</tr>
				</thead>
				<tbody>
					{#each contratos as contrato (contrato.id)}
						<tr>
							<td>{contrato.cliente?.nombre ?? '—'}</td>
							<td>{contrato.numero}</td>
							<td>
								{contrato.vigenciaInicio} a {contrato.vigenciaFin}
								{#if contrato.vigente}<span class="status-badge vigente">Vigente</span>{/if}
							</td>
							<td>
								{conteosPorContrato.get(contrato.id)?.partidas ?? 0}
								{#if (conteosPorContrato.get(contrato.id)?.porConfirmar ?? 0) > 0}
									<span class="status-badge por-confirmar"
										>{conteosPorContrato.get(contrato.id)?.porConfirmar} por confirmar</span
									>
								{/if}
							</td>
							<td
								><a class="enlace" href={resolve('/catalogo/contratos/[id]', { id: contrato.id })}
									>Abrir</a
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<div class="form-grid">
	<details class="card" open={clientes.length === 0}>
		<summary class="view-heading">Nuevo cliente</summary>
		<form method="POST" action="?/crearCliente" use:enhance>
			<TextField label="Clave (para el menú de Captura)" name="clave" placeholder="cerritos" />
			<TextField label="Nombre" name="nombre" placeholder="Cerritos" />
			<TextField label="Razón social" name="razonSocial" placeholder="TEMEX GAS" />
			<button class="boton primario" type="submit">Registrar cliente</button>
		</form>
	</details>

	<details class="card" open={clientes.length > 0 && contratos.length === 0}>
		<summary class="view-heading">Nuevo contrato</summary>
		<form method="POST" action="?/crearContrato" use:enhance>
			<SelectField label="Cliente" name="clienteId" options={opcionesCliente} required />
			<TextField label="Número de contrato u OC" name="numero" />
			<TextField label="Descripción (opcional)" name="descripcion" />
			<DateField label="Vigente desde" name="vigenciaInicio" required />
			<DateField label="Vigente hasta" name="vigenciaFin" required />
			<button class="boton primario" type="submit" disabled={clientes.length === 0}
				>Registrar contrato</button
			>
		</form>
	</details>
</div>
