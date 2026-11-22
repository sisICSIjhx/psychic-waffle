<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import AccionesGuardar from '$lib/components/cobranza/AccionesGuardar.svelte';
	import Adicionales from '$lib/components/cobranza/Adicionales.svelte';
	import CampoConcepto from '$lib/components/cobranza/CampoConcepto.svelte';
	import CobranzaMensual from '$lib/components/cobranza/CobranzaMensual.svelte';
	import OrdenesCompra from '$lib/components/cobranza/OrdenesCompra.svelte';
	import ResumenFinanzas from '$lib/components/cobranza/ResumenFinanzas.svelte';
	import SeccionPlegable from '$lib/components/cobranza/SeccionPlegable.svelte';
	import type { ResultadoGuardar } from '$lib/components/cobranza/adicionales';
	import NavegacionMes from '$lib/components/ui/NavegacionMes.svelte';
	import { mesesDelAnio, type ValorConcepto } from '$lib/dominio/cobranza';
	import { textoFechaCorta } from '$lib/dominio/equipos';
	import { ETIQUETA_MODO_CONTRATO } from '$lib/dominio/seguimiento';
	import type { PageProps } from './$types';

	export let data: PageProps['data'];
	export let form: PageProps['form'];

	const SIN_CONEXION = 'No se guardó: no hay conexión. Inténtelo de nuevo cuando tenga señal.';
	const ANIO_MINIMO = 2000;
	const ANIO_MAXIMO = 2100;

	$: ({ centro, anio, detalle, puedeEditarContrato, puedeEditarCobranza } = data);
	$: contrato = detalle?.contrato;
	$: filtro = new URLSearchParams({ centro: centro?.id ?? '', anio: String(anio) }).toString();
	$: urlGuardar = `${resolve('/cobranza')}?/guardar&${filtro}`;
	$: conceptosContrato = contrato?.conceptos.filter((c) => c.bloque === 'contrato') ?? [];
	$: conceptosOrden = contrato?.conceptos.filter((c) => c.bloque === 'ordenes_compra') ?? [];
	$: valoresContrato = mapa(contrato?.valores ?? []);
	$: meses = mesesDelAnio(anio, contrato?.cobranza ?? []);
	$: soloConsulta = Boolean(contrato) && !puedeEditarContrato && !puedeEditarCobranza;

	// Monto del contrato y monto cobrado: los reconoce el indicador del concepto (D1 y D7).
	$: conceptoMonto = conceptosContrato.find((c) => c.indicador === 'monto_contrato');
	$: conceptoCobrado = conceptosContrato.find((c) => c.indicador === 'monto_cobrado');
	$: montoContrato = numero(conceptoMonto && valoresContrato.get(conceptoMonto.id));
	$: cobradoPrevio = numero(conceptoCobrado && valoresContrato.get(conceptoCobrado.id));
	// Sin cobranza mensual todavía, se muestra lo que alguien capturó antes a mano.
	$: capturaAnterior = contrato && contrato.cobradoTotal === 0 ? cobradoPrevio : null;
	$: hayPorDefinir = contrato?.conceptos.some((c) => c.porDefinir) ?? false;

	function mapa(valores: { conceptoId: string; valor: ValorConcepto }[]) {
		return new Map(valores.map((v) => [v.conceptoId, v.valor]));
	}
	function numero(valor: ValorConcepto | undefined): number | null {
		return typeof valor === 'number' ? valor : null;
	}
	const rutaDeAnio = (otro: number) =>
		`${resolve('/cobranza')}?${new URLSearchParams({ centro: centro?.id ?? '', anio: String(otro) })}`;
	const pasoDeAnio = (otro: number) => ({
		href: rutaDeAnio(otro),
		texto: String(otro),
		nombre: `la cobranza de ${otro}`
	});

	// Resultado de guardar: lo muestra el lugar que envió el formulario (su `ancla`).
	let enviando: string | null = null;
	let fallo: ResultadoGuardar | null = null;
	$: resultado = (fallo ?? form ?? null) as ResultadoGuardar | null;
	$: enviado = (form && 'enviado' in form ? (form.enviado ?? null) : null) as Record<
		string,
		string
	> | null;

	// En teléfono, contrato, órdenes y carta llegan plegados; se abren al tocarlos, al llegar con su
	// ancla o cuando tienen un resultado que mostrar.
	type Plegable = 'contrato' | 'ordenes' | 'carta';
	const DE_RESULTADO: Record<string, Plegable> = {
		'r-contrato': 'contrato',
		'r-ordenes': 'ordenes',
		'r-orden': 'ordenes',
		'r-carta': 'carta'
	};
	let abiertas: Record<Plegable, boolean> = {
		contrato: !data.movil,
		ordenes: !data.movil,
		carta: !data.movil
	};
	function abrir(seccion: string | undefined) {
		if (seccion && seccion in abiertas && !abiertas[seccion as Plegable]) {
			abiertas = { ...abiertas, [seccion]: true };
		}
	}
	const seccionDe = (ancla: string) =>
		DE_RESULTADO[ancla] ?? DE_RESULTADO[ancla.replace(/-[0-9a-f-]{36}$/, '')];
	$: if (resultado?.ancla) abrir(seccionDe(resultado.ancla));

	onMount(() => {
		const estrecha = matchMedia('(max-width: 768px)').matches;
		if (estrecha && !resultado) abiertas = { contrato: false, ordenes: false, carta: false };
		const porAncla = () => abrir(location.hash.slice(1));
		porAncla();
		window.addEventListener('hashchange', porAncla);
		return () => window.removeEventListener('hashchange', porAncla);
	});

	/** Título de la tarjeta que contiene un resultado, para devolverle el foco. */
	function tituloDe(ancla: string): HTMLElement | null {
		const base = ancla.replace(/^r-/, '').replace(/-[0-9a-f-]{36}$/, '');
		const DE_FILA: Record<string, string> = {
			adicional: 'adicionales',
			cobro: 'adicionales',
			orden: 'ordenes'
		};
		return document.getElementById(`titulo-${DE_FILA[base] ?? base}`);
	}

	/**
	 * Tras guardar, SvelteKit lleva el foco al inicio del documento. Se devuelve a lo que lo tenía; si
	 * ya no está (un alta que se cierra, una fila quitada), al título de su tarjeta.
	 */
	function devolverFoco(previo: Element | null, ancla: string) {
		const activo = document.activeElement;
		if (activo && activo !== document.body && activo.isConnected) return;
		const destino = previo instanceof HTMLElement && previo.isConnected ? previo : tituloDe(ancla);
		destino?.focus({ preventScroll: true });
	}

	const enviar: SubmitFunction = ({ formElement, formData, submitter, cancel }) => {
		if (formElement.getAttribute('aria-busy') === 'true') {
			cancel();
			return;
		}
		const ancla = String(formData.get('ancla') ?? '');
		const previo = submitter ?? document.activeElement;
		formElement.setAttribute('aria-busy', 'true');
		enviando = ancla;
		fallo = null;
		return async ({ result, update }) => {
			try {
				if (result.type === 'error' && !result.status) {
					// La petición no llegó al servidor: se dice junto al formulario, sin salir de la página.
					fallo = { ancla, error: SIN_CONEXION };
					return;
				}
				// Los formularios muestran lo guardado: no se vacían al terminar.
				await update({ reset: false });
				await tick();
				// En un temporizador: SvelteKit restablece el foco con otro cuando la dirección lleva ancla.
				setTimeout(() => devolverFoco(previo, ancla));
			} finally {
				formElement.removeAttribute('aria-busy');
				enviando = null;
			}
		};
	};
</script>

{#if data.centros.length === 0}
	<p class="card">
		Aún no tiene centros de costo asignados. Pida a administración que se los asigne en Personal.
	</p>
{:else if centro && detalle}
	<div class="contexto">
		<form method="GET" action={resolve('/cobranza')} class="centro">
			{#if data.centros.length > 1}
				<div class="form-group">
					<label for="cobranza-centro">Centro de costo</label>
					<select
						id="cobranza-centro"
						name="centro"
						value={centro.id}
						on:change={(evento) => evento.currentTarget.form?.requestSubmit()}
					>
						{#each data.centros as opcion (opcion.id)}
							<option value={opcion.id}
								>{opcion.clave}{opcion.nombre ? ` · ${opcion.nombre}` : ''}</option
							>
						{/each}
					</select>
				</div>
				<input type="hidden" name="anio" value={anio} />
				<noscript><button class="boton">Consultar</button></noscript>
			{:else}
				<p class="unico">
					<span class="rotulo-grupo">Centro de costo</span>
					<strong>{centro.clave}{centro.nombre ? ` · ${centro.nombre}` : ''}</strong>
				</p>
			{/if}
		</form>
		{#if contrato}
			<NavegacionMes
				etiqueta="Cambiar el año de la cobranza"
				titulo={String(anio)}
				anterior={anio > ANIO_MINIMO ? pasoDeAnio(anio - 1) : null}
				siguiente={anio < ANIO_MAXIMO ? pasoDeAnio(anio + 1) : null}
			/>
		{/if}
	</div>

	{#if resultado && !resultado.ancla}
		<div class="resultado">
			{#if resultado.error}
				<p class="aviso aviso-error" role="alert">{resultado.error}</p>
			{:else if resultado.mensaje}
				<p class="aviso aviso-exito" role="status">{resultado.mensaje}</p>
			{/if}
		</div>
	{/if}

	{#if soloConsulta}
		<p class="aviso aviso-info">
			Solo consulta: su cuenta no puede modificar el contrato ni la cobranza.
		</p>
	{/if}

	{#key filtro}
		{#if contrato}
			<ResumenFinanzas
				{centro}
				mes={data.hoy.slice(0, 7)}
				estatus={data.estatus?.estatus ?? null}
				kpiCobranza={data.estatus?.cobranza ?? null}
				pasos={data.estatus?.pasos ?? null}
				{montoContrato}
				cobrado={contrato.cobradoTotal}
				{capturaAnterior}
				adicionales={contrato.adicionales}
				puedeCapturarMonto={puedeEditarContrato && Boolean(conceptoMonto)}
			/>

			{#if contrato.cartaFaltante}
				<p class="aviso aviso-alerta carta-faltante">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.25"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><path
							d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
						/><path d="M12 9v4M12 17h.01" /></svg
					>
					<span>
						El contrato de este centro de costo ya terminó y falta la carta de finalización.
						{#if puedeEditarContrato}<a class="enlace" href="#carta">Registrarla</a>{/if}
					</span>
				</p>
			{/if}

			<div class="par">
				<SeccionPlegable
					id="contrato"
					titulo="Contrato"
					nota={contrato.modoContrato ? ETIQUETA_MODO_CONTRATO[contrato.modoContrato] : ''}
					bind:abierta={abiertas.contrato}
				>
					{#if contrato.contratos.length}
						<p class="view-note catalogo">
							En el catálogo:
							{#each contrato.contratos as registrado, i (registrado.id)}
								{i ? '; ' : ''}<a
									class="enlace"
									href={resolve('/catalogo/contratos/[id]', { id: registrado.id })}
									>{registrado.numero}</a
								>, vigente del {textoFechaCorta(registrado.vigenciaInicio)} al
								{textoFechaCorta(registrado.vigenciaFin)}
							{/each}
						</p>
					{/if}
					{#if !detalle.plantillaId}
						<p class="view-note">
							Este centro de costo todavía no está configurado para el seguimiento. Avise a
							administración.
						</p>
					{:else if !conceptosContrato.length}
						<p class="view-note">La plantilla de este centro no define datos del contrato.</p>
					{:else if puedeEditarContrato}
						<form method="POST" action={`${urlGuardar}#r-contrato`} use:enhance={enviar}>
							<input type="hidden" name="ancla" value="r-contrato" />
							<div class="campos">
								{#each conceptosContrato as concepto (concepto.id)}
									{#if concepto.indicador === 'monto_cobrado'}
										<CampoConcepto
											{concepto}
											valor={capturaAnterior ?? contrato.cobradoTotal}
											prefijo="contrato"
											soloLectura
											insignia={capturaAnterior === null ? '' : 'Captura anterior'}
											nota="Se calcula con la cobranza mensual."
										/>
									{:else}
										<CampoConcepto
											{concepto}
											valor={valoresContrato.get(concepto.id) ?? null}
											prefijo="contrato"
											editable
										/>
									{/if}
								{/each}
							</div>
							{#if hayPorDefinir}
								<p class="view-note ayuda">
									Lo marcado como «Por definir» todavía no cuenta en el estatus.
								</p>
							{/if}
							<AccionesGuardar ancla="r-contrato" {resultado} {enviando}>
								<button class="boton primario ancho" name="accion" value="contrato"
									>Guardar contrato</button
								>
							</AccionesGuardar>
						</form>
					{:else}
						<dl class="datos">
							{#each conceptosContrato as concepto (concepto.id)}
								<div>
									<dt>
										{concepto.etiqueta}
										{#if concepto.porDefinir}<span class="status-badge por-definir"
												>Por definir</span
											>{/if}
									</dt>
									<dd>
										{#if concepto.indicador === 'monto_cobrado'}
											<CampoConcepto {concepto} valor={capturaAnterior ?? contrato.cobradoTotal} />
											{#if capturaAnterior !== null}<span class="status-badge"
													>Captura anterior</span
												>{/if}
											<span class="view-note">Se calcula con la cobranza mensual.</span>
										{:else}
											<CampoConcepto {concepto} valor={valoresContrato.get(concepto.id) ?? null} />
										{/if}
									</dd>
								</div>
							{/each}
						</dl>
					{/if}
				</SeccionPlegable>

				<SeccionPlegable
					id="carta"
					titulo="Carta de finalización"
					nota={contrato.carta.fecha
						? `Fechada el ${textoFechaCorta(contrato.carta.fecha)}`
						: 'Sin carta'}
					bind:abierta={abiertas.carta}
				>
					{#if contrato.carta.fecha}
						<p class="view-note">
							Fechada el {textoFechaCorta(contrato.carta.fecha)}{#if contrato.carta.enlace}
								·
								<!-- eslint-disable svelte/no-navigation-without-resolve -- enlace externo de SharePoint -->
								<a
									class="enlace"
									href={contrato.carta.enlace}
									target="_blank"
									rel="noopener noreferrer">Abrir en SharePoint</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
						</p>
					{:else}
						<p class="view-note">
							Sin carta registrada. Solo es obligatoria cuando el contrato termina.
						</p>
					{/if}
					{#if puedeEditarContrato}
						<form
							method="POST"
							action={`${urlGuardar}#r-carta`}
							use:enhance={enviar}
							class="formulario-carta"
						>
							<input type="hidden" name="ancla" value="r-carta" />
							<div class="form-group">
								<label for="carta-fecha">Fecha de la carta</label>
								<input
									id="carta-fecha"
									type="date"
									name="fecha"
									value={contrato.carta.fecha ?? ''}
								/>
							</div>
							<div class="form-group">
								<label for="carta-enlace">Enlace de SharePoint (opcional)</label>
								<input
									id="carta-enlace"
									type="url"
									name="enlace"
									maxlength="2048"
									placeholder="https://…sharepoint.com/…"
									value={contrato.carta.enlace ?? ''}
								/>
							</div>
							<AccionesGuardar ancla="r-carta" {resultado} {enviando}>
								<button class="boton primario ancho" name="accion" value="carta"
									>Guardar carta</button
								>
							</AccionesGuardar>
						</form>
					{/if}
				</SeccionPlegable>
			</div>

			{#if conceptosOrden.length}
				<SeccionPlegable
					id="ordenes"
					titulo="Órdenes de compra"
					nota={contrato.ordenes.length === 1
						? '1 registrada'
						: `${contrato.ordenes.length} registradas`}
					bind:abierta={abiertas.ordenes}
				>
					<OrdenesCompra
						conceptos={conceptosOrden}
						ordenes={contrato.ordenes}
						puedeEditar={puedeEditarContrato}
						idNueva={data.idOrden}
						{urlGuardar}
						{enviar}
						{resultado}
						{enviando}
					/>
				</SeccionPlegable>
			{/if}

			<Adicionales
				adicionales={contrato.adicionales}
				contratos={contrato.contratos}
				{puedeEditarContrato}
				{puedeEditarCobranza}
				idNuevo={data.idAdicional}
				{urlGuardar}
				{enviar}
				{resultado}
				{enviando}
				{enviado}
			/>

			<CobranzaMensual
				{anio}
				{meses}
				mesActual={data.hoy.slice(0, 7)}
				puedeEditar={puedeEditarCobranza}
				{urlGuardar}
				{enviar}
				{resultado}
				{enviando}
			/>
		{/if}

		{#if detalle.programaEnlace !== undefined}
			<section class="card programa" id="programa" aria-labelledby="titulo-programa">
				<h2 class="view-heading" id="titulo-programa" tabindex="-1">Programa anual</h2>
				{#if detalle.programaEnlace}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- enlace externo de SharePoint -->
					<a class="enlace" href={detalle.programaEnlace} target="_blank" rel="noopener noreferrer"
						>Abrir el programa anual en SharePoint</a
					>
				{:else}
					<p class="view-note">Sin enlace registrado.</p>
				{/if}
				{#if puedeEditarContrato}
					<form
						method="POST"
						action={`${urlGuardar}#r-programa`}
						use:enhance={enviar}
						class="formulario-programa"
					>
						<input type="hidden" name="ancla" value="r-programa" />
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
						<AccionesGuardar ancla="r-programa" {resultado} {enviando}>
							<button class="boton primario ancho" name="accion" value="programa"
								>Guardar enlace</button
							>
						</AccionesGuardar>
					</form>
				{/if}
			</section>
		{/if}
	{/key}
{/if}

<style>
	/* Contexto: centro de costo y año. Sin tarjeta: en teléfono, dos filas de 44 px. */
	.contexto {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 12px 24px;
		margin-bottom: 20px;
	}
	.centro {
		display: flex;
		flex: 1 1 20rem;
		flex-wrap: wrap;
		align-items: end;
		gap: 8px 12px;
		min-width: 0;
		max-width: 34rem;
	}
	.centro .form-group {
		flex: 1 1 16rem;
		margin: 0;
		min-width: 0;
	}
	.unico {
		display: grid;
		gap: 2px;
		margin: 0;
		overflow-wrap: anywhere;
	}
	.resultado .aviso,
	.carta-faltante {
		margin-bottom: 16px;
	}
	.carta-faltante {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		font-weight: 600;
	}
	.carta-faltante svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		margin-top: 1px;
		color: var(--alerta);
	}
	/* Contrato y carta, lado a lado cuando hay sitio. */
	.par {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0 24px;
		align-items: start;
	}
	@media (min-width: 1100px) {
		.par {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		}
	}
	.catalogo {
		margin-bottom: 12px;
	}
	.campos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: 12px 16px;
		margin-bottom: 12px;
	}
	.ayuda {
		margin-bottom: 12px;
	}
	.datos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: 12px;
		margin: 0;
	}
	.datos > div {
		min-width: 0;
		padding: 10px 12px;
		border-radius: var(--radio-control);
		background: var(--superficie-alta);
	}
	.datos dt {
		color: var(--tinta-secundaria);
		font-size: var(--texto-xs);
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.datos dd {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 8px;
		margin: 4px 0 0;
		font-size: var(--texto-campo);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.datos dd .view-note {
		flex-basis: 100%;
	}
	.formulario-carta,
	.formulario-programa {
		display: grid;
		gap: 12px;
		margin-top: 12px;
	}
	.formulario-carta .form-group,
	.formulario-programa .form-group {
		margin: 0;
	}
	.formulario-programa {
		max-width: 40rem;
	}
	.programa {
		scroll-margin-top: 12px;
	}
	:global(form[aria-busy='true']) {
		opacity: 0.7;
		cursor: progress;
	}
	@media (max-width: 768px) {
		.contexto {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			justify-content: stretch;
			gap: 8px;
			margin-bottom: 16px;
		}
		.centro {
			max-width: none;
		}
		.centro select {
			min-height: 44px;
		}
	}
</style>
