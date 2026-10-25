<!-- Programa anual: lo programado (P) y realizado (R) de cada partida por mes con su estado de
     ejecución y documental, ajustes (reprogramar y no ejecutado), pendientes vencidos y acceso a la
     captura. Vista anual por omisión, mensual y semanal. En la anual, elegir una celda abre un panel
     con sus datos y acciones (capturar o continuar, ajustar y registrar un realizado externo). -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import {
		anotacionesCelda,
		CODIGO_EJECUCION,
		codigoDocumental,
		detalleCelda,
		ejecutado,
		ETIQUETA_EJECUCION,
		estadoDocumental,
		estadoEjecucion,
		faltan,
		SIMBOLO_EJECUCION,
		textoDocumental,
		type EjecucionDelMes,
		type EstadoEjecucion
	} from '$lib/dominio/cumplimiento';
	import { plural, textoMes, textoOracion } from '$lib/dominio/textos';
	import type {
		Ajuste,
		AvancePrograma,
		CeldaPrograma,
		Contrato,
		Programa,
		Sitio
	} from '$lib/dominio/esquemas';
	import type { FiltroPlaneacion, PendienteVencido } from '$lib/dominio/planeacion';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';
	import DialogoAjuste from '$lib/components/planeacion/DialogoAjuste.svelte';
	import VistaMensual from '$lib/components/planeacion/VistaMensual.svelte';
	import VistaSemanal from '$lib/components/planeacion/VistaSemanal.svelte';
	import { llamarAccion } from '$lib/components/reportes/acciones';
	import EncabezadoPagina from '$lib/components/ui/EncabezadoPagina.svelte';
	import { notificaciones } from '$lib/components/ui/notificaciones';

	type Partida = AvancePrograma['partidas'][number];

	export let hoy = '';
	export let contratos: Contrato[] = [];
	export let contrato: Contrato | null = null;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let programas: Programa[] = [];
	export let programa: Programa | null = null;
	export let meses: string[] = [];
	export let partidas: Partida[] = [];
	export let totalPartidas = 0;
	export let vencidos: PendienteVencido[] = [];
	export let filtro: FiltroPlaneacion = {};
	export let vista: 'anual' | 'mensual' | 'semanal' = 'anual';
	export let mesVista: string | null = null;
	export let semana = 1;
	export let ejecucionesMes: EjecucionDelMes[] = [];
	export let form: Record<string, unknown> | null = null;

	const LEYENDA_EJECUCION: EstadoEjecucion[] = [
		'ejecutado',
		'pendiente',
		'programado',
		'vencido',
		'reprogramado',
		'no_ejecutado',
		'extra'
	];
	/** Códigos del documento en la matriz (codigoDocumental). */
	const LEYENDA_DOCUMENTAL = [
		{ codigo: 'CR', texto: 'Con reporte (final)' },
		{ codigo: 'B', texto: 'Borrador' },
		{ codigo: 'ER', texto: 'En revisión' },
		{ codigo: 'S', texto: 'Sin reporte' }
	];
	const VISTAS = [
		{ valor: 'anual', texto: 'Anual' },
		{ valor: 'mensual', texto: 'Mensual' },
		{ valor: 'semanal', texto: 'Semanal' }
	] as const;

	/** Consulta de una captura nueva con contrato, sitio, partida, mes y, si aplica, la reprogramación. */
	const consultaCaptura = (partidaId: string, mes: string, reprogramacion?: string) =>
		`contrato=${contrato?.id}&sitio=${sitio?.id}&partida=${partidaId}&mes=${mes}${reprogramacion ? `&reprogramacion=${reprogramacion}` : ''}`;

	/** Consulta de los reportes emitidos de la partida en el mes. */
	const consultaHistorial = (partidaId: string, mes: string) =>
		`contrato=${contrato?.id}&sitio=${sitio?.id}&partida=${partidaId}&desde=${mes.slice(0, 7)}&hasta=${mes.slice(0, 7)}&estado=emitido`;

	/** Dirección de la planeación con los filtros actuales y la vista, el mes y la semana dados. */
	function enlaceVista(otra: string, mes?: string | null, numero?: number): string {
		const consulta = [
			contrato ? `contrato=${contrato.id}` : '',
			sitio ? `sitio=${sitio.id}` : '',
			programa ? `programa=${programa.id}` : '',
			filtro.distribucion ? `distribucion=${filtro.distribucion}` : '',
			filtro.periodicidad ? `periodicidad=${filtro.periodicidad}` : '',
			otra !== 'anual' ? `vista=${otra}` : '',
			otra !== 'anual' && mes ? `mes=${mes}` : '',
			otra === 'semanal' && numero ? `semana=${numero}` : ''
		].filter(Boolean);
		return `${resolve('/planeacion')}${consulta.length ? `?${consulta.join('&')}` : ''}`;
	}

	/** Reprogramación que llega a la celda y aún falta por reportar, para «Capturar». */
	const reprogramacionPendiente = (c: CeldaPrograma) =>
		c.ajustes.find(
			(a) => a.tipo === 'reprogramado' && a.mesDestino === c.mes && a.ejecuciones < a.cantidad
		)?.id;

	/** Nombre accesible de la celda: partida, mes, programado, ejecutado y ambos estados. */
	function nombreCelda(p: Partida, c: CeldaPrograma): string {
		const documental = textoDocumental(c);
		const notas = [...anotacionesCelda(c), detalleCelda(c, hoy)].filter(Boolean).join(', ');
		return `Partida ${p.numero}, ${textoMes(c.mes)}: programado ${c.programado ?? 0}, ejecutado ${ejecutado(c)}, ${ETIQUETA_EJECUCION[estadoEjecucion(c, hoy)]}${documental ? `, ${documental}` : ''}${notas ? `, ${notas}` : ''}`;
	}

	$: vencidosPorMes = [...new Set(vencidos.map((v) => v.mes))].map((mes) => ({
		mes,
		pendientes: vencidos.filter((v) => v.mes === mes)
	}));

	function enviarAlCambiar(evento: Event) {
		(evento.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}

	// Ajustes: un solo diálogo para la celda elegida en la matriz, la vista mensual o los vencidos.
	let ajuste: { partida: Partida; celda: CeldaPrograma } | null = null;
	let dialogoAbierto = false;
	let errorAjuste = '';
	let dialogo: DialogoAjuste | undefined;

	async function abrirAjuste(partida: Partida, celda: CeldaPrograma) {
		ajuste = { partida, celda };
		errorAjuste = '';
		dialogoAbierto = true;
		await dialogo?.reiniciar();
	}

	function abrirVencido(v: PendienteVencido) {
		const partida = partidas.find((p) => p.id === v.partidaId);
		const celda = partida?.celdas.find((c) => c.mes === v.mes);
		if (partida && celda) abrirAjuste(partida, celda);
	}

	// Mientras el diálogo está abierto, la celda se actualiza con los datos recargados.
	$: if (ajuste) {
		const partida = partidas.find((p) => p.id === ajuste!.partida.id);
		const celda = partida?.celdas.find((c) => c.mes === ajuste!.celda.mes);
		if (partida && celda && celda !== ajuste.celda) ajuste = { partida, celda };
	}

	async function deshacerAjuste(a: Ajuste) {
		const datos = new FormData();
		datos.set('id', a.id);
		const resultado = await llamarAccion('anularAjuste', datos, resolve('/planeacion'));
		if (!resultado.ok) {
			notificaciones.mostrar({ mensaje: String(resultado.datos.error ?? 'No se pudo deshacer.') });
		}
		await invalidateAll();
	}

	const alEnviar =
		(accion: 'registrarAjuste' | 'anularAjuste'): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') {
				errorAjuste = String(result.data?.error ?? 'No se pudo guardar el ajuste.');
				// El diálogo se cerró al confirmar: el error se muestra dentro, de nuevo abierto.
				dialogoAbierto = true;
				return;
			}
			errorAjuste = '';
			await update({ reset: false });
			if (result.type === 'success' && accion === 'registrarAjuste') {
				const registrado = result.data?.ajuste as Ajuste | undefined;
				if (registrado) {
					notificaciones.mostrar({
						mensaje:
							registrado.tipo === 'reprogramado'
								? `Se reprogramó ${plural(registrado.cantidad, 'ejecución', 'ejecuciones')} a ${textoMes(registrado.mesDestino!)}.`
								: `Se marcó ${plural(registrado.cantidad, 'ejecución', 'ejecuciones')} como no ejecutada.`,
						textoDeshacer: 'Deshacer',
						plazo: 10_000,
						alDeshacer: () => deshacerAjuste(registrado)
					});
				}
			}
		};

	$: avisoGeneral = (form?.accion ? null : form) as { mensaje?: string; error?: string } | null;

	/** «Mayo–Septiembre 2026» o, si cambia el año, «Noviembre 2025–Enero 2026». */
	function rangoDeMeses(desde: string, hasta: string): string {
		if (desde === hasta) return textoMes(desde, { inicial: true });
		const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
		const inicio = textoMes(desde, { inicial: true });
		return `${mismoAnio ? inicio.split(' ')[0] : inicio}–${textoMes(hasta, { inicial: true })}`;
	}

	// Celda elegida en la matriz: el panel lateral reúne sus datos y acciones.
	let seleccion: { partidaId: string; mes: string } | null = null;
	$: elegida = (() => {
		if (!seleccion) return null;
		const partida = partidas.find((p) => p.id === seleccion!.partidaId);
		const celda = partida?.celdas.find((c) => c.mes === seleccion!.mes);
		return partida && celda ? { partida, celda } : null;
	})();
	let panel: HTMLElement | undefined;

	async function seleccionar(partida: Partida, celda: CeldaPrograma) {
		const misma = seleccion?.partidaId === partida.id && seleccion.mes === celda.mes;
		seleccion = misma ? null : { partidaId: partida.id, mes: celda.mes };
		if (misma) return;
		await tick();
		panel?.focus();
	}

	async function cerrarPanel() {
		const anterior = seleccion;
		seleccion = null;
		await tick();
		if (anterior) document.getElementById(`celda-${anterior.partidaId}-${anterior.mes}`)?.focus();
	}

	/** La matriz se desplaza a lo ancho con la partida fija; el pie dice hacia dónde hay más meses. */
	let contenedorTabla: HTMLDivElement | undefined;
	let desborda = false;
	let alFinal = false;
	function medirTabla() {
		if (!contenedorTabla) return;
		const { scrollLeft, scrollWidth, clientWidth } = contenedorTabla;
		desborda = scrollWidth > clientWidth + 1;
		alFinal = scrollLeft + clientWidth >= scrollWidth - 1;
	}
	function desplazarTabla() {
		contenedorTabla?.scrollTo({
			left: alFinal ? 0 : contenedorTabla.scrollWidth,
			behavior: 'smooth'
		});
	}
	onMount(() => {
		const observador = new ResizeObserver(medirTabla);
		if (contenedorTabla) observador.observe(contenedorTabla);
		return () => observador.disconnect();
	});
	$: if (contenedorTabla && (elegida || !elegida)) tick().then(medirTabla);

	// Registro de un realizado hecho fuera del sistema; el panel lo abre con la partida y el mes elegidos.
	let registroAbierto = false;
	let manualPartida = '';
	let manualMes = '';
	async function registrarExterno(partidaId?: string, mes?: string) {
		manualPartida = partidaId ?? partidas[0]?.id ?? '';
		manualMes = mes ?? meses.find((m) => m.slice(0, 7) === hoy.slice(0, 7)) ?? meses[0] ?? '';
		registroAbierto = true;
		await tick();
		document.getElementById('manual-cantidad')?.focus();
	}
</script>

<!-- Esc cierra el panel de la celda (si no hay un diálogo abierto encima). -->
<svelte:window
	on:keydown={(e) => e.key === 'Escape' && elegida && !dialogoAbierto && cerrarPanel()}
/>

<EncabezadoPagina
	ceja={`Programa / ${VISTAS.find((v) => v.valor === vista)?.texto ?? 'Anual'}`}
	titulo="Programa anual"
	descripcion={programa
		? `Ciclo ${rangoDeMeses(programa.periodoInicio, programa.periodoFin)}`
		: null}
>
	<svelte:fragment slot="acciones">
		{#if programa}
			<nav class="selector-vista" aria-label="Vista de la planeación">
				<!-- enlaceVista aplica resolve() a la ruta; los filtros van en la consulta. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#each VISTAS as v (v.valor)}
					<a
						class="opcion-vista"
						href={enlaceVista(v.valor, mesVista, semana)}
						aria-current={vista === v.valor ? 'page' : undefined}>{v.texto}</a
					>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</nav>
		{/if}
	</svelte:fragment>
</EncabezadoPagina>

{#if contratos.length === 0}
	<p class="view-note">
		No hay contratos. Regístrelos e importe su programa en el
		<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
	</p>
{:else}
	<form method="GET" class="filtros" aria-label="Programa y filtros">
		<div class="form-group">
			<label for="contrato">Contrato</label>
			<select id="contrato" name="contrato" on:change={enviarAlCambiar}>
				{#each contratos as c (c.id)}
					<option value={c.id} selected={c.id === contrato?.id}
						>{c.cliente?.nombre ?? ''} · {c.numero}</option
					>
				{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="sitio">Sitio</label>
			<select id="sitio" name="sitio" on:change={enviarAlCambiar}>
				{#each sitios as s (s.id)}
					<option value={s.id} selected={s.id === sitio?.id}>{s.clave} · {s.nombre}</option>
				{/each}
			</select>
		</div>
		{#if programas.length > 1}
			<div class="form-group">
				<label for="programa">Programa</label>
				<select id="programa" name="programa" on:change={enviarAlCambiar}>
					{#each programas as p (p.id)}
						<option value={p.id} selected={p.id === programa?.id}
							>{p.periodoInicio} a {p.periodoFin}</option
						>
					{/each}
				</select>
			</div>
		{/if}
		<div class="form-group">
			<label for="distribucion">Distribución</label>
			<select id="distribucion" name="distribucion" on:change={enviarAlCambiar}>
				<option value="">Todas</option>
				<option value="produccion" selected={filtro.distribucion === 'produccion'}
					>Producción</option
				>
				<option value="mantenimiento" selected={filtro.distribucion === 'mantenimiento'}
					>Mantenimiento</option
				>
			</select>
		</div>
		<div class="form-group">
			<label for="periodicidad">Periodicidad</label>
			<select id="periodicidad" name="periodicidad" on:change={enviarAlCambiar}>
				<option value="">Todas</option>
				{#each Object.entries(ETIQUETA_PERIODICIDAD) as [valor, etiqueta] (valor)}
					<option value={valor} selected={filtro.periodicidad === valor}>{etiqueta}</option>
				{/each}
			</select>
		</div>
		{#if vista !== 'anual'}<input type="hidden" name="vista" value={vista} />{/if}
		{#if vista !== 'anual' && mesVista}<input type="hidden" name="mes" value={mesVista} />{/if}
		<noscript><button class="boton" type="submit">Filtrar</button></noscript>
	</form>
{/if}

{#if contrato && sitio && !programa}
	<p class="aviso aviso-alerta">
		{sitio.clave}
		{sitio.nombre} no tiene programa anual. Impórtelo con el catálogo de Excel en el
		<a class="enlace" href={resolve('/catalogo/contratos/[id]', { id: contrato.id })}>contrato</a>.
	</p>
{/if}

{#if programa}
	{#if vencidos.length && vista === 'anual'}
		<details class="vencidos">
			<summary>
				<span class="texto-vencidos"
					><span aria-hidden="true">!</span>
					{plural(vencidos.length, 'vencimiento')} · {rangoDeMeses(
						vencidosPorMes[0].mes,
						vencidosPorMes[vencidosPorMes.length - 1].mes
					)}</span
				>
				<span class="ver-pendientes"
					>Ver pendientes <svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg
					></span
				>
			</summary>
			<div class="lista-vencidos-meses">
				{#each vencidosPorMes as grupo (grupo.mes)}
					<h3 class="mes-vencido">
						{textoMes(grupo.mes, { inicial: true })} ({grupo.pendientes.length})
					</h3>
					<ul class="lista-vencidos">
						{#each grupo.pendientes as v (v.partidaId)}
							<li>
								<span
									>Partida {v.numero}.- {textoOracion(v.actividad)}
									{v.faltan > 1 ? `(faltan ${v.faltan})` : ''}</span
								>
								<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									class="enlace"
									href={`${resolve('/captura')}?${consultaCaptura(v.partidaId, v.mes)}`}>Capturar</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
								<button
									type="button"
									class="action-btn edit"
									on:click={() => abrirVencido(v)}
									aria-label={`Reprogramar o marcar no ejecutada la partida ${v.numero} de ${textoMes(v.mes)}`}
									>Reprogramar o no ejecutado</button
								>
							</li>
						{/each}
					</ul>
				{/each}
			</div>
		</details>
	{/if}

	{#if vista === 'mensual' && mesVista}
		<section class="card" aria-labelledby="titulo-mensual">
			<h2 id="titulo-mensual" class="view-heading">Vista mensual</h2>
			<VistaMensual
				{partidas}
				mes={mesVista}
				{meses}
				{hoy}
				{consultaCaptura}
				enlaceMes={(mes) => enlaceVista('mensual', mes)}
				on:ajustar={(e) => abrirAjuste(e.detail.partida, e.detail.celda)}
			/>
		</section>
	{:else if vista === 'semanal' && mesVista}
		<section class="card" aria-labelledby="titulo-semanal">
			<h2 id="titulo-semanal" class="view-heading">Vista semanal</h2>
			<VistaSemanal
				{partidas}
				mes={mesVista}
				{meses}
				{semana}
				{hoy}
				ejecuciones={ejecucionesMes}
				enlaceSemana={(mes, numero) => enlaceVista('semanal', mes, numero)}
			/>
		</section>
	{:else}
		<div class="espacio-programa" class:con-panel={!!elegida}>
			<section class="matriz-programa" aria-labelledby="titulo-matriz">
				<div class="cabecera-matriz">
					<h2 id="titulo-matriz" class="titulo-matriz">
						{partidas.length} de {plural(totalPartidas, 'partida')} · Programado y realizado
					</h2>
					<p class="estado-seleccion" aria-live="polite">
						{elegida
							? `Selección: Partida ${elegida.partida.numero} / ${textoMes(elegida.celda.mes, { inicial: true, corto: true })}`
							: 'Elija una celda para ver sus acciones'}
					</p>
				</div>
				<div class="leyenda" aria-label="Leyenda de la matriz" role="group">
					<p class="clave-leyenda">
						P = programado · R = realizado · Cada celda separa cantidades, ejecución y documento.
					</p>
					<p>
						<span class="eje">Ejecución:</span>
						{#each LEYENDA_EJECUCION.slice(0, 4) as estado, i (estado)}{i ? ' · ' : ''}<span
								class="muestra {estado}"
								>{SIMBOLO_EJECUCION[estado]} {CODIGO_EJECUCION[estado]}</span
							>
							{ETIQUETA_EJECUCION[estado]}{/each}
					</p>
					<p>
						<span class="eje">Otros estados:</span>
						{#each LEYENDA_EJECUCION.slice(4) as estado, i (estado)}{i ? ' · ' : ''}<span
								class="muestra {estado}"
								>{SIMBOLO_EJECUCION[estado]} {CODIGO_EJECUCION[estado]}</span
							>
							{ETIQUETA_EJECUCION[estado]}{/each}
					</p>
					<p>
						<span class="eje">Documento:</span>
						{#each LEYENDA_DOCUMENTAL as marca, i (marca.codigo)}{i ? ' · ' : ''}<span
								class="muestra-doc">{marca.codigo}</span
							>
							{marca.texto}{/each}
					</p>
				</div>
				<div
					class="tabla-desplazable"
					bind:this={contenedorTabla}
					on:scroll={medirTabla}
					role="region"
					aria-labelledby="titulo-matriz"
					tabindex="-1"
				>
					<table class="matriz">
						<thead>
							<tr>
								<th scope="col" class="columna-partida">Partida / periodicidad</th>
								{#each meses as mes (mes)}
									<th
										scope="col"
										class="columna-mes"
										class:mes-actual={mes.slice(0, 7) === hoy.slice(0, 7)}
										>{textoMes(mes, { inicial: true, corto: true }).replace(
											/ \d{2}(\d{2})$/,
											' $1'
										)}</th
									>
								{/each}
								<th scope="col" class="columna-total">Total</th>
							</tr>
						</thead>
						<tbody>
							{#each partidas as p (p.id)}
								<tr class:fila-elegida={elegida?.partida.id === p.id}>
									<th scope="row" class="columna-partida">
										<span class="nombre-partida"
											><span class="numero">{p.numero}</span> {textoOracion(p.actividad)}</span
										>
										<span class="periodicidad">{ETIQUETA_PERIODICIDAD[p.periodicidad]}</span>
									</th>
									{#each p.celdas as celda (celda.mes)}
										{@const estado = estadoEjecucion(celda, hoy)}
										{@const documental = estadoDocumental(celda)}
										{@const elegidaAqui =
											elegida?.partida.id === p.id && elegida.celda.mes === celda.mes}
										<td class="celda {estado}" class:elegida={elegidaAqui}>
											{#if estado !== 'sin_programa' || celda.ajustes.length || celda.realizado > 0}
												<button
													id={`celda-${p.id}-${celda.mes}`}
													type="button"
													class="boton-celda"
													aria-pressed={elegidaAqui}
													title={ETIQUETA_EJECUCION[estado]}
													on:click={() => seleccionar(p, celda)}
												>
													<span class="sr-only">{nombreCelda(p, celda)}</span>
													<span class="contenido-celda" aria-hidden="true">
														<!-- R incluye reportes emitidos, marcas del Excel y realizados manuales. -->
														<span class="pr">P{celda.programado ?? 0} / R{celda.realizado}</span>
														{#if estado !== 'sin_programa'}
															<span class="ejecucion"
																><span class="simbolo">{SIMBOLO_EJECUCION[estado]}</span>
																{CODIGO_EJECUCION[estado]}</span
															>
														{/if}
														{#each anotacionesCelda(celda) as nota (nota)}<span class="anotacion"
																>{nota}</span
															>{/each}
														{#if celda.realizadoSinReporte > 0}<span class="anotacion"
																>{celda.realizadoSinReporte} sin reporte</span
															>{/if}
														{#if documental !== 'ninguno'}
															<span class="marca {documental}">{codigoDocumental(celda)}</span>
														{/if}
													</span>
												</button>
											{/if}
										</td>
									{/each}
									<td class="total">
										{p.totalRealizado} / {p.totalProgramado}
										{#if p.diferencia !== null && p.diferencia !== 0}
											<span
												class="status-badge por-confirmar"
												title="La suma de los meses no coincide con la cantidad anual"
												>Dif. {p.diferencia > 0 ? '+' : ''}{p.diferencia}</span
											>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if desborda}
					<div class="pie-matriz">
						<span>Partida fija · desplace la tabla para ver todos los meses.</span>
						<button class="enlace-accion" type="button" on:click={desplazarTabla}
							>{alFinal ? 'Ir al inicio del ciclo' : 'Ir al final del ciclo'}
							<svg
								class:invertida={alFinal}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg
							></button
						>
					</div>
				{/if}
			</section>

			{#if elegida}
				{@const { partida: p, celda } = elegida}
				{@const estado = estadoEjecucion(celda, hoy)}
				{@const falta = faltan(celda)}
				{@const borrador = celda.reportesAbiertos[0]}
				{@const notas = [...anotacionesCelda(celda), detalleCelda(celda, hoy)].filter(Boolean)}
				<aside class="panel-celda" aria-labelledby="titulo-panel" tabindex="-1" bind:this={panel}>
					<div class="cabecera-panel">
						<p class="ceja">
							Selección · Partida {p.numero} / {textoMes(celda.mes, { inicial: true })}
						</p>
						<button class="cerrar-panel" type="button" on:click={cerrarPanel}
							>Cerrar <svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg
							></button
						>
					</div>
					<h3 id="titulo-panel" class="titulo-panel">{textoOracion(p.actividad)}</h3>
					<dl class="datos-panel">
						<div>
							<dt>Programado</dt>
							<dd class="cifra grande">{celda.programado ?? 0}</dd>
						</div>
						<div>
							<dt>Realizado</dt>
							<dd class="cifra grande">{celda.realizado}</dd>
						</div>
						<div>
							<dt>Ejecución</dt>
							<dd>
								<span class="simbolo {estado}" aria-hidden="true">{SIMBOLO_EJECUCION[estado]}</span>
								{ETIQUETA_EJECUCION[estado]}
							</dd>
						</div>
						<div>
							<dt>Documento</dt>
							<dd>{textoDocumental(celda) || '—'}</dd>
						</div>
					</dl>
					{#if notas.length}<p class="nota-panel">{notas.join(' · ')}</p>{/if}
					<div class="acciones-panel">
						<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						{#if borrador}
							<a class="boton primario" href={resolve('/reportes/[id]', { id: borrador.id })}
								>Continuar reporte</a
							>
							<p class="nota-panel">
								Continuar abre el {borrador.estado === 'en_revision'
									? 'reporte en revisión'
									: 'borrador'}
								de {textoMes(celda.mes)}; no registra ejecución.
							</p>
						{:else if falta > 0}
							<a
								class="boton primario"
								href={`${resolve('/captura')}?${consultaCaptura(p.id, celda.mes, reprogramacionPendiente(celda))}`}
								aria-label={`Capturar partida ${p.numero} de ${textoMes(celda.mes)}`}
								>Capturar reporte</a
							>
						{/if}
						{#if celda.reportes.length}
							<a
								class="enlace"
								href={`${resolve('/historial')}?${consultaHistorial(p.id, celda.mes)}`}
								aria-label={`Ver ${plural(celda.reportes.length, 'reporte emitido', 'reportes emitidos')} de la partida ${p.numero} en ${textoMes(celda.mes)}`}
								>Ver {plural(celda.reportes.length, 'reporte emitido', 'reportes emitidos')}</a
							>
						{/if}
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{#if falta > 0 || celda.ajustes.length}
							<button
								type="button"
								class="boton contorno"
								aria-label={`Ajustes de la partida ${p.numero} en ${textoMes(celda.mes)}`}
								on:click={() => abrirAjuste(p, celda)}>Ajustar programa</button
							>
							<p class="nota-panel">Al ajustar: reprogramar o marcar no ejecutado.</p>
						{/if}
						<button
							class="enlace-accion"
							type="button"
							on:click={() => registrarExterno(p.id, celda.mes)}
							>Registrar realizado externo <svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg
							></button
						>
					</div>
				</aside>
			{/if}
		</div>
	{/if}

	<section class="registro-externo" aria-labelledby="titulo-manual">
		<details bind:open={registroAbierto}>
			<summary id="titulo-manual"
				>Registrar realizado externo <svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg
				></summary
			>
			<div class="card cuerpo-registro">
				<p class="view-note">
					Para trabajos documentados con un reporte anterior (por ejemplo, en Word). Cuenta en el
					realizado sin crear un reporte emitido.
				</p>
				<Aviso form={avisoGeneral} />
				<form method="POST" action="?/registrarRealizado" use:enhance class="form-grid">
					<input type="hidden" name="programaId" value={programa.id} />
					<div class="form-group">
						<label for="manual-partida">Partida</label>
						<select id="manual-partida" name="partidaId" required bind:value={manualPartida}>
							{#each partidas as p (p.id)}
								<option value={p.id}>{p.numero}.- {textoOracion(p.actividad)}</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="manual-mes">Mes</label>
						<select id="manual-mes" name="mes" required bind:value={manualMes}>
							{#each meses as mes (mes)}
								<option value={mes}>{textoMes(mes, { inicial: true })}</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="manual-cantidad">Cantidad</label>
						<input id="manual-cantidad" name="cantidad" type="number" min="1" step="1" value="1" />
					</div>
					<div class="form-group">
						<label for="manual-nota">Nota (obligatoria)</label>
						<input id="manual-nota" name="nota" required placeholder="Reporte Word de mayo" />
					</div>
					<div class="form-group acciones-formulario">
						<button class="boton primario" type="submit">Registrar</button>
					</div>
				</form>
			</div>
		</details>
		<p class="nota-registro">No crea un reporte emitido.</p>
	</section>

	{#if ajuste}
		<DialogoAjuste
			bind:this={dialogo}
			bind:abierto={dialogoAbierto}
			programaId={programa.id}
			partida={ajuste.partida}
			celda={ajuste.celda}
			{meses}
			{alEnviar}
			error={errorAjuste}
			on:cancelar={() => (errorAjuste = '')}
		/>
	{/if}
{/if}

<style>
	.filtros {
		display: grid;
		gap: 0 20px;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		margin-bottom: 8px;
	}
	@media (min-width: 1100px) {
		.filtros {
			grid-template-columns: 2fr 2fr repeat(auto-fit, minmax(150px, 1fr));
		}
	}
	/* Selector de vista como pestañas: la actual con fondo suave y subrayado en el acento. */
	.selector-vista {
		display: inline-flex;
	}
	.opcion-vista {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 4px 14px;
		color: var(--tinta-secundaria);
		transition: background-color 0.12s var(--curva-salida);
	}
	.opcion-vista + .opcion-vista {
		border-left: 1px solid var(--linea);
	}
	.opcion-vista:hover {
		background: var(--superficie-hover);
		color: var(--tinta);
	}
	.opcion-vista[aria-current='page'] {
		background: var(--accion-suave);
		color: var(--tinta);
		font-weight: 600;
		box-shadow: inset 0 -2px 0 var(--accion);
	}

	/* Vencimientos: una franja de alerta que despliega la lista por mes. */
	.vencidos {
		margin: 8px 0 28px;
		border-radius: var(--radio-panel);
		background: var(--alerta-fondo);
	}
	.vencidos summary {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: center;
		justify-content: space-between;
		min-height: 48px;
		padding: 10px 16px;
		list-style: none;
		cursor: pointer;
	}
	.vencidos summary::-webkit-details-marker {
		display: none;
	}
	.texto-vencidos {
		color: var(--alerta);
		font-weight: 600;
	}
	.ver-pendientes {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--accion);
		font-weight: 600;
	}
	.ver-pendientes svg {
		width: 15px;
		height: 15px;
		transition: transform 0.15s var(--curva-salida);
	}
	.vencidos[open] .ver-pendientes svg {
		transform: rotate(90deg);
	}
	.lista-vencidos-meses {
		padding: 0 16px 16px;
	}
	.mes-vencido {
		margin: 12px 0 6px;
		font-size: var(--texto-base);
	}
	.lista-vencidos {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 4px;
	}
	.lista-vencidos li > * + * {
		margin-left: 8px;
	}

	/* Espacio de programación: matriz y, con una celda elegida, el panel a la derecha. */
	.espacio-programa {
		display: grid;
		gap: 20px;
		align-items: start;
	}
	@media (min-width: 1100px) {
		.espacio-programa.con-panel {
			grid-template-columns: minmax(0, 1fr) 300px;
		}
	}
	.matriz-programa {
		min-width: 0;
	}
	.cabecera-matriz {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		align-items: baseline;
		justify-content: space-between;
	}
	.titulo-matriz {
		margin: 0;
		font-size: var(--texto-campo);
		font-weight: 400;
	}
	.estado-seleccion {
		margin: 0;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.leyenda {
		display: grid;
		gap: 4px;
		margin: 16px 0 20px;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.leyenda p {
		margin: 0;
	}
	.leyenda .clave-leyenda {
		color: var(--tinta);
		font-weight: 600;
	}
	.leyenda .eje {
		margin-right: 2px;
	}
	.muestra {
		font-weight: 600;
		white-space: nowrap;
	}
	.muestra-doc {
		font-weight: 600;
	}

	/* Matriz: una sola superficie comparativa; el color va en el texto del estado, no en la celda. */
	.matriz {
		border-collapse: separate;
		border-spacing: 0;
		font-size: var(--texto-xs);
		background: var(--superficie);
	}
	.matriz th,
	.matriz td {
		padding: 0;
		border-bottom: 1px solid var(--linea);
		vertical-align: middle;
	}
	.matriz thead th {
		height: 44px;
		padding: 0 8px;
		background: var(--superficie-alta);
		border-bottom-color: var(--linea-fuerte);
		color: var(--tinta);
		font-size: var(--texto-base);
		text-align: center;
	}
	.matriz thead th.columna-partida {
		padding-left: 12px;
		font-size: var(--texto-xs);
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-align: left;
	}
	/* Mes en curso: fondo de selección y texto en el acento. */
	.matriz thead th.mes-actual {
		background: var(--accion-suave);
		color: var(--accion);
	}
	.columna-partida {
		position: sticky;
		left: 0;
		z-index: 1;
		min-width: 240px;
		max-width: 300px;
		background: var(--superficie);
		text-align: left;
		font-weight: 400;
	}
	tbody .columna-partida {
		padding: 14px 12px;
		box-shadow: inset -1px 0 0 var(--linea);
	}
	.nombre-partida {
		display: block;
		font-size: var(--texto-base);
		line-height: 1.4;
	}
	.numero {
		margin-right: 4px;
	}
	.periodicidad {
		display: block;
		margin-top: 4px;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.columna-mes {
		min-width: 84px;
	}
	.matriz tbody tr:hover > td,
	.matriz tbody tr:hover > th {
		background: var(--superficie);
	}
	.matriz tbody tr.fila-elegida > td,
	.matriz tbody tr.fila-elegida > th {
		background: var(--accion-suave);
	}
	.celda {
		text-align: center;
	}
	/* «relative» contiene el nombre .sr-only de la celda dentro del botón. */
	.boton-celda {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		min-height: 92px;
		padding: 8px 4px;
		border: 2px solid transparent;
		background: none;
		color: var(--tinta);
		font-size: var(--texto-xs);
		cursor: pointer;
	}
	.boton-celda:hover {
		background: var(--superficie-hover);
	}
	.boton-celda:focus-visible {
		outline-offset: -4px;
	}
	.celda.elegida .boton-celda {
		border-color: var(--accion);
		background: var(--superficie);
	}
	.contenido-celda {
		display: grid;
		gap: 4px;
		justify-items: center;
	}
	.pr {
		white-space: nowrap;
	}
	.ejecucion {
		font-size: var(--texto-base);
		font-weight: 600;
		white-space: nowrap;
	}
	.anotacion {
		white-space: nowrap;
		font-weight: 600;
		color: var(--tinta-secundaria);
	}
	.marca {
		color: var(--tinta-tenue);
		white-space: nowrap;
	}
	.marca.reporte_en_borrador {
		color: var(--accion);
		font-weight: 700;
	}
	/* Colores de ejecución: siempre acompañan al símbolo y al código. */
	.ejecutado .ejecucion,
	.extra .ejecucion,
	.muestra.ejecutado,
	.muestra.extra,
	.simbolo.ejecutado,
	.simbolo.extra {
		color: var(--exito);
	}
	.vencido .ejecucion,
	.reprogramado .ejecucion,
	.muestra.vencido,
	.muestra.reprogramado,
	.simbolo.vencido,
	.simbolo.reprogramado {
		color: var(--alerta);
	}
	.no_ejecutado .ejecucion,
	.muestra.no_ejecutado,
	.simbolo.no_ejecutado {
		color: var(--peligro);
	}
	.pendiente .ejecucion,
	.muestra.pendiente,
	.simbolo.pendiente {
		color: var(--accion);
	}
	.programado .ejecucion,
	.muestra.programado,
	.simbolo.programado {
		color: var(--tinta-secundaria);
	}
	.total {
		padding: 0 12px;
		white-space: nowrap;
		text-align: center;
	}
	.columna-total {
		min-width: 72px;
	}
	.pie-matriz {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: center;
		justify-content: space-between;
		padding: 10px 0;
		border-bottom: 3px solid var(--linea);
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.enlace-accion {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: var(--objetivo-min);
		padding: 0;
		border: 0;
		background: none;
		color: var(--accion);
		font-size: var(--texto-base);
		font-weight: 600;
		cursor: pointer;
	}
	.enlace-accion:hover {
		color: var(--accion-hover);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.enlace-accion svg {
		width: 15px;
		height: 15px;
	}
	.enlace-accion svg.invertida {
		transform: rotate(180deg);
	}

	/* Panel de la celda elegida: datos y acciones cerca de la selección. */
	.panel-celda {
		display: grid;
		gap: 16px;
		padding: 22px;
		border-radius: var(--radio-panel);
		background: var(--accion-suave);
	}
	@media (min-width: 1100px) {
		.panel-celda {
			position: sticky;
			top: 0;
		}
	}
	.cabecera-panel {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		justify-content: space-between;
	}
	.cerrar-panel {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 4px;
		min-height: var(--objetivo-min);
		margin-top: -6px;
		padding: 0 4px;
		border: 0;
		border-radius: var(--radio-control);
		background: none;
		color: var(--accion);
		font-weight: 600;
		cursor: pointer;
	}
	.cerrar-panel:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.cerrar-panel svg {
		width: 14px;
		height: 14px;
	}
	.titulo-panel {
		margin: 0;
		font-size: var(--texto-lg);
		font-weight: 400;
		line-height: 1.35;
	}
	.datos-panel {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px 16px;
		margin: 0;
	}
	.datos-panel dt {
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.datos-panel dd {
		margin: 2px 0 0;
		font-size: var(--texto-campo);
	}
	.datos-panel dd.grande {
		font-size: var(--texto-xl);
		line-height: 1.2;
	}
	.acciones-panel {
		display: grid;
		gap: 10px;
		justify-items: start;
	}
	.nota-panel {
		margin: 0;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}

	/* Registro externo al pie: enlace que despliega el formulario. */
	.registro-externo {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		align-items: flex-start;
		justify-content: space-between;
		margin-top: 28px;
	}
	.registro-externo details {
		flex: 1 1 100%;
		order: 1;
	}
	.registro-externo details[open] {
		order: 0;
	}
	.registro-externo summary {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: var(--objetivo-min);
		color: var(--accion);
		font-weight: 600;
		list-style: none;
	}
	.registro-externo summary::-webkit-details-marker {
		display: none;
	}
	.registro-externo summary svg {
		width: 15px;
		height: 15px;
	}
	.registro-externo details[open] summary svg {
		transform: rotate(90deg);
	}
	.registro-externo details:not([open]) {
		flex: 0 1 auto;
		order: 0;
	}
	.cuerpo-registro {
		margin: 12px 0 0;
	}
	.nota-registro {
		margin: 8px 0 0;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
</style>
