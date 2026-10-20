<!-- Selección guiada para crear un reporte: contrato, sitio, partida, TAG y periodo. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		ETIQUETA_OCURRENCIA,
		ETIQUETA_PERIODICIDAD,
		ocurrenciasDelMes,
		partesMes
	} from '$lib/dominio/captura';
	import { MESES, type Ocurrencia } from '$lib/dominio/documento';
	import type {
		Cliente,
		Contrato,
		Partida,
		PartidaResumen,
		ReporteResumen,
		Sitio
	} from '$lib/dominio/esquemas';

	export let cliente: Cliente | null = null;
	export let contratos: Contrato[] = [];
	export let contrato: Contrato | null = null;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let partidas: PartidaResumen[] = [];
	export let partida: Partida | null = null;
	export let tipoOcurrencia: Ocurrencia['tipo'] | null = null;
	export let meses: string[] = [];
	export let mesSugerido: string | null = null;
	export let borradores: ReporteResumen[] = [];
	export let form: { error?: string; observaciones?: { campo: string; mensaje: string }[] } | null =
		null;

	let periodoMes = mesSugerido ?? '';
	let enviando = false;
	$: if (!meses.includes(periodoMes)) periodoMes = mesSugerido ?? '';
	$: ocurrencias =
		tipoOcurrencia && periodoMes ? ocurrenciasDelMes(tipoOcurrencia, periodoMes) : [];

	const textoMes = (mes: string) => {
		const { anio, mes: numero } = partesMes(mes);
		return `${MESES[numero - 1]} ${anio}`;
	};

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
		<form method="GET" class="pasos-seleccion">
			{#if cliente}<input type="hidden" name="cliente" value={cliente.clave} />{/if}
			<div class="form-group">
				<label for="contrato">1. Contrato</label>
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
					<label for="sitio">2. Sitio</label>
					<select id="sitio" name="sitio" on:change={enviarAlCambiar}>
						{#if !sitio}<option value="">Elija el sitio</option>{/if}
						{#each sitios as s (s.id)}
							<option value={s.id} selected={s.id === sitio?.id}>{s.clave} {s.nombre}</option>
						{/each}
					</select>
				</div>
			{/if}
			{#if sitio}
				<div class="form-group">
					<label for="partida">3. Partida</label>
					<select id="partida" name="partida" on:change={enviarAlCambiar}>
						{#if !partida}<option value="">Elija la partida</option>{/if}
						{#each partidas as p (p.id)}
							<option value={p.id} selected={p.id === partida?.id}
								>{p.numero}.- {p.actividad} ({ETIQUETA_PERIODICIDAD[
									p.periodicidad
								]}){p.estadoCatalogo === 'por_confirmar' ? ' · por confirmar' : ''}</option
							>
						{/each}
					</select>
				</div>
			{/if}
			<noscript><button class="boton" type="submit">Continuar</button></noscript>
		</form>

		{#if sitio && partidas.length === 0}
			<p class="view-note">El sitio no tiene partidas en el catálogo.</p>
		{/if}

		{#if partida}
			{#if partida.estadoCatalogo === 'por_confirmar'}
				<p class="aviso aviso-alerta" role="status">
					Esta partida se derivó de reportes anteriores y está por confirmar en el catálogo.
				</p>
			{/if}
			<form
				method="POST"
				action="?/crear"
				class="form-grid"
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
				<div class="form-group">
					<label for="periodoMes">4. Mes del reporte</label>
					<select id="periodoMes" name="periodoMes" bind:value={periodoMes} required>
						{#each meses as mes (mes)}
							<option value={mes}>{textoMes(mes)}</option>
						{/each}
					</select>
				</div>
				{#if tipoOcurrencia}
					<div class="form-group">
						<label for="ocurrenciaNumero">{ETIQUETA_OCURRENCIA[tipoOcurrencia]}</label>
						<select id="ocurrenciaNumero" name="ocurrenciaNumero" required>
							{#each ocurrencias as numero (numero)}
								<option value={numero}>{ETIQUETA_OCURRENCIA[tipoOcurrencia]} {numero}</option>
							{/each}
						</select>
					</div>
				{/if}
				{#if partida.equipos.length}
					<fieldset class="form-group casillas">
						<legend>5. TAG del reporte (uno o varios)</legend>
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
				<div class="form-group acciones-formulario">
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
	.pasos-seleccion {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		margin-bottom: 12px;
	}
	.lista-simple {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 6px;
	}
</style>
