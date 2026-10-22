<!-- Selección guiada para crear un reporte: contrato y sitio (resumidos si ya están resueltos),
     1. partida con búsqueda y agrupada por el trabajo pendiente, 2. periodo y TAG, 3. crear. Avisa si ya
     existe un reporte de la misma partida y periodo, sin impedir crear otro. -->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import InsigniaEstado from '$lib/components/reportes/InsigniaEstado.svelte';
	import SelectorBusqueda, {
		type OpcionSelector
	} from '$lib/components/ui/SelectorBusqueda.svelte';
	import {
		ETIQUETA_OCURRENCIA,
		ETIQUETA_PERIODICIDAD,
		ocurrenciasDelMes
	} from '$lib/dominio/captura';
	import type { Ocurrencia } from '$lib/dominio/documento';
	import type {
		Cliente,
		Contrato,
		Partida,
		PartidaResumen,
		ReporteResumen,
		Sitio
	} from '$lib/dominio/esquemas';
	import {
		buscarPartidas,
		ETIQUETA_GRUPO,
		type GrupoPartida,
		type ReporteDePartida,
		type TrabajoDePartida
	} from '$lib/dominio/seleccion';
	import { textoMes } from '$lib/dominio/textos';

	export let cliente: Cliente | null = null;
	export let contratos: Contrato[] = [];
	export let contrato: Contrato | null = null;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let partidas: PartidaResumen[] = [];
	export let partida: Partida | null = null;
	export let tipoOcurrencia: Ocurrencia['tipo'] | null = null;
	export let meses: string[] = [];
	export let mesReferencia = '';
	export let mesSugerido: string | null = null;
	/** Trabajo pendiente de cada partida del sitio, por su id. */
	export let trabajo: Record<string, TrabajoDePartida> = {};
	/** Reportes vigentes de la partida elegida. */
	export let reportesPartida: ReporteDePartida[] = [];
	export let borradores: ReporteResumen[] = [];
	export let form: { error?: string; observaciones?: { campo: string; mensaje: string }[] } | null =
		null;

	const ORDEN_GRUPOS: GrupoPartida[] = ['con_borrador', 'pendientes', 'otras'];

	let periodoMes = mesSugerido ?? '';
	let ocurrenciaNumero = '';
	let enviando = false;
	let cambiarContexto = false;
	let partidaElegida = partida?.id ?? '';
	let formSeleccion: HTMLFormElement | undefined;

	$: if (!meses.includes(periodoMes)) periodoMes = mesSugerido ?? '';
	$: ocurrencias =
		tipoOcurrencia && periodoMes ? ocurrenciasDelMes(tipoOcurrencia, periodoMes) : [];
	$: if (ocurrencias.length && !ocurrencias.includes(Number(ocurrenciaNumero)))
		ocurrenciaNumero = String(ocurrencias[0]);
	// Contrato y sitio ya resueltos (uno solo de cada uno, o elegidos en la dirección) se muestran como
	// resumen; «Cambiar» abre las listas.
	$: contextoResuelto = !!contrato && !!sitio && !cambiarContexto;
	$: opciones = partidas
		.map((p) => opcionDe(p, trabajo[p.id]))
		.sort((a, b) => urgencia(a.valor) - urgencia(b.valor));
	$: soloOtras = opciones.every((o) => o.grupo === 'otras');
	$: grupos = ORDEN_GRUPOS.map((clave) => ({
		clave,
		titulo: soloOtras ? 'Partidas' : ETIQUETA_GRUPO[clave]
	}));
	$: existentes = reportesPartida.filter(
		(r) =>
			r.periodoMes.slice(0, 7) === periodoMes.slice(0, 7) &&
			(tipoOcurrencia ? r.ocurrencia?.numero === Number(ocurrenciaNumero) : !r.ocurrencia)
	);

	/** Estado pendiente de la partida en texto: el vencido más antiguo o el mes de referencia. */
	function estadoPendiente(
		t: TrabajoDePartida | undefined
	): { icono: string; texto: string } | null {
		if (!t) return null;
		if (t.vencidos.length) return { icono: '!', texto: `Vencida · ${textoMes(t.vencidos[0])}` };
		if (t.estadoMes === 'vencido')
			return { icono: '!', texto: `Vencida · ${textoMes(mesReferencia)}` };
		if (t.estadoMes === 'pendiente') {
			return { icono: '●', texto: `Pendiente · ${textoMes(mesReferencia)}` };
		}
		return null;
	}

	function opcionDe(p: PartidaResumen, t: TrabajoDePartida | undefined): OpcionSelector {
		const estado = estadoPendiente(t);
		const conBorrador = t?.grupo === 'con_borrador';
		return {
			valor: p.id,
			texto: `${p.numero}.- ${p.actividad}`,
			grupo: t?.grupo ?? 'otras',
			icono: conBorrador ? '✎' : estado?.icono,
			insignia: conBorrador ? `${estado ? `${estado.texto} · ` : ''}con borrador` : estado?.texto,
			detalle: `${ETIQUETA_PERIODICIDAD[p.periodicidad]}${p.estadoCatalogo === 'por_confirmar' ? ' · por confirmar' : ''}`
		};
	}

	/** Dentro de cada grupo, primero las que tienen vencidos (el más antiguo antes). */
	function urgencia(id: string): number {
		const vencido = trabajo[id]?.vencidos[0];
		return vencido ? Number(vencido.slice(0, 7).replace('-', '')) : 999999;
	}

	/** Al buscar se usa el orden de la búsqueda (el número exacto primero); sin consulta, el agrupado. */
	function filtrarPartidas(lista: OpcionSelector[], consulta: string): OpcionSelector[] {
		if (!consulta.trim()) return lista;
		return buscarPartidas(partidas, consulta)
			.map((p) => lista.find((o) => o.valor === p.id))
			.filter((o): o is OpcionSelector => !!o);
	}

	async function elegirPartida(evento: CustomEvent<string>) {
		partidaElegida = evento.detail;
		await tick();
		formSeleccion?.requestSubmit();
	}

	function enviarAlCambiar(evento: Event) {
		(evento.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
</script>

<section class="card" aria-labelledby="titulo-captura">
	<h2 id="titulo-captura" class="view-heading">
		Nuevo reporte{cliente ? ` · ${cliente.nombre}` : ''}
	</h2>

	{#if contratos.length === 0}
		<p class="view-note">
			{cliente ? `${cliente.nombre} no tiene contratos vigentes.` : 'No hay contratos vigentes.'} Regístrelos
			en el
			<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
		</p>
	{:else}
		<!-- Los pasos son parámetros de la URL: cada cambio recarga las opciones del siguiente. -->
		<form method="GET" class="seleccion" bind:this={formSeleccion}>
			{#if cliente}<input type="hidden" name="cliente" value={cliente.clave} />{/if}
			{#if contextoResuelto && contrato && sitio}
				<div class="contexto-resumen">
					<span class="etiqueta">Contrato y sitio</span>
					<span class="valor-contexto"
						>{contrato.cliente?.nombre ?? ''} · {contrato.numero} · {sitio.clave}
						{sitio.nombre}</span
					>
					<button class="boton" type="button" on:click={() => (cambiarContexto = true)}
						>Cambiar</button
					>
					<input type="hidden" name="contrato" value={contrato.id} />
					<input type="hidden" name="sitio" value={sitio.id} />
				</div>
			{:else}
				<div class="contexto-listas">
					<div class="form-group">
						<label for="contrato">Contrato</label>
						<select id="contrato" name="contrato" on:change={enviarAlCambiar}>
							{#if !contrato}<option value="">Elija el contrato</option>{/if}
							{#each contratos as c (c.id)}
								<option value={c.id} selected={c.id === contrato?.id}
									>{c.cliente?.nombre ?? ''} · {c.numero}</option
								>
							{/each}
						</select>
					</div>
					{#if contrato}
						<div class="form-group">
							<label for="sitio">Sitio</label>
							<select id="sitio" name="sitio" on:change={enviarAlCambiar}>
								{#if !sitio}<option value="">Elija el sitio</option>{/if}
								{#each sitios as s (s.id)}
									<option value={s.id} selected={s.id === sitio?.id}>{s.clave} {s.nombre}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>
			{/if}
			<input type="hidden" name="partida" value={partidaElegida} />

			{#if sitio}
				<div class="paso">
					<h3 class="titulo-paso"><span class="numero-paso">1</span> Partida</h3>
					{#if partidas.length}
						<SelectorBusqueda
							id="buscar-partida"
							etiqueta="Busque por número o actividad"
							placeholder="Ej.: 7 o potenciales"
							{opciones}
							{grupos}
							valor={partida?.id ?? null}
							filtrar={filtrarPartidas}
							on:elegir={elegirPartida}
						/>
					{:else}
						<p class="view-note">El sitio no tiene partidas en el catálogo.</p>
					{/if}
				</div>
			{/if}
			<noscript><button class="boton" type="submit">Continuar</button></noscript>
		</form>

		{#if partida}
			{#if partida.estadoCatalogo === 'por_confirmar'}
				<p class="aviso aviso-alerta" role="status">
					Esta partida se derivó de reportes anteriores y está por confirmar en el catálogo.
				</p>
			{/if}
			<form
				method="POST"
				action="?/crear"
				use:enhance={() => {
					enviando = true;
					return async ({ update }) => {
						await update();
						enviando = false;
					};
				}}
			>
				<input type="hidden" name="partidaId" value={partida.id} />
				{#if tipoOcurrencia}<input
						type="hidden"
						name="ocurrenciaTipo"
						value={tipoOcurrencia}
					/>{/if}
				<div class="paso">
					<h3 class="titulo-paso"><span class="numero-paso">2</span> Periodo y TAG</h3>
					<div class="form-grid">
						<div class="form-group">
							<label for="periodoMes">Mes del reporte</label>
							<select id="periodoMes" name="periodoMes" bind:value={periodoMes} required>
								{#each meses as mes (mes)}
									<option value={mes}>{textoMes(mes, { inicial: true })}</option>
								{/each}
							</select>
						</div>
						{#if tipoOcurrencia}
							<div class="form-group">
								<label for="ocurrenciaNumero">{ETIQUETA_OCURRENCIA[tipoOcurrencia]}</label>
								<select
									id="ocurrenciaNumero"
									name="ocurrenciaNumero"
									bind:value={ocurrenciaNumero}
									required
								>
									{#each ocurrencias as numero (numero)}
										<option value={String(numero)}
											>{ETIQUETA_OCURRENCIA[tipoOcurrencia]} {numero}</option
										>
									{/each}
								</select>
							</div>
						{/if}
					</div>
					{#if partida.equipos.length}
						<fieldset class="casillas">
							<legend>TAG del reporte (uno o varios)</legend>
							{#each partida.equipos as equipo (equipo.id)}
								<label>
									<input
										type="checkbox"
										name="equipoIds"
										value={equipo.id}
										checked={partida.equipos.length === 1}
									/>
									{equipo.tag}
								</label>
							{/each}
						</fieldset>
					{/if}
					{#if existentes.length}
						<div class="aviso aviso-alerta existentes" role="status">
							<p>
								<strong
									>{existentes.some((r) => r.estado === 'borrador')
										? 'Ya existe un borrador de esta partida y periodo.'
										: 'Ya existe un reporte de esta partida y periodo.'}</strong
								>
								Puede crear otro, por ejemplo para otro TAG.
							</p>
							<ul>
								{#each existentes as existente (existente.id)}
									<li>
										<InsigniaEstado estado={existente.estado} />
										<span>{existente.tags ? `TAG ${existente.tags}` : 'Sin TAG'}</span>
										<a class="enlace" href={resolve('/reportes/[id]', { id: existente.id })}
											>{existente.estado === 'borrador'
												? 'Continuar el borrador'
												: 'Abrir el reporte'}</a
										>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
				<div class="paso">
					<h3 class="titulo-paso"><span class="numero-paso">3</span> Crear el reporte</h3>
					<button class="boton primario" type="submit" disabled={enviando}>
						{enviando ? 'Creando…' : 'Crear reporte'}
					</button>
				</div>
			</form>
			{#if form?.error}
				<div class="aviso aviso-error" role="alert">
					<p>No se pudo crear el reporte.</p>
					<ul>
						{#each form.observaciones?.length ? form.observaciones : [{ campo: 'error', mensaje: form.error }] as o (o.campo + o.mensaje)}
							<li>{o.mensaje}</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	{/if}
</section>

{#if borradores.length}
	<section class="card" aria-labelledby="titulo-borradores">
		<h2 id="titulo-borradores" class="view-heading">Borradores recientes</h2>
		<ul class="lista-simple">
			{#each borradores as b (b.id)}
				<li>
					<a class="enlace" href={resolve('/reportes/[id]', { id: b.id })}>{b.titulo}</a>
					<span class="view-note">· {b.sitioTexto}{b.tags ? ` · ${b.tags}` : ''}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.seleccion {
		display: grid;
		gap: 16px;
		margin-bottom: 16px;
	}
	.contexto-resumen {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		align-items: center;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
	}
	.contexto-resumen .etiqueta {
		flex-basis: 100%;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.valor-contexto {
		flex: 1 1 240px;
		font-weight: 600;
	}
	.contexto-listas {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
	}
	.paso {
		display: grid;
		gap: 10px;
		margin-bottom: 16px;
	}
	.titulo-paso {
		display: flex;
		gap: 8px;
		align-items: center;
		margin: 0;
		font-size: 1rem;
	}
	.numero-paso {
		display: inline-grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--primary);
		color: var(--on-primary);
		font-size: 0.85rem;
		font-weight: 700;
	}
	.existentes ul {
		display: grid;
		gap: 6px;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}
	.existentes li {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.lista-simple {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 6px;
	}
</style>
