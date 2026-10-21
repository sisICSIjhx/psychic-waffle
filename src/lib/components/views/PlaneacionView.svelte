<!-- Programa anual: lo programado (P) y realizado (R) de cada partida por mes, con pendientes
     vencidos y acceso a la captura desde una celda pendiente. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ETIQUETA_PERIODICIDAD, partesMes } from '$lib/dominio/captura';
	import { MESES } from '$lib/dominio/documento';
	import type { AvancePrograma, Contrato, Programa, Sitio } from '$lib/dominio/esquemas';
	import {
		estadoCelda,
		type EstadoCelda,
		type FiltroPlaneacion,
		type PendienteVencido
	} from '$lib/dominio/planeacion';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';

	export let hoy = '';
	export let contratos: Contrato[] = [];
	export let contrato: Contrato | null = null;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let programas: Programa[] = [];
	export let programa: Programa | null = null;
	export let meses: string[] = [];
	export let partidas: AvancePrograma['partidas'] = [];
	export let totalPartidas = 0;
	export let vencidos: PendienteVencido[] = [];
	export let filtro: FiltroPlaneacion = {};
	export let form: { mensaje?: string; error?: string } | null = null;

	const ESTADO: Record<EstadoCelda, string> = {
		sin_programa: '',
		cumplido: 'Cumplido',
		pendiente: 'Pendiente',
		vencido: 'Vencido',
		extra: 'Realizado sin programar'
	};
	// El estado de cada celda se lee por símbolo y texto, además del color.
	const SIMBOLO: Record<EstadoCelda, string> = {
		sin_programa: '',
		cumplido: '✓',
		pendiente: '●',
		vencido: '!',
		extra: '+'
	};
	const LEYENDA: EstadoCelda[] = ['cumplido', 'pendiente', 'vencido', 'extra'];

	const textoMes = (mes: string, corto = false) => {
		const { anio, mes: numero } = partesMes(mes);
		const nombre = MESES[numero - 1];
		return corto ? `${nombre.slice(0, 3)} ${String(anio).slice(2)}` : `${nombre} ${anio}`;
	};

	/** Consulta de una captura nueva con contrato, sitio, partida y mes ya elegidos. */
	const consultaCaptura = (partidaId: string, mes: string) =>
		`contrato=${contrato?.id}&sitio=${sitio?.id}&partida=${partidaId}&mes=${mes}`;

	/** Consulta de los reportes emitidos de la partida en el mes. */
	const consultaHistorial = (partidaId: string, mes: string) =>
		`contrato=${contrato?.id}&sitio=${sitio?.id}&partida=${partidaId}&desde=${mes.slice(0, 7)}&hasta=${mes.slice(0, 7)}&estado=emitido`;

	$: vencidosPorMes = [...new Set(vencidos.map((v) => v.mes))].map((mes) => ({
		mes,
		pendientes: vencidos.filter((v) => v.mes === mes)
	}));

	function enviarAlCambiar(evento: Event) {
		(evento.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
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
			<noscript><button class="boton" type="submit">Filtrar</button></noscript>
		</form>
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
	{#if vencidos.length}
		<section class="card">
			<!-- Con muchos vencidos el panel inicia cerrado para no ocultar la matriz. -->
			<details open={vencidos.length <= 10}>
				<summary class="view-heading">Pendientes vencidos ({vencidos.length})</summary>
				{#each vencidosPorMes as grupo (grupo.mes)}
					<h3 class="mes-vencido">{textoMes(grupo.mes)} ({grupo.pendientes.length})</h3>
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
							</li>
						{/each}
					</ul>
				{/each}
			</details>
		</section>
	{/if}

	<section class="card" aria-labelledby="titulo-matriz">
		<h2 id="titulo-matriz" class="view-heading">
			Programado (P) y realizado (R) · {textoMes(programa.periodoInicio)} a {textoMes(
				programa.periodoFin
			)}
		</h2>
		<p class="view-note">
			{partidas.length} de {totalPartidas} partidas. Elija una celda pendiente para capturar su reporte.
		</p>
		<ul class="leyenda" aria-label="Leyenda de la matriz">
			{#each LEYENDA as estado (estado)}
				<li>
					<span class="simbolo muestra {estado}" aria-hidden="true">{SIMBOLO[estado]}</span>
					{ESTADO[estado]}
				</li>
			{/each}
		</ul>
		<div class="tabla-desplazable">
			<table class="matriz">
				<thead>
					<tr>
						<th scope="col" class="columna-partida">Partida</th>
						{#each meses as mes (mes)}
							<th scope="col" class:mes-actual={mes.slice(0, 7) === hoy.slice(0, 7)}
								>{textoMes(mes, true)}</th
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
								{@const estado = estadoCelda(celda, hoy)}
								<td class="celda {estado}" title={ESTADO[estado]}>
									{#if estado !== 'sin_programa'}
										<span class="simbolo" aria-hidden="true">{SIMBOLO[estado]}</span>
										<span class="sr-only">{ESTADO[estado]}:</span>
										<span class="pr">P {celda.programado ?? '—'}</span>
										<!-- R incluye reportes emitidos, marcas del Excel y realizados manuales;
										     el enlace lleva solo a los reportes emitidos. -->
										<span class="pr">R {celda.realizado}</span>
										{#if celda.reportes.length}
											<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
											<!-- eslint-disable svelte/no-navigation-without-resolve -->
											<a
												class="reportes-celda"
												href={`${resolve('/historial')}?${consultaHistorial(p.id, celda.mes)}`}
												aria-label={`Ver ${celda.reportes.length} reporte(s) emitido(s) de la partida ${p.numero} en ${textoMes(celda.mes)}`}
												>{celda.reportes.length} rep.</a
											>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
										{/if}
										{#if celda.realizadoSinReporte > 0}
											<span
												class="view-note"
												title="Marcas del Excel o realizados registrados a mano"
												>{celda.realizadoSinReporte} sin reporte</span
											>
										{/if}
										{#if estado === 'pendiente' || estado === 'vencido'}
											<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
											<!-- eslint-disable svelte/no-navigation-without-resolve -->
											<a
												class="capturar"
												href={`${resolve('/captura')}?${consultaCaptura(p.id, celda.mes)}`}
												aria-label={`Capturar partida ${p.numero} de ${textoMes(celda.mes)}`}
												>Capturar</a
											>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
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

	<section class="card" aria-labelledby="titulo-manual">
		<details>
			<summary id="titulo-manual" class="view-heading"
				>Registrar un realizado hecho fuera del sistema</summary
			>
			<p class="view-note">
				Para trabajos documentados con un reporte anterior (por ejemplo, en Word). Cuenta en el
				realizado sin crear un reporte emitido.
			</p>
			<Aviso {form} />
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
								>{textoMes(mes)}</option
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
	.leyenda {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		list-style: none;
		margin: 8px 0 12px;
		padding: 0;
		font-size: 0.85rem;
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
	.cumplido {
		background: color-mix(in srgb, var(--success) 16%, transparent);
	}
	.vencido {
		background: color-mix(in srgb, var(--danger) 18%, transparent);
	}
	.pendiente {
		background: color-mix(in srgb, var(--warning) 16%, transparent);
	}
	.extra {
		background: color-mix(in srgb, var(--primary) 14%, transparent);
	}
	/* Sobre el fondo de color el texto atenuado no alcanza 4.5:1. */
	.celda .view-note {
		color: inherit;
	}
	.capturar {
		font-size: 0.75rem;
	}
	.total {
		white-space: nowrap;
		text-align: center;
	}
</style>
