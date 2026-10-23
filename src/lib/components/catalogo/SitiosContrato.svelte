<!-- Sitios asociados al contrato con «Corregir clave o nombre» (avisa si otro contrato comparte el
     sitio) y «Quitar del contrato», deshabilitado con los conteos si el sitio tiene partidas,
     programas o reportes en el contrato. Ambos pasan por ?/ensayarCambio y la confirmación. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ResumenSitio, Sitio } from '$lib/dominio/esquemas';
	import { plural } from '$lib/dominio/textos';
	import ErrorCampo from '$lib/components/reportes/ErrorCampo.svelte';

	export let sitios: Sitio[] = [];
	export let resumen: ResumenSitio[] = [];
	export let puedeEditar = true;
	/** Error del último ensayo de un sitio: { motivo, error, campos }. */
	export let error: {
		tipo?: string;
		error?: string;
		motivo?: string | null;
		sitioId?: string;
	} | null = null;

	let corrigiendo: string | null = null;
	let versionAbierta = '';
	let valores = { clave: '', nombre: '' };

	$: porSitio = new Map(resumen.map((r) => [r.sitioId, r]));
	// Tras guardar, el sitio vuelve con otra versión y el formulario se cierra.
	$: if (corrigiendo && sitios.find((x) => x.id === corrigiendo)?.actualizadoEn !== versionAbierta)
		corrigiendo = null;

	function abrir(sitio: Sitio) {
		corrigiendo = corrigiendo === sitio.id ? null : sitio.id;
		versionAbierta = sitio.actualizadoEn;
		valores = { clave: sitio.clave, nombre: sitio.nombre };
	}

	function datos(r: ResumenSitio | undefined): string {
		if (!r) return '';
		return [
			r.partidas ? plural(r.partidas, 'partida') : '',
			r.programas ? plural(r.programas, 'programa') : '',
			r.reportes ? plural(r.reportes, 'reporte') : ''
		]
			.filter(Boolean)
			.join(', ');
	}
</script>

<ul class="sitios">
	{#each sitios as sitio (sitio.id)}
		{@const r = porSitio.get(sitio.id)}
		{@const conDatos = datos(r)}
		<li class="sitio">
			<div class="fila">
				<span class="nombre">{sitio.clave} {sitio.nombre}</span>
				{#if r?.otrosContratos.length}
					<span class="compartido"
						>También en {r.otrosContratos.map((k) => k.numero).join(', ')}</span
					>
				{/if}
				{#if puedeEditar}
					<span class="acciones">
						<button
							type="button"
							class="action-btn edit"
							aria-expanded={corrigiendo === sitio.id}
							on:click={() => abrir(sitio)}
							>Corregir clave o nombre <span class="sr-only">de {sitio.clave}</span></button
						>
						<form method="POST" action="?/ensayarCambio" use:enhance>
							<input type="hidden" name="tipo" value="quitarSitio" />
							<input type="hidden" name="sitioId" value={sitio.id} />
							<button
								type="submit"
								class="action-btn delete"
								disabled={!!conDatos}
								aria-describedby={conDatos ? `datos-${sitio.id}` : undefined}
								>Quitar del contrato <span class="sr-only">{sitio.clave}</span></button
							>
						</form>
					</span>
				{/if}
			</div>
			{#if conDatos}
				<p id={`datos-${sitio.id}`} class="nota">
					No se puede quitar: tiene {conDatos} en este contrato.
				</p>
			{/if}
			{#if corrigiendo === sitio.id}
				<form method="POST" action="?/ensayarCambio" use:enhance class="form-grid">
					<input type="hidden" name="tipo" value="sitio" />
					<input type="hidden" name="sitioId" value={sitio.id} />
					<input type="hidden" name="actualizadoEn" value={sitio.actualizadoEn} />
					{#if r?.otrosContratos.length}
						<p class="nota aviso-compartido">
							El sitio también está en {plural(
								r.otrosContratos.length,
								'otro contrato',
								'otros contratos'
							)}
							({r.otrosContratos.map((k) => k.numero).join(', ')}); la corrección se aplica a todos.
						</p>
					{/if}
					<div class="form-group">
						<label for={`sitio-clave-${sitio.id}`}>Clave</label>
						<input
							id={`sitio-clave-${sitio.id}`}
							name="clave"
							required
							bind:value={valores.clave}
							aria-describedby={error?.motivo === 'sitio_duplicado'
								? `error-clave-${sitio.id}`
								: undefined}
						/>
						<ErrorCampo
							id={`error-clave-${sitio.id}`}
							mensaje={error?.motivo === 'sitio_duplicado' ? (error.error ?? '') : ''}
						/>
					</div>
					<div class="form-group">
						<label for={`sitio-nombre-${sitio.id}`}>Nombre</label>
						<input id={`sitio-nombre-${sitio.id}`} name="nombre" bind:value={valores.nombre} />
					</div>
					{#if error?.error && error.motivo !== 'sitio_duplicado'}
						<p class="nota error" role="alert">{error.error}</p>
					{/if}
					<div class="form-group acciones-formulario">
						<button class="boton primario" type="submit">Revisar cambios</button>
						<button class="boton" type="button" on:click={() => (corrigiendo = null)}
							>Cancelar</button
						>
					</div>
				</form>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.sitios {
		list-style: none;
		margin: 12px 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.sitio {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 12px;
		min-width: 0;
	}
	.fila {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.nombre {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.compartido {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.acciones {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}
	.acciones form {
		display: inline;
	}
	.nota {
		margin: 4px 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.nota.error {
		color: var(--danger);
	}
	.aviso-compartido {
		grid-column: 1 / -1;
	}
</style>
