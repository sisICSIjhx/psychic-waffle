<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import CampoConcepto from '$lib/components/cobranza/CampoConcepto.svelte';
	import {
		mesesDelAnio,
		PASOS_COBRANZA,
		textoMonto,
		totalCobrado,
		type ValorConcepto
	} from '$lib/dominio/cobranza';
	import { textoFechaCorta } from '$lib/dominio/equipos';
	import { ETIQUETA_MODO_CONTRATO } from '$lib/dominio/seguimiento';
	import { textoMes } from '$lib/dominio/textos';
	import type { PageProps } from './$types';

	export let data: PageProps['data'];
	export let form: PageProps['form'];

	$: ({ centro, anio, detalle, puedeEditarContrato, puedeEditarCobranza } = data);
	$: contrato = detalle?.contrato;
	$: filtro = new URLSearchParams({ centro: centro?.id ?? '', anio: String(anio) }).toString();
	$: urlGuardar = `${resolve('/cobranza')}?/guardar&${filtro}`;
	$: conceptosContrato = contrato?.conceptos.filter((c) => c.bloque === 'contrato') ?? [];
	$: conceptosOrden = contrato?.conceptos.filter((c) => c.bloque === 'ordenes_compra') ?? [];
	$: valoresContrato = mapa(contrato?.valores ?? []);
	$: meses = mesesDelAnio(anio, contrato?.cobranza ?? []);

	function mapa(valores: { conceptoId: string; valor: ValorConcepto }[]) {
		return new Map(valores.map((v) => [v.conceptoId, v.valor]));
	}

	const enviar: SubmitFunction = ({ formElement, cancel }) => {
		if (formElement.getAttribute('aria-busy') === 'true') {
			cancel();
			return;
		}
		formElement.setAttribute('aria-busy', 'true');
		return async ({ update }) => {
			try {
				// Los formularios muestran lo guardado: no se vacían al terminar.
				await update({ reset: false });
			} finally {
				formElement.removeAttribute('aria-busy');
			}
		};
	};
</script>

{#if data.centros.length === 0}
	<p class="card">No hay centros de costo disponibles para tu cuenta.</p>
{:else if centro && detalle}
	<section class="card bloque" aria-label="Centro de costo y año">
		<form method="GET" action={resolve('/cobranza')} class="filtros">
			<div class="form-group">
				<label for="cobranza-centro">Centro de costo</label>
				<select id="cobranza-centro" name="centro" value={centro.id}>
					{#each data.centros as opcion (opcion.id)}
						<option value={opcion.id}
							>{opcion.clave}{opcion.nombre ? ` · ${opcion.nombre}` : ''}</option
						>
					{/each}
				</select>
			</div>
			{#if contrato}
				<div class="form-group">
					<label for="cobranza-anio">Año de cobranza</label>
					<input id="cobranza-anio" type="number" name="anio" min="2000" max="2100" value={anio} />
				</div>
			{/if}
			<button class="boton">Consultar</button>
		</form>
	</section>

	{#if puedeEditarContrato || puedeEditarCobranza}
		<div class="resultado">
			{#if form?.error}
				<p class="respuesta error" role="alert">{form.error}</p>
			{:else if form?.mensaje}
				<p class="respuesta guardado" role="status">{form.mensaje}</p>
			{/if}
		</div>
	{/if}

	{#if contrato?.cartaFaltante}
		<p class="aviso-carta" role="alert">
			El contrato de este centro de costo ya terminó y falta la carta de finalización.
		</p>
	{/if}

	{#key filtro}
		{#if detalle.programaEnlace !== undefined}
			<section class="card bloque" aria-labelledby="titulo-programa">
				<h2 class="view-heading" id="titulo-programa">Programa anual</h2>
				{#if detalle.programaEnlace}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- enlace externo de SharePoint -->
					<a href={detalle.programaEnlace} target="_blank" rel="noopener noreferrer"
						>Abrir el programa anual en SharePoint</a
					>
				{:else}
					<p class="view-note">Sin enlace registrado.</p>
				{/if}
				{#if puedeEditarContrato}
					<form method="POST" action={urlGuardar} use:enhance={enviar} class="en-linea">
						<div class="form-group">
							<label for="programa-enlace">Enlace de SharePoint del programa anual</label>
							<input
								id="programa-enlace"
								type="url"
								name="enlace"
								maxlength="2048"
								placeholder="https://…sharepoint.com/…"
								value={detalle.programaEnlace ?? ''}
							/>
						</div>
						<button class="boton primario" name="accion" value="programa">Guardar enlace</button>
					</form>
				{/if}
			</section>
		{/if}

		{#if contrato}
			<section class="card bloque" aria-labelledby="titulo-contrato">
				<div class="encabezado">
					<h2 class="view-heading" id="titulo-contrato">Contrato</h2>
					{#if contrato.modoContrato}
						<span class="view-note">{ETIQUETA_MODO_CONTRATO[contrato.modoContrato]}</span>
					{/if}
				</div>
				{#if contrato.contratos.length}
					<p class="view-note">
						En el catálogo:
						{#each contrato.contratos as registrado, i (registrado.id)}
							{i ? '; ' : ''}<a href={resolve('/catalogo/contratos/[id]', { id: registrado.id })}
								>{registrado.numero}</a
							>, vigente del {textoFechaCorta(registrado.vigenciaInicio)} al
							{textoFechaCorta(registrado.vigenciaFin)}
						{/each}
					</p>
				{/if}
				{#if !detalle.plantillaId}
					<p class="view-note">Este centro de costo aún no tiene una plantilla de seguimiento.</p>
				{:else if !conceptosContrato.length}
					<p class="view-note">La plantilla de este centro no define datos del contrato.</p>
				{:else if puedeEditarContrato}
					<form method="POST" action={urlGuardar} use:enhance={enviar}>
						<div class="campos">
							{#each conceptosContrato as concepto (concepto.id)}
								<CampoConcepto
									{concepto}
									valor={valoresContrato.get(concepto.id) ?? null}
									prefijo="contrato"
									editable
								/>
							{/each}
						</div>
						<button class="boton primario" name="accion" value="contrato">Guardar contrato</button>
					</form>
				{:else}
					<dl class="datos">
						{#each conceptosContrato as concepto (concepto.id)}
							<div>
								<dt>{concepto.etiqueta}</dt>
								<dd>
									<CampoConcepto {concepto} valor={valoresContrato.get(concepto.id) ?? null} />
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
			</section>

			{#if conceptosOrden.length}
				<section class="card bloque" aria-labelledby="titulo-ordenes">
					<h2 class="view-heading" id="titulo-ordenes">Órdenes de compra</h2>
					{#if contrato.ordenes.length}
						<!-- La región permite desplazar la tabla con teclado. -->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<div class="tabla" tabindex="0" role="region" aria-label="Órdenes de compra">
							<table>
								<thead>
									<tr>
										{#each conceptosOrden as concepto (concepto.id)}
											<th scope="col">{concepto.etiqueta}</th>
										{/each}
										{#if puedeEditarContrato}<th scope="col">Acciones</th>{/if}
									</tr>
								</thead>
								<tbody>
									{#each contrato.ordenes as orden, i (orden.id)}
										{@const valores = mapa(orden.valores)}
										<tr>
											{#each conceptosOrden as concepto (concepto.id)}
												<td
													><CampoConcepto {concepto} valor={valores.get(concepto.id) ?? null} /></td
												>
											{/each}
											{#if puedeEditarContrato}
												<td>
													<details>
														<summary>Editar orden {i + 1}</summary>
														<form method="POST" action={urlGuardar} use:enhance={enviar}>
															<input type="hidden" name="id" value={orden.id} />
															<div class="campos">
																{#each conceptosOrden as concepto (concepto.id)}
																	<CampoConcepto
																		{concepto}
																		valor={valores.get(concepto.id) ?? null}
																		prefijo={`orden-${orden.id}`}
																		editable
																	/>
																{/each}
															</div>
															<button class="boton compacto" name="accion" value="editarOrden"
																>Guardar</button
															>
															<button
																class="boton compacto peligro"
																name="accion"
																value="quitarOrden"
																formnovalidate>Quitar orden</button
															>
														</form>
													</details>
												</td>
											{/if}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="view-note">Sin órdenes de compra registradas.</p>
					{/if}
					{#if puedeEditarContrato}
						{#key data.idOrden}
							<form method="POST" action={urlGuardar} use:enhance={enviar} class="nueva">
								<h3>Nueva orden de compra</h3>
								<input type="hidden" name="id" value={data.idOrden} />
								<div class="campos">
									{#each conceptosOrden as concepto (concepto.id)}
										<CampoConcepto {concepto} prefijo="orden-nueva" editable />
									{/each}
								</div>
								<button class="boton primario" name="accion" value="nuevaOrden"
									>Agregar orden</button
								>
							</form>
						{/key}
					{/if}
				</section>
			{/if}

			<section class="card bloque" aria-labelledby="titulo-carta">
				<h2 class="view-heading" id="titulo-carta">Carta de finalización</h2>
				{#if puedeEditarContrato}
					<form method="POST" action={urlGuardar} use:enhance={enviar} class="en-linea carta">
						<div class="form-group">
							<label for="carta-fecha">Fecha de la carta</label>
							<input id="carta-fecha" type="date" name="fecha" value={contrato.carta.fecha ?? ''} />
						</div>
						<div class="form-group">
							<label for="carta-enlace">Enlace de SharePoint</label>
							<input
								id="carta-enlace"
								type="url"
								name="enlace"
								maxlength="2048"
								placeholder="https://…sharepoint.com/…"
								value={contrato.carta.enlace ?? ''}
							/>
						</div>
						<button class="boton primario" name="accion" value="carta">Guardar carta</button>
					</form>
				{/if}
				{#if contrato.carta.fecha}
					<p class="view-note">
						Fechada el {textoFechaCorta(contrato.carta.fecha)}{#if contrato.carta.enlace}
							·
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- enlace externo de SharePoint -->
							<a href={contrato.carta.enlace} target="_blank" rel="noopener noreferrer"
								>Abrir en SharePoint</a
							>{/if}
					</p>
				{:else}
					<p class="view-note">
						Sin carta registrada. Solo es obligatoria cuando el contrato termina.
					</p>
				{/if}
			</section>

			<section class="card bloque" aria-labelledby="titulo-cobranza">
				<div class="encabezado">
					<h2 class="view-heading" id="titulo-cobranza">Cobranza {anio}</h2>
					<p class="total">Cobrado en el año: <strong>{textoMonto(totalCobrado(meses))}</strong></p>
				</div>
				<form method="POST" action={urlGuardar} use:enhance={enviar}>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div class="tabla" tabindex="0" role="region" aria-label={`Cobranza ${anio}`}>
						<table>
							<thead>
								<tr>
									<th scope="col">Mes</th>
									{#each PASOS_COBRANZA as [paso, etiqueta] (paso)}
										<th scope="col">{etiqueta}</th>
									{/each}
									<th scope="col">Monto cobrado</th>
								</tr>
							</thead>
							<tbody>
								{#each meses as mes (mes.mes)}
									{@const mm = mes.mes.slice(5, 7)}
									{@const nombre = textoMes(mes.mes.slice(0, 7), { inicial: true })}
									<tr>
										<th scope="row">{nombre}</th>
										{#each PASOS_COBRANZA as [paso, etiqueta] (paso)}
											<td>
												{#if puedeEditarCobranza}
													<input
														type="checkbox"
														name={`${paso}-${mm}`}
														checked={mes[paso]}
														aria-label={`${etiqueta} · ${nombre}`}
													/>
												{:else}
													<span class="sr-only"
														>{etiqueta} · {mes[paso] ? 'Hecho' : 'Pendiente'}</span
													>
													<span aria-hidden="true">{mes[paso] ? '✓' : '—'}</span>
												{/if}
											</td>
										{/each}
										<td class="monto">
											{#if puedeEditarCobranza}
												<input
													type="number"
													name={`monto-${mm}`}
													min="0"
													max="999999999999.99"
													step="0.01"
													inputmode="decimal"
													value={mes.montoCobrado ?? ''}
													aria-label={`Monto cobrado · ${nombre}`}
												/>
											{:else}
												{mes.montoCobrado === null ? '—' : textoMonto(mes.montoCobrado)}
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{#if puedeEditarCobranza}
						<button class="boton primario" name="accion" value="cobranza">Guardar cobranza</button>
					{/if}
				</form>
			</section>
		{/if}
	{/key}
{/if}

<style>
	.bloque {
		margin-block-end: 1rem;
		min-width: 0;
	}
	.filtros,
	.en-linea {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		gap: 0.75rem;
		align-items: end;
		max-width: 50rem;
	}
	.filtros:has(#cobranza-anio),
	.carta {
		grid-template-columns: minmax(0, 1fr) minmax(9rem, 12rem) max-content;
	}
	.carta {
		grid-template-columns: minmax(9rem, 12rem) minmax(0, 1fr) max-content;
	}
	.en-linea {
		margin-top: 0.75rem;
	}
	.filtros .form-group,
	.en-linea .form-group {
		margin: 0;
	}
	.resultado {
		margin-block: 0.75rem;
		min-height: 2.25rem;
	}
	.respuesta,
	.aviso-carta {
		padding: 0.5rem 0.75rem;
		border-radius: var(--radio-control);
	}
	.error {
		background: var(--peligro-fondo);
		color: var(--peligro);
	}
	.guardado {
		background: var(--exito-fondo);
		color: var(--exito);
	}
	.aviso-carta {
		margin-block-end: 1rem;
		border: 1px solid var(--alerta-borde);
		background: var(--alerta-fondo);
		color: var(--alerta);
		font-weight: 700;
	}
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		justify-content: space-between;
		align-items: baseline;
	}
	.campos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: 0.75rem;
		margin-block: 0.75rem;
	}
	.datos {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-block: 0.75rem 0;
	}
	.datos > div {
		background: var(--superficie-alta);
		border-radius: 0.65rem;
		padding: 0.65rem 0.8rem;
		min-width: 10rem;
	}
	dt {
		font-weight: 700;
	}
	dd {
		margin: 0.35rem 0 0;
		overflow-wrap: anywhere;
	}
	.tabla {
		overflow-x: auto;
		margin-block: 0.75rem;
	}
	table th,
	table td {
		padding: 0.5rem;
		vertical-align: top;
	}
	tbody th {
		text-align: left;
	}
	.monto {
		font-variant-numeric: tabular-nums;
	}
	.monto input {
		min-width: 8rem;
		max-width: 11rem;
	}
	.total {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	details summary {
		cursor: pointer;
	}
	details .campos {
		min-width: 14rem;
	}
	.nueva {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--linea);
	}
	.nueva h3 {
		margin: 0;
		font-size: 1rem;
	}
	:global(form[aria-busy='true']) {
		opacity: 0.7;
	}
	@media (max-width: 650px) {
		.filtros,
		.en-linea,
		.filtros:has(#cobranza-anio),
		.carta {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
