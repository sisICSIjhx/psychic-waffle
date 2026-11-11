<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import CarpetaSeguimiento from '$lib/components/seguimiento/CarpetaSeguimiento.svelte';
	import CasillaSeguimiento from '$lib/components/seguimiento/CasillaSeguimiento.svelte';
	import ValorSeguimiento from '$lib/components/seguimiento/ValorSeguimiento.svelte';
	import { textoFechaCorta } from '$lib/dominio/equipos';
	import { ETIQUETA_ORIGEN } from '$lib/dominio/seguimiento';
	import { textoMes } from '$lib/dominio/textos';
	import type { PageProps } from './$types';

	export let data: PageProps['data'];
	export let form: PageProps['form'];

	$: ({ centro, mes, seguimiento, puedeEditar } = data);
	$: filtro = new URLSearchParams({ centro: centro?.id ?? '', mes }).toString();
	$: urlGuardar = `${resolve('/seguimiento')}?/guardar&${filtro}`;
	$: plantillaId = seguimiento?.plantillaId ?? null;
	$: conceptosMes =
		seguimiento?.conceptos.filter((c) => c.nivel === 'periodo' && c.bloque !== 'carpetas') ?? [];
	$: conceptosActividad = seguimiento?.conceptos.filter((c) => c.nivel === 'actividad') ?? [];
	$: conceptosCarpeta = seguimiento?.conceptos.filter((c) => c.bloque === 'carpetas') ?? [];
	$: valores = new Map(
		seguimiento?.valores.map((v) => [`${v.actividad ?? ''}/${v.conceptoId}`, v.valor])
	);
	$: actividadesProgramadas = seguimiento?.actividades.filter((a) => a.programada) ?? [];
	$: totalEjecutadas = actividadesProgramadas.filter((a) => a.ejecutada).length;
	$: puedeMarcarMes =
		Boolean(seguimiento?.actividades.length) ||
		conceptosMes.some((c) => c.tipo === 'casilla' || c.tipo === 'estado');

	const enviar: SubmitFunction = ({ formElement, cancel }) => {
		if (formElement.getAttribute('aria-busy') === 'true') {
			cancel();
			return;
		}
		formElement.setAttribute('aria-busy', 'true');
		return async ({ result, update }) => {
			try {
				if (result.type === 'failure' && result.status === 409) await invalidateAll();
				await update();
			} finally {
				formElement.removeAttribute('aria-busy');
			}
		};
	};
</script>

{#if data.centros.length === 0}
	<p class="card">No hay centros de costo disponibles para tu cuenta.</p>
{:else if centro && seguimiento}
	<section class="card periodo" aria-label="Centro y mes">
		<form method="GET" action={resolve('/seguimiento')} class="filtros">
			<div class="form-group">
				<label for="seguimiento-centro">Centro de costo</label>
				<select id="seguimiento-centro" name="centro" value={centro.id}>
					{#each data.centros as opcion (opcion.id)}
						<option value={opcion.id}
							>{opcion.clave}{opcion.nombre ? ` · ${opcion.nombre}` : ''}</option
						>
					{/each}
				</select>
			</div>
			<label class="form-group">
				Mes
				<input type="month" name="mes" value={mes} required />
			</label>
			<button class="boton">Consultar</button>
		</form>
	</section>

	{#if puedeEditar}
		<div class="resultado">
			{#if form?.error}
				<p class="respuesta error" role="alert">{form.error}</p>
			{:else if form?.mensaje}
				<p class="respuesta guardado" role="status">{form.mensaje}</p>
			{/if}
		</div>
	{/if}

	{#key filtro}
		{#if plantillaId}
			<section class="card bloque" aria-labelledby="titulo-actividades">
				<div class="encabezado">
					<div>
						<h2 class="view-heading" id="titulo-actividades">{textoMes(mes, { inicial: true })}</h2>
						{#if seguimiento.origen !== 'ninguno'}
							<p class="view-note">
								{ETIQUETA_ORIGEN[seguimiento.origen]} · {totalEjecutadas} de {actividadesProgramadas.length}
								ejecutadas
							</p>
						{/if}
					</div>
					{#if puedeEditar && puedeMarcarMes}
						<form method="POST" action={urlGuardar} use:enhance={enviar}>
							<input type="hidden" name="plantillaId" value={plantillaId} />
							<button class="boton" name="accion" value="marcarMes">Marcar mes como hecho</button>
						</form>
					{/if}
				</div>

				{#if conceptosMes.length}
					<dl class="conceptos-mes">
						{#each conceptosMes as concepto (concepto.id)}
							<div>
								<dt>{concepto.etiqueta}</dt>
								<dd>
									<ValorSeguimiento
										{concepto}
										valor={valores.get(`/${concepto.id}`)}
										etiqueta={concepto.etiqueta}
										{urlGuardar}
										{plantillaId}
										{puedeEditar}
										{enviar}
									/>
								</dd>
							</div>
						{/each}
					</dl>
				{/if}

				{#if seguimiento.actividades.length}
					<!-- La región permite desplazar la tabla con teclado en modo consulta. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div class="tabla" tabindex="0" role="region" aria-label="Actividades y documentos">
						<table>
							<thead>
								<tr>
									<th scope="col">Actividad</th>
									<th scope="col">Ejecutada</th>
									{#each conceptosActividad as concepto (concepto.id)}
										<th scope="col">{concepto.etiqueta}</th>
									{/each}
									{#if puedeEditar}<th scope="col">Acciones</th>{/if}
								</tr>
							</thead>
							<tbody>
								{#each seguimiento.actividades as actividad (actividad.clave)}
									{@const titulo = actividad.ordinal
										? `${actividad.nombre} (${actividad.ordinal})`
										: actividad.nombre}
									<tr>
										<th scope="row">
											{titulo}
											{#if actividad.fecha}
												<small>{textoFechaCorta(actividad.fecha)}</small>
											{/if}
											{#if !actividad.programada}
												<small class="fuera">Fuera del programa actual</small>
											{/if}
										</th>
										<td>
											{#if puedeEditar}
												<form method="POST" action={urlGuardar} use:enhance={enviar}>
													<input type="hidden" name="accion" value="ejecucion" />
													<input type="hidden" name="plantillaId" value={plantillaId} />
													<input type="hidden" name="actividad" value={actividad.clave} />
													<CasillaSeguimiento
														etiqueta={`Ejecutada · ${titulo}`}
														marcada={actividad.ejecutada}
														{puedeEditar}
													/>
												</form>
											{:else}
												<CasillaSeguimiento
													etiqueta={`Ejecutada · ${titulo}`}
													marcada={actividad.ejecutada}
													{puedeEditar}
												/>
											{/if}
										</td>
										{#each conceptosActividad as concepto (concepto.id)}
											<td>
												<ValorSeguimiento
													{concepto}
													valor={valores.get(`${actividad.clave}/${concepto.id}`)}
													actividad={actividad.clave}
													etiqueta={`${concepto.etiqueta} · ${titulo}`}
													{urlGuardar}
													{plantillaId}
													{puedeEditar}
													{enviar}
												/>
											</td>
										{/each}
										{#if puedeEditar}
											<td>
												<form method="POST" action={urlGuardar} use:enhance={enviar}>
													<input type="hidden" name="plantillaId" value={plantillaId} />
													<input type="hidden" name="actividad" value={actividad.clave} />
													<button
														class="boton compacto"
														name="accion"
														value="marcarFila"
														aria-label={`Marcar fila · ${titulo}`}>Marcar fila</button
													>
												</form>
												{#if seguimiento.origen === 'mensual' && actividad.ordinal === null}
													<details class="editar-actividad">
														<summary>Editar actividad</summary>
														{#key `${actividad.nombre}/${actividad.fecha}`}
															<form method="POST" action={urlGuardar} use:enhance={enviar}>
																<input type="hidden" name="plantillaId" value={plantillaId} />
																<input type="hidden" name="actividad" value={actividad.clave} />
																<label class="form-group"
																	>Actividad<input
																		name="nombre"
																		required
																		maxlength="250"
																		value={actividad.nombre}
																	/></label
																>
																<label class="form-group"
																	>Fecha prevista<input
																		name="fecha"
																		type="date"
																		value={actividad.fecha ?? ''}
																	/></label
																>
																<button class="boton compacto" name="accion" value="editarActividad"
																	>Guardar</button
																>
																{#if !actividad.ejecutada && !seguimiento.valores.some((v) => v.actividad === actividad.clave)}
																	<button
																		class="boton compacto peligro"
																		name="accion"
																		value="quitarActividad"
																		formnovalidate>Quitar</button
																	>
																{/if}
															</form>
														{/key}
													</details>
												{/if}
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else if seguimiento.origen === 'programa_anual'}
					<p class="view-note">El programa anual no tiene actividades programadas para este mes.</p>
				{:else if seguimiento.origen === 'mensual'}
					<p class="view-note">Todavía no hay actividades para este mes.</p>
				{/if}

				{#if puedeEditar && seguimiento.origen === 'mensual'}
					<form method="POST" action={urlGuardar} use:enhance={enviar} class="captura">
						<input type="hidden" name="plantillaId" value={plantillaId} />
						<input type="hidden" name="id" value={data.idActividad} />
						<label class="form-group"
							>Actividad programada<input name="nombre" required maxlength="250" /></label
						>
						<label class="form-group">Fecha prevista<input type="date" name="fecha" /></label>
						<button class="boton primario" name="accion" value="nuevaActividad"
							>Agregar actividad</button
						>
					</form>
				{/if}
			</section>
		{:else}
			<p class="card">Este centro de costo aún no tiene una plantilla de seguimiento.</p>
		{/if}

		{#if conceptosCarpeta.length}
			<section class="card bloque" aria-labelledby="titulo-carpetas">
				<h2 class="view-heading" id="titulo-carpetas">Carpetas</h2>
				<div class="carpetas">
					{#each conceptosCarpeta as concepto (concepto.id)}
						<CarpetaSeguimiento
							{concepto}
							carpeta={seguimiento.carpetas.find((c) => c.conceptoId === concepto.id)}
							personal={seguimiento.personal}
							urlArchivo={`${resolve('/seguimiento/archivo/[concepto]', { concepto: concepto.id })}?${filtro}`}
							{urlGuardar}
							{plantillaId}
							{puedeEditar}
							{enviar}
						/>
					{/each}
				</div>
			</section>
		{/if}

		<section class="card bloque" aria-labelledby="titulo-nocturnas">
			<h2 class="view-heading" id="titulo-nocturnas">Atenciones nocturnas</h2>
			{#if seguimiento.nocturnas.length}
				<ul class="nocturnas">
					{#each seguimiento.nocturnas as atencion (atencion.id)}
						<li>
							<time datetime={atencion.fecha}>{textoFechaCorta(atencion.fecha)}</time>
							<span>{atencion.descripcion}</span>
							{#if puedeEditar}
								<form method="POST" action={urlGuardar} use:enhance={enviar}>
									<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
									<input type="hidden" name="id" value={atencion.id} />
									<button
										class="boton compacto peligro"
										name="accion"
										value="quitarNocturna"
										aria-label={`Quitar atención del ${textoFechaCorta(atencion.fecha)} · ${atencion.descripcion}`}
										>Quitar</button
									>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="view-note">Sin atenciones registradas este mes.</p>
			{/if}
			{#if puedeEditar}
				<form method="POST" action={urlGuardar} use:enhance={enviar} class="captura">
					<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
					<input type="hidden" name="id" value={data.idNocturna} />
					<label class="form-group"
						>Descripción de la atención<input name="descripcion" required maxlength="1000" /></label
					>
					<label class="form-group"
						>Fecha de atención<input
							type="date"
							name="fecha"
							value={data.fechaSugerida}
							required
						/></label
					>
					<button class="boton primario" name="accion" value="nuevaNocturna"
						>Registrar atención</button
					>
				</form>
			{/if}
		</section>
	{/key}
{/if}

<style>
	.bloque {
		margin-block-end: 1rem;
		min-width: 0;
	}
	.periodo {
		margin-block-end: 1rem;
	}
	.filtros,
	.captura {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(9rem, 12rem) max-content;
		gap: 0.75rem;
		align-items: end;
		max-width: 50rem;
	}
	.captura {
		margin-top: 1rem;
	}
	.filtros .form-group,
	.captura .form-group {
		margin: 0;
	}
	.resultado {
		margin-block: 0.75rem;
		min-height: 2.25rem;
	}
	.respuesta {
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
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		justify-content: space-between;
		align-items: center;
	}
	.conceptos-mes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-block: 0.85rem;
	}
	.conceptos-mes > div {
		background: var(--superficie-alta);
		border-radius: 0.65rem;
		padding: 0.65rem 0.8rem;
	}
	dt {
		font-weight: 700;
	}
	dd {
		margin: 0.35rem 0 0;
	}
	.tabla {
		overflow-x: auto;
		margin-top: 0.75rem;
	}
	table th,
	table td {
		padding: 0.5rem;
	}
	tbody th {
		text-align: left;
		min-width: 11rem;
	}
	thead th {
		min-width: 5.5rem;
	}
	td {
		vertical-align: top;
	}
	small {
		display: block;
		color: var(--tinta-secundaria);
		font-weight: 400;
	}
	.fuera {
		color: var(--alerta);
	}
	.editar-actividad {
		margin-top: 0.4rem;
		min-width: 9rem;
	}
	.editar-actividad summary {
		cursor: pointer;
	}
	.editar-actividad label {
		margin: 0.45rem 0;
	}
	.carpetas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
	.nocturnas {
		padding: 0;
		list-style: none;
	}
	.nocturnas li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.8rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--linea);
	}
	time {
		font-weight: 700;
	}
	.nocturnas span {
		flex: 1 1 12rem;
		overflow-wrap: anywhere;
	}
	:global(form[aria-busy='true']) {
		opacity: 0.7;
	}
	@media (max-width: 650px) {
		.filtros,
		.captura {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
