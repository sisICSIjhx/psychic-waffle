<!-- Programa anual: lo programado (P) y realizado (R) de cada partida por mes con su estado de
     ejecución y documental, ajustes (reprogramar y no ejecutado), pendientes vencidos y acceso a la
     captura. Vista anual por omisión, mensual y semanal. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import {
		anotacionesCelda,
		detalleCelda,
		ejecutado,
		ETIQUETA_DOCUMENTAL,
		ETIQUETA_EJECUCION,
		estadoDocumental,
		estadoEjecucion,
		faltan,
		marcaDocumental,
		SIMBOLO_EJECUCION,
		textoDocumental,
		type EjecucionDelMes,
		type EstadoDocumental,
		type EstadoEjecucion
	} from '$lib/dominio/cumplimiento';
	import { plural, textoMes } from '$lib/dominio/textos';
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
	const LEYENDA_DOCUMENTAL: Exclude<EstadoDocumental, 'ninguno'>[] = [
		'con_reporte',
		'reporte_en_borrador',
		'sin_reporte'
	];
	const MARCA_LEYENDA: Record<Exclude<EstadoDocumental, 'ninguno'>, string> = {
		con_reporte: 'Con rep.',
		reporte_en_borrador: 'Borrador / En rev.',
		sin_reporte: 'Sin rep.'
	};
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
</script>

<section class="card" aria-labelledby="titulo-planeacion">
	<h2 id="titulo-planeacion" class="view-heading">Programa anual de mantenimiento</h2>
	{#if contratos.length === 0}
		<p class="view-note">
			No hay contratos. Regístrelos e importe su programa en el
			<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
		</p>
	{:else}
		<form method="GET" class="filtros">
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
						<option value={s.id} selected={s.id === sitio?.id}>{s.clave} {s.nombre}</option>
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
	{/if}
</section>

{#if contrato && sitio && !programa}
	<p class="aviso aviso-alerta">
		{sitio.clave}
		{sitio.nombre} no tiene programa anual. Impórtelo con el catálogo de Excel en el
		<a class="enlace" href={resolve('/catalogo/contratos/[id]', { id: contrato.id })}>contrato</a>.
	</p>
{/if}

{#if programa}
	{#if vencidos.length && vista === 'anual'}
		<section class="card">
			<!-- Con muchos vencidos el panel inicia cerrado para no ocultar la matriz. -->
			<details open={vencidos.length <= 10}>
				<summary class="view-heading">Pendientes vencidos ({vencidos.length})</summary>
				{#each vencidosPorMes as grupo (grupo.mes)}
					<h3 class="mes-vencido">
						{textoMes(grupo.mes, { inicial: true })} ({grupo.pendientes.length})
					</h3>
					<ul class="lista-vencidos">
						{#each grupo.pendientes as v (v.partidaId)}
							<li>
								Partida {v.numero}.- {v.actividad}
								{v.faltan > 1 ? `(faltan ${v.faltan})` : ''}
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
			</details>
		</section>
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
		<section class="card" aria-labelledby="titulo-matriz">
			<h2 id="titulo-matriz" class="view-heading">
				Programado (P) y realizado (R) · {textoMes(programa.periodoInicio)} a {textoMes(
					programa.periodoFin
				)}
			</h2>
			<p class="view-note">
				{partidas.length} de {totalPartidas} partidas. Elija una celda con algo pendiente para capturar
				su reporte o ajustarla.
			</p>
			<div class="leyenda" aria-label="Leyenda de la matriz" role="group">
				<p class="eje">Ejecución:</p>
				<ul>
					{#each LEYENDA_EJECUCION as estado (estado)}
						<li>
							<span class="simbolo muestra {estado}" aria-hidden="true"
								>{SIMBOLO_EJECUCION[estado]}</span
							>
							{ETIQUETA_EJECUCION[estado]}
						</li>
					{/each}
				</ul>
				<p class="eje">Documental:</p>
				<ul>
					{#each LEYENDA_DOCUMENTAL as estado (estado)}
						<li>
							<span class="marca {estado}" aria-hidden="true">{MARCA_LEYENDA[estado]}</span>
							{ETIQUETA_DOCUMENTAL[estado]}{estado === 'con_reporte' ? ' (estado final)' : ''}
						</li>
					{/each}
				</ul>
			</div>
			<div class="tabla-desplazable">
				<table class="matriz">
					<thead>
						<tr>
							<th scope="col" class="columna-partida">Partida</th>
							{#each meses as mes (mes)}
								<th scope="col" class:mes-actual={mes.slice(0, 7) === hoy.slice(0, 7)}
									>{textoMes(mes, { inicial: true, corto: true })}</th
								>
							{/each}
							<th scope="col">Total</th>
						</tr>
					</thead>
					<tbody>
						{#each partidas as p (p.id)}
							<tr>
								<th scope="row" class="columna-partida">
									<span class="numero">{p.numero}</span>
									{p.actividad}
									<span class="view-note">{ETIQUETA_PERIODICIDAD[p.periodicidad]}</span>
								</th>
								{#each p.celdas as celda (celda.mes)}
									{@const estado = estadoEjecucion(celda, hoy)}
									{@const documental = estadoDocumental(celda)}
									{@const falta = faltan(celda)}
									<td class="celda {estado}" title={ETIQUETA_EJECUCION[estado]}>
										{#if estado !== 'sin_programa' || celda.ajustes.length}
											<span class="sr-only">{nombreCelda(p, celda)}</span>
											<span aria-hidden="true">
												<span class="estado-corto"
													><span class="simbolo">{SIMBOLO_EJECUCION[estado]}</span>
													{ETIQUETA_EJECUCION[estado]}</span
												>
												<span class="pr">P {celda.programado ?? '—'}</span>
												{#each anotacionesCelda(celda) as nota (nota)}<span class="anotacion"
														>{nota}</span
													>{/each}
												<!-- R incluye reportes emitidos, marcas del Excel y realizados manuales. -->
												<span class="pr">R {celda.realizado}</span>
												{#if celda.realizadoSinReporte > 0}<span
														class="anotacion"
														title="Marcas del Excel o realizados registrados a mano"
														>{celda.realizadoSinReporte} sin reporte</span
													>{/if}
												{#if documental !== 'ninguno'}
													<span class="marca {documental}">{marcaDocumental(celda)}</span>
												{/if}
											</span>
											{#if celda.reportes.length}
												<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
												<!-- eslint-disable svelte/no-navigation-without-resolve -->
												<a
													class="reportes-celda"
													href={`${resolve('/historial')}?${consultaHistorial(p.id, celda.mes)}`}
													aria-label={`Ver ${plural(celda.reportes.length, 'reporte emitido', 'reportes emitidos')} de la partida ${p.numero} en ${textoMes(celda.mes)}`}
													>{celda.reportes.length} rep.</a
												>
												<!-- eslint-enable svelte/no-navigation-without-resolve -->
											{/if}
											{#if falta > 0}
												<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
												<!-- eslint-disable svelte/no-navigation-without-resolve -->
												<a
													class="capturar"
													href={`${resolve('/captura')}?${consultaCaptura(p.id, celda.mes, reprogramacionPendiente(celda))}`}
													aria-label={`Capturar partida ${p.numero} de ${textoMes(celda.mes)}`}
													>Capturar</a
												>
												<!-- eslint-enable svelte/no-navigation-without-resolve -->
											{/if}
											{#if falta > 0 || celda.ajustes.length}
												<button
													type="button"
													class="ajustar"
													aria-label={`Ajustes de la partida ${p.numero} en ${textoMes(celda.mes)}`}
													title="Reprogramar o marcar no ejecutado"
													on:click={() => abrirAjuste(p, celda)}>⋯</button
												>
											{/if}
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
		</section>
	{/if}

	<section class="card" aria-labelledby="titulo-manual">
		<details>
			<summary id="titulo-manual" class="view-heading"
				>Registrar un realizado hecho fuera del sistema</summary
			>
			<p class="view-note">
				Para trabajos documentados con un reporte anterior (por ejemplo, en Word). Cuenta en el
				realizado sin crear un reporte emitido.
			</p>
			<Aviso form={avisoGeneral} />
			<form method="POST" action="?/registrarRealizado" use:enhance class="form-grid">
				<input type="hidden" name="programaId" value={programa.id} />
				<div class="form-group">
					<label for="manual-partida">Partida</label>
					<select id="manual-partida" name="partidaId" required>
						{#each partidas as p (p.id)}
							<option value={p.id}>{p.numero}.- {p.actividad}</option>
						{/each}
					</select>
				</div>
				<div class="form-group">
					<label for="manual-mes">Mes</label>
					<select id="manual-mes" name="mes" required>
						{#each meses as mes (mes)}
							<option value={mes} selected={mes.slice(0, 7) === hoy.slice(0, 7)}
								>{textoMes(mes, { inicial: true })}</option
							>
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
		</details>
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
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}
	.mes-vencido {
		margin: 12px 0 4px;
		font-size: 0.9rem;
	}
	.lista-vencidos {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 4px;
	}
	.matriz {
		font-size: 0.82rem;
		border-collapse: collapse;
	}
	.matriz th,
	.matriz td {
		border: 1px solid var(--border);
		padding: 4px 6px;
		vertical-align: top;
	}
	/* Meses y periodicidad en formato de oración, no en las mayúsculas de los encabezados. */
	.matriz th {
		text-transform: none;
		letter-spacing: normal;
	}
	.columna-partida {
		position: sticky;
		left: 0;
		z-index: 1;
		background: var(--card-bg, var(--bg));
		min-width: 220px;
		max-width: 320px;
		text-align: left;
		font-weight: 400;
	}
	.numero {
		font-weight: 700;
		margin-right: 4px;
	}
	.mes-actual {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}
	.selector-vista {
		display: inline-flex;
		margin-top: 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}
	.opcion-vista {
		display: inline-flex;
		align-items: center;
		min-height: var(--objetivo-min);
		padding: 4px 14px;
		color: var(--text);
		text-decoration: none;
	}
	.opcion-vista + .opcion-vista {
		border-left: 1px solid var(--border);
	}
	.opcion-vista[aria-current='page'] {
		background: var(--primary);
		color: var(--on-primary);
		font-weight: 600;
	}
	.leyenda {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 6px 12px;
		align-items: center;
		margin: 8px 0 12px;
		font-size: 0.85rem;
	}
	.leyenda .eje {
		margin: 0;
		font-weight: 600;
	}
	.leyenda ul {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.leyenda li {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.muestra {
		display: inline-grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.simbolo {
		font-weight: 700;
	}
	.celda {
		min-width: 64px;
		text-align: center;
	}
	.pr {
		display: block;
		white-space: nowrap;
	}
	.estado-corto {
		display: block;
		white-space: nowrap;
		font-size: 0.78rem;
	}
	.anotacion {
		display: block;
		white-space: nowrap;
		font-size: 0.75rem;
		font-weight: 600;
	}
	/* Colores de ejecución: siempre acompañan al símbolo y al texto. */
	.ejecutado {
		background: color-mix(in srgb, var(--success) 16%, transparent);
	}
	.vencido,
	.no_ejecutado {
		background: color-mix(in srgb, var(--danger) 18%, transparent);
	}
	.pendiente,
	.extra {
		background: color-mix(in srgb, var(--primary) 14%, transparent);
	}
	.reprogramado {
		background: color-mix(in srgb, var(--warning) 18%, transparent);
	}
	/* Marca documental: borde y texto, sin depender del fondo de la celda. */
	.marca {
		display: inline-block;
		margin-top: 2px;
		padding: 0 4px;
		border: 1px solid currentColor;
		border-radius: 4px;
		font-size: 0.72rem;
		white-space: nowrap;
	}
	.marca.con_reporte {
		font-weight: 700;
	}
	.marca.sin_reporte {
		border-style: dashed;
	}
	.ajustar {
		min-width: 28px;
		min-height: 24px;
		margin-left: 2px;
		padding: 0 4px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}
	/* Sobre el fondo de color el texto atenuado no alcanza 4.5:1. */
	.celda .view-note {
		color: inherit;
	}
	.capturar,
	.reportes-celda {
		display: inline-flex;
		align-items: center;
		min-height: 24px;
		padding: 0 4px;
		font-size: 0.8rem;
		text-decoration: underline;
	}
	.total {
		white-space: nowrap;
		text-align: center;
	}
</style>
