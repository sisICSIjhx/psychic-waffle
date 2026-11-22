<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import EstadoGuardado from '$lib/components/ui/EstadoGuardado.svelte';
	import type { EstadoCarpeta } from '$lib/dominio/constantes';
	import { nombreDeCarpeta } from '$lib/dominio/estatus';
	import {
		carpetaCerrada,
		carpetaEntregada,
		ESTADOS_CARPETA
	} from '$lib/dominio/seguimiento-operativo';
	import type {
		CarpetaSeguimiento,
		ConceptoSeguimientoOperativo,
		SeguimientoOperativo
	} from '$lib/server/repositorios/seguimiento';
	import {
		anclaDeCarpeta,
		resultadoDe,
		textoBreve,
		textoDiaMes,
		type AvanceDocumentos,
		type EstadoCaptura
	} from './captura';

	/** Una carpeta del mes, por pasos: preparar, entregar y recibir (con comentarios o con acuse). */
	export let concepto: ConceptoSeguimientoOperativo;
	export let carpeta: CarpetaSeguimiento | undefined;
	export let personal: SeguimientoOperativo['personal'];
	/** Persona de la sesión, para proponerla en «Quién entrega». */
	export let personaSesion: string | null = null;
	export let hoy: string;
	/** Documentos del mes que van en esta carpeta; null si la plantilla no tiene ninguno. */
	export let documentos: AvanceDocumentos | null = null;
	/** Descarga del archivo de la carpeta; con `&adjunto=acuse`, la del acuse. */
	export let urlArchivo: string;
	export let urlGuardar: string;
	export let plantillaId: string | null;
	export let puedeEditar: boolean;
	export let enviar: SubmitFunction;
	export let captura: EstadoCaptura;

	type TipoFormulario = 'entrega' | 'recepcion' | 'comentarios';
	interface Accion {
		tipo: TipoFormulario;
		titulo: string;
		clase: 'primario' | 'contorno' | 'fantasma';
		/** Corrige lo ya guardado: el formulario llega con esos datos. */
		corregir: boolean;
	}

	const ACCIONES: Record<EstadoCarpeta, Accion[]> = {
		pendiente: [
			{ tipo: 'entrega', titulo: 'Entregar carpeta', clase: 'primario', corregir: false }
		],
		en_proceso: [
			{ tipo: 'entrega', titulo: 'Entregar carpeta', clase: 'primario', corregir: false }
		],
		entregada: [
			{
				tipo: 'recepcion',
				titulo: 'Registrar recibida correctamente',
				clase: 'primario',
				corregir: false
			},
			{
				tipo: 'comentarios',
				titulo: 'Registrar recibida con comentarios',
				clase: 'contorno',
				corregir: false
			},
			{ tipo: 'entrega', titulo: 'Corregir la entrega', clase: 'fantasma', corregir: true }
		],
		recibida_comentarios: [
			{ tipo: 'entrega', titulo: 'Entregar de nuevo', clase: 'primario', corregir: false },
			{
				tipo: 'recepcion',
				titulo: 'Registrar recibida correctamente',
				clase: 'contorno',
				corregir: false
			},
			{
				tipo: 'comentarios',
				titulo: 'Corregir los comentarios',
				clase: 'fantasma',
				corregir: true
			}
		],
		recibida: [
			{ tipo: 'recepcion', titulo: 'Corregir la recepción', clase: 'fantasma', corregir: true }
		]
	};
	const ESTADO_DE: Record<TipoFormulario, EstadoCarpeta> = {
		entrega: 'entregada',
		recepcion: 'recibida',
		comentarios: 'recibida_comentarios'
	};
	const BOTON_DE: Record<TipoFormulario, string> = {
		entrega: 'Guardar entrega',
		recepcion: 'Guardar recepción',
		comentarios: 'Guardar comentarios'
	};
	const INSIGNIA: Record<EstadoCarpeta, string> = {
		pendiente: '',
		en_proceso: 'warn',
		entregada: 'info',
		recibida_comentarios: 'warn',
		recibida: 'ok'
	};

	$: ancla = anclaDeCarpeta(concepto.id);
	$: resultado = resultadoDe(captura, ancla);
	$: estado = carpeta?.estado ?? 'pendiente';
	$: version = carpeta?.version ?? 0;
	$: entregada = carpetaEntregada(estado);
	$: cerrada = carpetaCerrada(estado);
	$: entregaInactiva =
		carpeta?.entregaId && !personal.some((p) => p.id === carpeta?.entregaId) ? carpeta : null;
	$: entregaPropuesta =
		carpeta?.entregaId ?? (personal.some((p) => p.id === personaSesion) ? personaSesion : '');
	$: faltanDocumentos = documentos ? documentos.esperados - documentos.hechos : 0;
	$: acciones = puedeEditar ? ACCIONES[estado] : [];
	$: urlAcuse = `${urlArchivo}&adjunto=acuse`;

	$: pasos = [
		{
			nombre: 'Preparar',
			detalle: estado === 'pendiente' ? 'falta' : '',
			fase: estado === 'pendiente' ? 'actual' : 'hecho'
		},
		{
			nombre: estado === 'recibida_comentarios' ? 'Entregar de nuevo' : 'Entregar',
			detalle:
				estado === 'recibida_comentarios'
					? 'falta corregir lo que pidieron'
					: entregada
						? [textoDiaMes(carpeta?.fecha), carpeta?.entregaNombre].filter(Boolean).join(' · ')
						: 'falta',
			fase:
				estado === 'recibida_comentarios' || estado === 'en_proceso'
					? 'actual'
					: entregada
						? 'hecho'
						: 'pendiente'
		},
		{
			nombre: 'Recibir',
			detalle: cerrada
				? [textoDiaMes(carpeta?.fechaRecepcion), carpeta?.recibe].filter(Boolean).join(' · ')
				: 'falta',
			fase: cerrada ? 'hecho' : estado === 'entregada' ? 'actual' : 'pendiente'
		}
	] as { nombre: string; detalle: string; fase: 'hecho' | 'actual' | 'pendiente' }[];

	const TEXTO_FASE = { hecho: 'Hecho', actual: 'Paso actual', pendiente: 'Pendiente' };

	// Con JavaScript, el error se muestra en el formulario que se envió; sin él, bajo el título.
	let enviado: number | null = null;
	// Al guardarse la carpeta sus formularios se rehacen: ya no hay uno «enviado».
	$: if (version >= 0) enviado = null;
	function alEnviar(indice: number): SubmitFunction {
		return (entrada) => {
			enviado = indice;
			return enviar(entrada);
		};
	}
</script>

<article class="carpeta" aria-labelledby={ancla}>
	<div class="encabezado">
		<h3 id={ancla} tabindex="-1">{nombreDeCarpeta(concepto.etiqueta)}</h3>
		<span class="insignias">
			{#if concepto.porDefinir}<span class="status-badge por-definir info">Por definir</span>{/if}
			<span class={`status-badge ${INSIGNIA[estado]}`}>{ESTADOS_CARPETA[estado]}</span>
		</span>
	</div>
	{#if puedeEditar}
		<EstadoGuardado estado={resultado.fase} mensaje={textoBreve(resultado.mensaje)} />
	{/if}
	{#if resultado.error && enviado === null}
		<p class="aviso aviso-error" role="alert">{resultado.error}</p>
	{/if}
	{#if concepto.porDefinir}
		<p class="view-note">
			Todavía no se define cómo es esta carpeta. Puede llenarla; no cuenta en el estatus.
		</p>
	{/if}

	<ol class="pasos">
		{#each pasos as paso, indice (paso.nombre)}
			<li class={paso.fase} aria-current={paso.fase === 'actual' ? 'step' : undefined}>
				<span class="marca" aria-hidden="true">
					{#if paso.fase === 'hecho'}
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg
						>
					{:else}
						{indice + 1}
					{/if}
				</span>
				<span class="paso-texto">
					<strong>{paso.nombre}</strong>
					{#if paso.detalle}<span class="detalle"> · {paso.detalle}</span>{/if}
					<span class="sr-only"> ({TEXTO_FASE[paso.fase]})</span>
				</span>
			</li>
		{/each}
	</ol>

	{#if carpeta?.comentarios}
		<div
			class={`aviso ${estado === 'recibida_comentarios' ? 'aviso-alerta' : 'aviso-info'} comentarios`}
		>
			<strong>
				{estado === 'recibida_comentarios'
					? 'Comentarios de quien recibió:'
					: 'Comentarios de la entrega anterior:'}
			</strong>
			<span>{carpeta.comentarios}</span>
			{#if carpeta.recibe || carpeta.fechaRecepcion}
				<span class="view-note">
					{[carpeta.recibe, textoDiaMes(carpeta.fechaRecepcion)].filter(Boolean).join(' · ')}
				</span>
			{/if}
		</div>
	{/if}

	{#if documentos && documentos.esperados > 0}
		<div class="documentos">
			<span id={`${ancla}-documentos`}>Documentos de la carpeta</span>
			<span class="cifra">{documentos.hechos} de {documentos.esperados}</span>
			<progress
				class:completo={faltanDocumentos === 0}
				max={documentos.esperados}
				value={documentos.hechos}
				aria-labelledby={`${ancla}-documentos`}
			></progress>
		</div>
	{/if}

	<!-- El enlace de SharePoint es externo y las descargas llegan resueltas por la página. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if carpeta?.enlace || carpeta?.archivoNombre || carpeta?.acuseEnlace || carpeta?.acuseArchivoNombre}
		<ul class="enlaces">
			{#if carpeta.enlace}
				<li>
					<a class="enlace" href={carpeta.enlace} target="_blank" rel="noopener noreferrer"
						>Abrir carpeta en SharePoint<span aria-hidden="true"> ↗</span></a
					>
				</li>
			{:else if carpeta.archivoNombre}
				<li>
					<a class="enlace" href={urlArchivo} download>Descargar {carpeta.archivoNombre}</a>
				</li>
			{/if}
			{#if carpeta.acuseEnlace}
				<li>
					<a class="enlace" href={carpeta.acuseEnlace} target="_blank" rel="noopener noreferrer"
						>Ver acuse<span aria-hidden="true"> ↗</span></a
					>
				</li>
			{:else if carpeta.acuseArchivoNombre}
				<li>
					<a class="enlace" href={urlAcuse} download
						>Descargar acuse ({carpeta.acuseArchivoNombre})</a
					>
				</li>
			{/if}
		</ul>
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if puedeEditar}
		{#key version}
			<div class="acciones">
				{#each acciones as accion, indice (accion.titulo)}
					<details name={ancla} class={`accion ${accion.clase}`}>
						<summary class={`resumen-boton boton ${accion.clase}`}>{accion.titulo}</summary>
						<form
							method="POST"
							action={`${urlGuardar}#${ancla}`}
							enctype="multipart/form-data"
							use:enhance={alEnviar(indice)}
							class="formulario"
						>
							<input type="hidden" name="accion" value="carpeta" />
							<input type="hidden" name="ancla" value={ancla} />
							<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
							<input type="hidden" name="conceptoId" value={concepto.id} />
							<input type="hidden" name="version" value={version} />
							<input type="hidden" name="estado" value={ESTADO_DE[accion.tipo]} />

							{#if accion.tipo === 'entrega'}
								{#if faltanDocumentos > 0}
									<p class="aviso aviso-alerta">
										{faltanDocumentos === 1
											? 'Falta 1 documento de esta carpeta.'
											: `Faltan ${faltanDocumentos} documentos de esta carpeta.`}
										Puede entregarla y completarlos después.
									</p>
								{/if}
								<div class="form-group">
									<label for={`${ancla}-${indice}-entrega`}>Quién entrega</label>
									<select
										id={`${ancla}-${indice}-entrega`}
										name="entregaId"
										required
										value={entregaPropuesta}
									>
										<option value="">Seleccione del personal</option>
										{#if entregaInactiva}
											<option value={entregaInactiva.entregaId}
												>{entregaInactiva.entregaNombre}</option
											>
										{/if}
										{#each personal as persona (persona.id)}
											<option value={persona.id}>{persona.nombre}</option>
										{/each}
									</select>
								</div>
								<div class="form-group">
									<label for={`${ancla}-${indice}-fecha`}>Fecha de entrega</label>
									<input
										id={`${ancla}-${indice}-fecha`}
										type="date"
										name="fecha"
										required
										value={accion.corregir ? (carpeta?.fecha ?? hoy) : hoy}
									/>
								</div>
								<div class="form-group">
									<label for={`${ancla}-${indice}-enlace`}
										>Enlace de la carpeta en SharePoint (opcional)</label
									>
									<input
										id={`${ancla}-${indice}-enlace`}
										type="url"
										name="enlace"
										maxlength="2048"
										inputmode="url"
										autocomplete="off"
										placeholder="https://…sharepoint.com/…"
										value={carpeta?.enlace ?? ''}
									/>
								</div>
								<div class="form-group">
									<label for={`${ancla}-${indice}-archivo`}
										>O un archivo (opcional, hasta 8 MB)</label
									>
									<input id={`${ancla}-${indice}-archivo`} type="file" name="archivo" />
								</div>
								{#if carpeta?.archivoNombre}
									<label class="quitar">
										<input type="checkbox" name="quitarArchivo" />
										Quitar el archivo actual ({carpeta.archivoNombre})
									</label>
								{/if}
							{:else}
								<div class="form-group">
									<label for={`${ancla}-${indice}-recibe`}>Quién recibe</label>
									<input
										id={`${ancla}-${indice}-recibe`}
										name="recibe"
										required
										maxlength="200"
										autocomplete="off"
										value={carpeta?.recibe ?? ''}
									/>
								</div>
								<div class="form-group">
									<label for={`${ancla}-${indice}-recepcion`}>Fecha de recepción</label>
									<input
										id={`${ancla}-${indice}-recepcion`}
										type="date"
										name="fechaRecepcion"
										required
										min={carpeta?.fecha ?? undefined}
										value={accion.corregir ? (carpeta?.fechaRecepcion ?? hoy) : hoy}
									/>
								</div>
								{#if accion.tipo === 'comentarios'}
									<div class="form-group">
										<label for={`${ancla}-${indice}-comentarios`}>Comentarios</label>
										<textarea
											id={`${ancla}-${indice}-comentarios`}
											name="comentarios"
											required
											maxlength="1000"
											rows="3"
											aria-describedby={`${ancla}-${indice}-comentarios-ayuda`}
											value={accion.corregir ? (carpeta?.comentarios ?? '') : ''}
										></textarea>
										<p class="view-note" id={`${ancla}-${indice}-comentarios-ayuda`}>
											Escriba qué pidieron corregir.
										</p>
									</div>
								{:else}
									<fieldset class="acuse">
										<legend>Acuse de recibido</legend>
										<p class="view-note">
											Tome una foto del acuse firmado o pegue el enlace. Solo uno de los dos.
										</p>
										{#if carpeta?.acuseArchivoNombre}
											<p class="view-note">Acuse guardado: {carpeta.acuseArchivoNombre}</p>
										{/if}
										<div class="form-group">
											<label for={`${ancla}-${indice}-acuse`}
												>Foto o archivo del acuse (hasta 8 MB)</label
											>
											<input
												id={`${ancla}-${indice}-acuse`}
												type="file"
												name="acuseArchivo"
												accept="image/*,application/pdf"
											/>
										</div>
										<div class="form-group">
											<label for={`${ancla}-${indice}-acuse-enlace`}
												>O el enlace de SharePoint</label
											>
											<input
												id={`${ancla}-${indice}-acuse-enlace`}
												type="url"
												name="acuseEnlace"
												maxlength="2048"
												inputmode="url"
												autocomplete="off"
												placeholder="https://…sharepoint.com/…"
												value={carpeta?.acuseEnlace ?? ''}
											/>
										</div>
										{#if carpeta?.acuseArchivoNombre}
											<label class="quitar">
												<input type="checkbox" name="quitarAcuse" />
												Quitar el acuse guardado
											</label>
										{/if}
									</fieldset>
								{/if}
							{/if}

							{#if resultado.error && enviado === indice}
								<p class="aviso aviso-error" role="alert">{resultado.error}</p>
							{/if}
							<button class="boton primario enviar">{BOTON_DE[accion.tipo]}</button>
						</form>
					</details>
				{/each}

				{#if estado === 'pendiente' || estado === 'en_proceso'}
					<form method="POST" action={`${urlGuardar}#${ancla}`} use:enhance={alEnviar(-1)}>
						<input type="hidden" name="accion" value="carpeta" />
						<input type="hidden" name="ancla" value={ancla} />
						<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
						<input type="hidden" name="conceptoId" value={concepto.id} />
						<input type="hidden" name="version" value={version} />
						{#if estado === 'pendiente'}
							<button class="boton contorno paso-corto" name="estado" value="en_proceso"
								>Marcar en preparación</button
							>
						{:else}
							<button class="boton fantasma paso-corto" name="estado" value="pendiente"
								>Volver a pendiente</button
							>
						{/if}
					</form>
					{#if resultado.error && enviado === -1}
						<p class="aviso aviso-error" role="alert">{resultado.error}</p>
					{/if}
				{/if}
			</div>
		{/key}
	{/if}
</article>

<style>
	.carpeta {
		display: grid;
		align-content: start;
		gap: 10px;
		padding: 16px;
		border: 1px solid var(--linea-fuerte);
		border-radius: var(--radio-panel);
		background: var(--superficie);
		min-width: 0;
		scroll-margin-top: 16px;
	}
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 12px;
		align-items: flex-start;
		justify-content: space-between;
	}
	.carpeta h3 {
		display: block;
		margin: 0;
		font-size: var(--texto-md);
		font-weight: var(--peso-encabezado);
		overflow-wrap: anywhere;
	}
	.insignias {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.aviso {
		margin: 0;
	}
	.pasos {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pasos li {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		color: var(--tinta-secundaria);
	}
	.marca {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		border: 1.5px solid var(--borde-campo);
		border-radius: 50%;
		font-size: var(--texto-xs);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.marca svg {
		width: 14px;
		height: 14px;
	}
	.paso-texto {
		min-width: 0;
		padding-top: 1px;
		overflow-wrap: anywhere;
	}
	.pasos .hecho {
		color: var(--tinta);
	}
	.pasos .hecho .marca {
		border-color: var(--exito);
		background: var(--exito);
		color: var(--exito-fondo);
	}
	.pasos .actual {
		color: var(--tinta);
	}
	.pasos .actual .marca {
		border-color: var(--accion);
		background: var(--accion-suave);
		color: var(--accion);
	}
	.pasos .detalle {
		color: var(--tinta-secundaria);
	}
	.comentarios {
		display: grid;
		gap: 4px;
		overflow-wrap: anywhere;
	}
	.documentos {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 4px 12px;
		align-items: baseline;
		font-size: var(--texto-sm);
	}
	.documentos .cifra {
		font-weight: 700;
	}
	progress {
		grid-column: 1 / -1;
		width: 100%;
		height: 8px;
		appearance: none;
		border: none;
		border-radius: 999px;
		overflow: hidden;
		background: var(--neutro-fondo);
		color: var(--alerta);
	}
	progress::-webkit-progress-bar {
		background: var(--neutro-fondo);
	}
	progress::-webkit-progress-value {
		border-radius: 999px;
		background: var(--alerta);
	}
	progress::-moz-progress-bar {
		border-radius: 999px;
		background: var(--alerta);
	}
	progress.completo {
		color: var(--exito);
	}
	progress.completo::-webkit-progress-value {
		background: var(--exito);
	}
	progress.completo::-moz-progress-bar {
		background: var(--exito);
	}
	.enlaces {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.enlaces a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		overflow-wrap: anywhere;
	}
	.acciones {
		display: grid;
		gap: 8px;
	}
	.accion > summary {
		display: flex;
		width: 100%;
		min-height: 44px;
		list-style: none;
		white-space: normal;
		text-align: center;
	}
	.accion > summary::-webkit-details-marker {
		display: none;
	}
	.accion.fantasma > summary {
		justify-content: flex-start;
		text-align: left;
	}
	.formulario {
		display: grid;
		margin-top: 8px;
		padding: 14px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-panel);
		background: var(--superficie-alta);
		min-width: 0;
	}
	.formulario .form-group {
		margin-bottom: 12px;
		min-width: 0;
	}
	.formulario input[type='file'] {
		max-width: 100%;
		min-height: 44px;
		font-size: var(--texto-sm);
	}
	.formulario .aviso {
		margin-bottom: 12px;
	}
	.acuse {
		min-width: 0;
		margin: 0 0 12px;
		padding: 12px 12px 0;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
	}
	.acuse legend {
		padding: 0 6px;
		font-size: var(--texto-sm);
		font-weight: 600;
	}
	.acuse .view-note {
		margin-bottom: 10px;
	}
	.quitar {
		display: flex;
		min-height: 44px;
		margin-bottom: 8px;
		overflow-wrap: anywhere;
	}
	.enviar,
	.paso-corto {
		width: 100%;
		min-height: 44px;
	}
</style>
