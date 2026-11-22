<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import TarjetaCentro from '$lib/components/estatus/TarjetaCentro.svelte';
	import AtencionesEmergencia from '$lib/components/seguimiento/AtencionesEmergencia.svelte';
	import BarraContexto from '$lib/components/seguimiento/BarraContexto.svelte';
	import CarpetaSeguimiento from '$lib/components/seguimiento/CarpetaSeguimiento.svelte';
	import FormularioPartida from '$lib/components/seguimiento/FormularioPartida.svelte';
	import TarjetaPartida from '$lib/components/seguimiento/TarjetaPartida.svelte';
	import ValorSeguimiento from '$lib/components/seguimiento/ValorSeguimiento.svelte';
	import {
		avanceDeDocumentos,
		claveValor,
		esDocumento,
		mesVecino,
		ordenarPartidas,
		partidasAbiertas,
		resultadoDe,
		textoBreve,
		type EstadoCaptura,
		type MapaValores
	} from '$lib/components/seguimiento/captura';
	import EstadoGuardado from '$lib/components/ui/EstadoGuardado.svelte';
	import NavegacionMes from '$lib/components/ui/NavegacionMes.svelte';
	import { ETIQUETA_ESTATUS } from '$lib/dominio/estatus';
	import { carpetaCerrada, partidasDelMes } from '$lib/dominio/seguimiento-operativo';
	import { plural, textoMes } from '$lib/dominio/textos';
	import type { PageProps } from './$types';

	export let data: PageProps['data'];
	export let form: PageProps['form'];

	const SIN_CONEXION = 'No se guardó: no hay conexión. Inténtelo de nuevo cuando tenga señal.';

	const ruta = resolve('/seguimiento');

	$: ({ centro, mes, hoy, seguimiento, puedeEditar } = data);
	$: filtro = new URLSearchParams({ centro: centro?.id ?? '', mes }).toString();
	$: urlGuardar = `${ruta}?/guardar&${filtro}`;
	$: plantillaId = seguimiento?.plantillaId ?? null;
	$: conceptos = seguimiento?.conceptos ?? [];
	$: conceptosMes = conceptos.filter((c) => c.nivel === 'periodo' && c.bloque !== 'carpetas');
	$: conceptosPartida = conceptos.filter((c) => c.nivel === 'partida');
	$: conceptosActividad = conceptos.filter((c) => c.nivel === 'actividad');
	$: conceptosCarpeta = conceptos.filter((c) => c.bloque === 'carpetas');
	$: documentosPlantilla = conceptos.filter((c) => c.bloque === 'documentos');
	$: valores = new Map(
		seguimiento?.valores.map((v) => [claveValor(v.actividad, v.conceptoId), v.valor])
	) as MapaValores;
	$: partidas = ordenarPartidas(partidasDelMes(seguimiento?.actividades ?? []));
	// Qué partidas se ven abiertas se decide con lo que había al cargar (TarjetaPartida lo lee una vez).
	$: abiertas = partidasAbiertas(
		partidas,
		[...conceptosPartida, ...conceptosActividad],
		valores,
		hoy
	);
	$: programadas = seguimiento?.actividades.filter((a) => a.programada) ?? [];
	$: totalEjecutadas = programadas.filter((a) => a.ejecutada).length;
	$: conPrograma = seguimiento?.origen === 'programa_anual';
	$: puedeMarcarMes =
		Boolean(seguimiento?.actividades.length) || conceptosMes.some((c) => esDocumento(c));
	$: hayPorDefinir = conceptos.some((c) => c.porDefinir && c.bloque !== 'carpetas');
	$: carpetasCerradas =
		seguimiento?.carpetas.filter(
			(c) => carpetaCerrada(c.estado) && conceptosCarpeta.some((k) => k.id === c.conceptoId)
		).length ?? 0;

	/** Documentos de cada carpeta: los suyos o, si no tiene asignados, los que no son de ninguna. */
	$: documentosDeCarpeta = new Map(
		conceptosCarpeta.map((carpeta) => {
			const propios = documentosPlantilla.filter((d) => d.carpetaId === carpeta.id);
			const lista = propios.length ? propios : documentosPlantilla.filter((d) => !d.carpetaId);
			return [carpeta.id, lista.length ? avanceDeDocumentos(lista, partidas, valores) : null];
		})
	);

	$: periodo = {
		anterior: pasoA(mesVecino(mes, -1), centro?.id),
		siguiente: pasoA(mesVecino(mes, 1), centro?.id),
		titulo: textoMes(mes, { inicial: true }),
		actual: mes === data.mesActual
	};
	function pasoA(otro: string, centroId: string | undefined) {
		const consulta = new URLSearchParams(
			centroId ? { centro: centroId, mes: otro } : { mes: otro }
		);
		return {
			href: `${ruta}?${consulta}`,
			texto: textoMes(otro, { corto: true }).slice(0, 3),
			nombre: textoMes(otro)
		};
	}

	/** «5 centros de costo en noviembre 2026: 1 atrasado, 3 con pendientes y 1 sin datos.» */
	$: resumenCentros = (() => {
		const total = plural(data.misCentros?.length ?? 0, 'centro de costo', 'centros de costo');
		const partes = (data.cuentas ?? [])
			.filter((c) => c.cantidad > 0)
			.map(
				(c) =>
					`${c.cantidad} ${ETIQUETA_ESTATUS[c.estatus].toLowerCase()}${c.estatus === 'atrasado' && c.cantidad !== 1 ? 's' : ''}`
			);
		const lista =
			partes.length > 1
				? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
				: (partes[0] ?? '');
		return `${total} en ${textoMes(mes)}${lista ? `: ${lista}` : ''}.`;
	})();

	// Estado de la captura: qué tarjetas están enviando y la última respuesta, con su ancla.
	let enCurso: string[] = [];
	let sinConexion: { ancla: string | null; accion: string } | null = null;
	let captura: EstadoCaptura;
	$: captura = sinConexion
		? { enviando: enCurso, ...sinConexion, error: SIN_CONEXION }
		: {
				enviando: enCurso,
				ancla: form?.ancla ?? null,
				accion: form?.accion ?? null,
				mensaje: form?.mensaje,
				error: form?.error
			};
	$: deActividades = resultadoDe(captura, 'actividades');
	$: deDatosMes = resultadoDe(captura, 'datos-mes');

	/** Título de la tarjeta a la que corresponde un ancla: recibe el foco cuando se pierde. */
	function tituloDe(ancla: string): HTMLElement | null {
		const elemento = document.getElementById(ancla);
		if (!elemento) return null;
		return elemento.matches('h2, h3, h4')
			? elemento
			: (elemento.querySelector<HTMLElement>('h2, h3, h4') ?? elemento);
	}

	const enviar: SubmitFunction = ({ formElement, formData, submitter, cancel }) => {
		// El formulario de una ejecución tiene varios botones independientes: se bloquea el botón
		// pulsado, no todo el formulario, para poder marcar varios documentos seguidos.
		const ocupado =
			formElement.dataset.porBoton !== undefined && submitter ? submitter : formElement;
		if (ocupado.getAttribute('aria-busy') === 'true') {
			cancel();
			return;
		}
		const ancla = String(formData.get('ancla') ?? '');
		const accion = String(formData.get('accion') ?? '');
		ocupado.setAttribute('aria-busy', 'true');
		enCurso = [...enCurso, ancla];
		sinConexion = null;
		return async ({ result, update }) => {
			try {
				// Sin respuesta del servidor (sin señal): el aviso va en la tarjeta, no en otra página.
				if (result.type === 'error' && !result.status) {
					sinConexion = { ancla: ancla || null, accion };
					return;
				}
				if (result.type === 'failure' && result.status === 409) await invalidateAll();
				await update();
			} finally {
				ocupado.removeAttribute('aria-busy');
				const indice = enCurso.indexOf(ancla);
				enCurso = enCurso.filter((_, i) => i !== indice);
			}
			if (result.type !== 'success') return;
			await tick();
			// Si lo que tenía el foco ya no está (un formulario que se cierra, una partida nueva), el
			// foco pasa al título de la tarjeta donde quedó el cambio.
			const destino = String(result.data?.ancla ?? ancla);
			const activo = document.activeElement;
			const perdido =
				!activo ||
				activo === document.body ||
				!activo.isConnected ||
				(activo instanceof HTMLElement && activo.offsetParent === null);
			if (destino && (perdido || destino !== ancla)) {
				const titulo = tituloDe(destino);
				titulo?.focus({ preventScroll: true });
				titulo?.scrollIntoView({ block: 'nearest' });
			}
		};
	};
</script>

{#if data.centros.length === 0}
	<p class="card">
		Aún no tiene centros de costo asignados. Pida a administración que se los asigne en Personal.
	</p>
{:else if !centro && data.misCentros}
	<div class="contexto-lista">
		<h2 class="view-heading" id="titulo-mis-centros">Mis centros de costo</h2>
		<NavegacionMes {...periodo} />
	</div>
	<p class="view-note resumen-centros">{resumenCentros} Toque el suyo para ver qué falta.</p>
	<ul class="mis-centros" aria-labelledby="titulo-mis-centros">
		{#each data.misCentros as fila (fila.centro.id)}
			<li>
				<TarjetaCentro
					centro={fila.centro}
					{mes}
					estatus={fila.estatus}
					kpis={fila.kpis}
					falta={fila.falta}
					emergencias={fila.emergencias}
					variante="compacta"
					verCobranza={data.verCobranza}
				/>
			</li>
		{/each}
	</ul>
{:else if centro && seguimiento}
	{#if data.centros.length > 1}
		<p class="volver">
			<!-- La ruta ya pasó por resolve(). -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="enlace" href={`${ruta}?${new URLSearchParams({ mes })}`}>
				<span aria-hidden="true">‹</span> Mis centros de costo
			</a>
		</p>
	{/if}
	<BarraContexto {ruta} centros={data.centros} centroId={centro.id} valor={mes} {periodo} />

	{#if !puedeEditar}
		<p class="aviso aviso-info">Solo consulta: su cuenta no puede modificar el seguimiento.</p>
	{/if}
	{#if captura.ancla === null && (captura.error || captura.mensaje)}
		{#if captura.error}
			<p class="aviso aviso-error" role="alert">{captura.error}</p>
		{:else}
			<p class="aviso aviso-exito" role="status">{captura.mensaje}</p>
		{/if}
	{/if}

	{#key filtro}
		{#if !plantillaId}
			<p class="card">
				Este centro de costo todavía no está configurado para el seguimiento. Avise a
				administración.
			</p>
		{:else}
			{#if data.estatus}
				<TarjetaCentro
					{centro}
					{mes}
					estatus={data.estatus.estatus}
					kpis={data.estatus.kpis}
					falta={data.estatus.falta}
					emergencias={data.estatus.emergencias}
					variante="ficha"
					verCobranza={data.verCobranza}
				/>
			{/if}

			<nav class="indice" aria-label="Secciones del seguimiento">
				<span class="rotulo-grupo">Ir a</span>
				<ul>
					{#if seguimiento.origen !== 'ninguno'}
						<li>
							<a href="#actividades">
								Actividades
								{#if programadas.length}
									<span class="cifra">{totalEjecutadas} de {programadas.length}</span>
								{/if}
							</a>
						</li>
					{/if}
					{#if conceptosMes.length}
						<li><a href="#datos-mes">Datos del mes</a></li>
					{/if}
					{#if conceptosCarpeta.length}
						<li>
							<a href="#carpetas">
								Carpetas
								<span class="cifra">{carpetasCerradas} de {conceptosCarpeta.length}</span>
							</a>
						</li>
					{/if}
					<li>
						<a href="#emergencias">
							Emergencias
							<span class="cifra">{seguimiento.nocturnas.length}</span>
						</a>
					</li>
				</ul>
			</nav>

			{#if seguimiento.origen !== 'ninguno'}
				<section class="card seccion" id="actividades" aria-labelledby="titulo-actividades">
					<div class="encabezado">
						<div>
							<h2 class="view-heading" id="titulo-actividades" tabindex="-1">
								Actividades de {textoMes(mes)}
							</h2>
							{#if programadas.length}
								<p class="view-note">
									{totalEjecutadas} de {programadas.length} ejecutadas
								</p>
							{/if}
						</div>
						{#if puedeEditar}
							<EstadoGuardado
								estado={deActividades.fase}
								mensaje={textoBreve(deActividades.mensaje)}
							/>
						{/if}
					</div>
					{#if deActividades.error}
						<p class="aviso aviso-error" role="alert">{deActividades.error}</p>
					{/if}
					{#if hayPorDefinir}
						<p class="view-note por-definir">
							Lo marcado como «Por definir» todavía no cuenta en el estatus.
						</p>
					{/if}

					{#if partidas.length}
						<div class="partidas">
							{#each partidas as partida (partida.grupo)}
								<TarjetaPartida
									{partida}
									{conceptosPartida}
									{conceptosActividad}
									{valores}
									fueraDelPrograma={conPrograma && partida.manual}
									abiertaAlCargar={abiertas.has(partida.grupo)}
									{mes}
									{hoy}
									{urlGuardar}
									{plantillaId}
									{puedeEditar}
									{enviar}
									{captura}
								/>
							{/each}
						</div>
					{:else if conPrograma}
						<p class="view-note">
							El programa anual no tiene actividades en {textoMes(mes)}.{puedeEditar
								? ' Si se hizo un trabajo, agréguelo como partida.'
								: ''}
						</p>
					{:else}
						<p class="view-note">
							Todavía no hay partidas en {textoMes(mes)}.{puedeEditar ? ' Agregue la primera.' : ''}
						</p>
					{/if}

					{#if puedeEditar}
						<FormularioPartida
							id={data.idActividad}
							fueraDelPrograma={conPrograma}
							{mes}
							{urlGuardar}
							{plantillaId}
							{enviar}
							{captura}
						/>
						{#if puedeMarcarMes && partidas.length}
							<details class="marcar-mes">
								<summary class="resumen-boton boton fantasma">Marcar todo el mes como hecho</summary
								>
								<form method="POST" action={`${urlGuardar}#actividades`} use:enhance={enviar}>
									<input type="hidden" name="ancla" value="actividades" />
									<input type="hidden" name="plantillaId" value={plantillaId} />
									<p class="view-note">
										Marca como ejecutadas todas las actividades de {textoMes(mes)} y todos sus documentos.
										Úselo solo si de verdad se hizo todo.
									</p>
									<button class="boton contorno" name="accion" value="marcarMes"
										>Sí, marcar todo como hecho</button
									>
								</form>
							</details>
						{/if}
					{/if}
				</section>
			{/if}

			{#if conceptosMes.length}
				<section class="card seccion" id="datos-mes" aria-labelledby="titulo-datos-mes">
					<div class="encabezado">
						<div>
							{#if seguimiento.origen === 'ninguno'}
								<!-- «Qué falta» manda los documentos a #actividades: sin esa sección, están aquí. -->
								<span id="actividades"></span>
							{/if}
							<h2 class="view-heading" id="titulo-datos-mes" tabindex="-1">Datos del mes</h2>
							<p class="view-note">Se llenan una vez al mes.</p>
						</div>
						{#if puedeEditar}
							<EstadoGuardado estado={deDatosMes.fase} mensaje={textoBreve(deDatosMes.mensaje)} />
						{/if}
					</div>
					{#if deDatosMes.error}
						<p class="aviso aviso-error" role="alert">{deDatosMes.error}</p>
					{/if}
					<div class="datos-mes">
						{#each conceptosMes as concepto (concepto.id)}
							<ValorSeguimiento
								{concepto}
								valor={valores.get(claveValor(null, concepto.id)) ?? null}
								ancla="datos-mes"
								{urlGuardar}
								{plantillaId}
								{puedeEditar}
								{enviar}
							/>
						{/each}
					</div>
				</section>
			{/if}

			{#if conceptosCarpeta.length}
				<section class="card seccion" id="carpetas" aria-labelledby="titulo-carpetas">
					<div class="encabezado">
						<div>
							<h2 class="view-heading" id="titulo-carpetas" tabindex="-1">Carpetas</h2>
							<p class="view-note">
								{carpetasCerradas} de {conceptosCarpeta.length}
								{carpetasCerradas === 1 ? 'recibida' : 'recibidas'} correctamente
							</p>
						</div>
					</div>
					<div class="carpetas">
						{#each conceptosCarpeta as concepto (concepto.id)}
							<CarpetaSeguimiento
								{concepto}
								carpeta={seguimiento.carpetas.find((c) => c.conceptoId === concepto.id)}
								personal={seguimiento.personal}
								personaSesion={data.personaSesion}
								{hoy}
								documentos={documentosDeCarpeta.get(concepto.id) ?? null}
								urlArchivo={`${resolve('/seguimiento/archivo/[concepto]', { concepto: concepto.id })}?${filtro}`}
								{urlGuardar}
								{plantillaId}
								{puedeEditar}
								{enviar}
								{captura}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<AtencionesEmergencia
				atenciones={seguimiento.nocturnas}
				personal={seguimiento.personal}
				fechaSugerida={data.fechaSugerida}
				{mes}
				idNueva={data.idNocturna}
				{urlGuardar}
				{plantillaId}
				{puedeEditar}
				{enviar}
				{captura}
			/>
		{/if}
	{/key}
{/if}

<style>
	.contexto-lista {
		display: grid;
		gap: 12px;
		margin-bottom: 12px;
	}
	.contexto-lista .view-heading {
		margin: 0;
	}
	.resumen-centros {
		margin-bottom: 16px;
	}
	.mis-centros {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.mis-centros li {
		display: grid;
		min-width: 0;
	}
	.volver {
		margin: 0 0 8px;
	}
	.volver a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
	}
	.indice {
		display: grid;
		gap: 6px;
		margin-bottom: 16px;
	}
	.indice ul {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.indice a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 6px 14px;
		border: 1px solid var(--linea-fuerte);
		border-radius: var(--radio-control);
		background: var(--superficie);
		color: var(--accion);
		font-weight: 600;
	}
	.indice a:hover {
		border-color: var(--accion);
		background: var(--accion-suave);
		color: var(--accion-hover);
	}
	.indice .cifra {
		color: var(--tinta-secundaria);
		font-size: var(--texto-sm);
		font-weight: 600;
	}
	.seccion {
		scroll-margin-top: 16px;
		min-width: 0;
	}
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
		margin-bottom: 12px;
	}
	.encabezado .view-heading {
		margin: 0;
	}
	.seccion > .aviso {
		margin-bottom: 12px;
	}
	.por-definir {
		margin-bottom: 12px;
	}
	.partidas {
		display: grid;
		gap: 12px;
	}
	.marcar-mes {
		margin-top: 8px;
	}
	.marcar-mes form {
		display: grid;
		gap: 10px;
		justify-items: start;
		max-width: 36rem;
		padding: 14px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-panel);
		background: var(--superficie-alta);
	}
	.marcar-mes .boton {
		min-height: 44px;
		white-space: normal;
	}
	.datos-mes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
		gap: 14px 16px;
		align-items: end;
	}
	.carpetas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: 12px;
		align-items: start;
	}
	:global(form[aria-busy='true']),
	:global(form[data-por-boton] button[aria-busy='true']) {
		opacity: 0.7;
		cursor: progress;
	}
	@media (max-width: 768px) {
		.indice ul {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.indice a {
			justify-content: space-between;
			width: 100%;
		}
	}
</style>
