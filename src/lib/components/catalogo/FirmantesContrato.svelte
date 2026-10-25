<!-- Firmantes del contrato. «Corregir datos» corrige errores de escritura del mismo registro y
     «Cambiar firmante desde…» (solo en el más reciente de cada función) cierra al actual el día
     anterior y registra a la persona nueva; ambos pasan por ?/ensayarCambio y la confirmación.
     «Registrar firmante» queda para las altas (?/registrarFirmante, sin motivo). -->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { primerDiaMesSiguiente, valorCambio } from '$lib/dominio/bitacora';
	import type { Firmante } from '$lib/dominio/esquemas';
	import { fechaEnZona } from '$lib/dominio/fechas';

	export let firmantes: Firmante[] = [];
	export let vigenciaInicio = '';
	export let puedeEditar = true;
	export let hoy = fechaEnZona();
	/** Firmante propuesto por el Excel importado: prellena el alta. */
	export let propuesto: { nombre: string; cargo: string; empresa: string } | null = null;
	/** Error del último ensayo de un firmante. */
	export let error: {
		error?: string;
		motivo?: string | null;
		detalle?: Record<string, unknown>;
	} | null = null;

	const FUNCIONES = { elaboro: 'Elaboró', aprobo: 'Aprobó', recibio: 'Recibió' } as const;

	type Modo = { tipo: 'corregir' | 'cambiar'; firmante: Firmante } | null;
	let modo: Modo = null;
	let valores = {
		nombre: '',
		cargo: '',
		empresa: '',
		vigenteDesde: '',
		vigenteHasta: '',
		desde: ''
	};
	const altaVacia = () => ({
		funcion: 'elaboro',
		nombre: '',
		cargo: '',
		empresa: '',
		vigenteDesde: vigenciaInicio,
		vigenteHasta: ''
	});
	let alta = altaVacia();
	let altaAbierta = false;

	$: if (propuesto) usarPropuesto(propuesto);
	// Tras guardar, el firmante vuelve con otra versión y el formulario se cierra.
	$: if (
		modo &&
		firmantes.find((x) => x.id === modo?.firmante.id)?.actualizadoEn !== modo.firmante.actualizadoEn
	)
		modo = null;
	// El más reciente de cada función es el único que puede cambiarse desde una fecha.
	$: recientes = new Set(
		Object.keys(FUNCIONES).flatMap((funcion) => {
			const deLaFuncion = firmantes
				.filter((f) => f.funcion === funcion)
				.sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde));
			return deLaFuncion.length ? [deLaFuncion[0].id] : [];
		})
	);
	$: primeraFecha =
		error?.motivo === 'fecha_cambio_invalida' && typeof error.detalle?.primeraFecha === 'string'
			? error.detalle.primeraFecha
			: '';

	async function usarPropuesto(p: { nombre: string; cargo: string; empresa: string }) {
		alta = { ...altaVacia(), ...p };
		altaAbierta = true;
		await tick();
		document.getElementById('alta-firmante-nombre')?.focus();
	}

	async function abrir(tipo: 'corregir' | 'cambiar', f: Firmante) {
		modo = { tipo, firmante: f };
		valores = {
			nombre: tipo === 'corregir' ? f.nombre : '',
			cargo: tipo === 'corregir' ? f.cargo : '',
			empresa: tipo === 'corregir' ? f.empresa : f.empresa,
			vigenteDesde: f.vigenteDesde,
			vigenteHasta: f.vigenteHasta ?? '',
			desde: primerDiaMesSiguiente(hoy)
		};
		await tick();
		document.getElementById('edicion-firmante-nombre')?.focus();
	}

	const limpiarAlta: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'success') alta = altaVacia();
			await update({ reset: false });
		};
</script>

{#if firmantes.length}
	<div class="tabla-desplazable">
		<table>
			<thead>
				<tr>
					<th>Función</th><th>Nombre</th><th>Cargo</th><th>Empresa</th><th>Vigencia</th>
					{#if puedeEditar}<th><span class="sr-only">Acciones</span></th>{/if}
				</tr>
			</thead>
			<tbody>
				{#each firmantes as f (f.id)}
					<tr>
						<td>{FUNCIONES[f.funcion]}</td>
						<td>{f.nombre}</td>
						<td>{f.cargo}</td>
						<td>{f.empresa}</td>
						<td
							>{valorCambio(f.vigenteDesde)}
							{f.vigenteHasta ? `a ${valorCambio(f.vigenteHasta)}` : 'en adelante'}</td
						>
						{#if puedeEditar}
							<td class="acciones-fila">
								<button class="action-btn edit" type="button" on:click={() => abrir('corregir', f)}
									>Corregir datos <span class="sr-only">de {FUNCIONES[f.funcion]}</span></button
								>
								{#if recientes.has(f.id)}
									<button class="action-btn edit" type="button" on:click={() => abrir('cambiar', f)}
										>Cambiar firmante desde… <span class="sr-only">{FUNCIONES[f.funcion]}</span
										></button
									>
								{/if}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="view-note">Sin firmantes. Los reportes nuevos copian los firmantes vigentes.</p>
{/if}

{#if modo}
	{@const f = modo.firmante}
	<form method="POST" action="?/ensayarCambio" use:enhance class="form-grid edicion">
		<h3 class="subtitulo">
			{modo.tipo === 'corregir'
				? `Corregir los datos de ${FUNCIONES[f.funcion]}`
				: `Cambiar el firmante de ${FUNCIONES[f.funcion]}`}
		</h3>
		<input
			type="hidden"
			name="tipo"
			value={modo.tipo === 'corregir' ? 'corregirFirmante' : 'cambiarFirmante'}
		/>
		<input type="hidden" name="firmanteId" value={f.id} />
		<input type="hidden" name="actualizadoEn" value={f.actualizadoEn} />
		{#if modo.tipo === 'cambiar'}
			<p class="nota">
				{f.nombre} quedará vigente hasta el día anterior a la fecha del cambio. Use «Corregir datos» si
				solo hay un error de escritura.
			</p>
			<div class="form-group">
				<label for="edicion-firmante-desde">Desde</label>
				<input
					id="edicion-firmante-desde"
					name="desde"
					type="date"
					required
					bind:value={valores.desde}
					aria-describedby={primeraFecha ? 'error-firmante-desde' : undefined}
				/>
				{#if primeraFecha}
					<p id="error-firmante-desde" class="error" role="alert">
						{error?.error}. La primera fecha permitida es {valorCambio(primeraFecha)}.
					</p>
				{/if}
			</div>
		{/if}
		<div class="form-group">
			<label for="edicion-firmante-nombre">Nombre</label>
			<input id="edicion-firmante-nombre" name="nombre" required bind:value={valores.nombre} />
		</div>
		<div class="form-group">
			<label for="edicion-firmante-cargo">Cargo</label>
			<input id="edicion-firmante-cargo" name="cargo" bind:value={valores.cargo} />
		</div>
		<div class="form-group">
			<label for="edicion-firmante-empresa">Empresa</label>
			<input id="edicion-firmante-empresa" name="empresa" bind:value={valores.empresa} />
		</div>
		{#if modo.tipo === 'corregir'}
			<div class="form-group">
				<label for="edicion-firmante-vigente-desde">Vigente desde</label>
				<input
					id="edicion-firmante-vigente-desde"
					name="vigenteDesde"
					type="date"
					required
					bind:value={valores.vigenteDesde}
				/>
			</div>
			<div class="form-group">
				<label for="edicion-firmante-vigente-hasta">Vigente hasta (opcional)</label>
				<input
					id="edicion-firmante-vigente-hasta"
					name="vigenteHasta"
					type="date"
					bind:value={valores.vigenteHasta}
				/>
			</div>
		{/if}
		{#if error?.error && !primeraFecha}
			<p class="error formulario" role="alert">{error.error}</p>
		{/if}
		<div class="form-group acciones-formulario">
			<button class="boton primario" type="submit">Revisar cambios</button>
			<button class="boton" type="button" on:click={() => (modo = null)}>Cancelar</button>
		</div>
	</form>
{/if}

{#if puedeEditar}
	<details bind:open={altaAbierta}>
		<summary>Registrar firmante</summary>
		<form method="POST" action="?/registrarFirmante" use:enhance={limpiarAlta} class="form-grid">
			<div class="form-group">
				<label for="alta-firmante-funcion">Función</label>
				<select id="alta-firmante-funcion" name="funcion" bind:value={alta.funcion}>
					{#each Object.entries(FUNCIONES) as [valor, etiqueta] (valor)}
						<option value={valor}>{etiqueta}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="alta-firmante-nombre">Nombre</label>
				<input id="alta-firmante-nombre" name="nombre" bind:value={alta.nombre} required />
			</div>
			<div class="form-group">
				<label for="alta-firmante-cargo">Cargo</label>
				<input id="alta-firmante-cargo" name="cargo" bind:value={alta.cargo} />
			</div>
			<div class="form-group">
				<label for="alta-firmante-empresa">Empresa</label>
				<input id="alta-firmante-empresa" name="empresa" bind:value={alta.empresa} />
			</div>
			<div class="form-group">
				<label for="alta-firmante-desde">Vigente desde</label>
				<input
					id="alta-firmante-desde"
					name="vigenteDesde"
					type="date"
					bind:value={alta.vigenteDesde}
					required
				/>
			</div>
			<div class="form-group">
				<label for="alta-firmante-hasta">Vigente hasta (opcional)</label>
				<input
					id="alta-firmante-hasta"
					name="vigenteHasta"
					type="date"
					bind:value={alta.vigenteHasta}
				/>
			</div>
			<div class="form-group acciones-formulario">
				<button class="boton primario" type="submit">Registrar</button>
			</div>
		</form>
	</details>
{/if}

<style>
	.edicion {
		margin: 12px 0;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.subtitulo {
		grid-column: 1 / -1;
		margin: 0;
		font-size: 1rem;
	}
	.nota {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.error {
		margin: 4px 0 0;
		color: var(--danger);
		font-size: 0.85rem;
	}
	.error.formulario {
		grid-column: 1 / -1;
	}
	.acciones-fila {
		white-space: nowrap;
	}
</style>
