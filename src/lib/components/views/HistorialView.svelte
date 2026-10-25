<!-- Historial global de reportes: filtros, paginación, apertura y descarga del documento. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import InsigniaEstado from '$lib/components/reportes/InsigniaEstado.svelte';
	import { ETIQUETA_ESTADO_REPORTE } from '$lib/dominio/captura';
	import { textoMes } from '$lib/dominio/textos';
	import type {
		Cliente,
		Contrato,
		PaginaReportes,
		PartidaResumen,
		Sitio
	} from '$lib/dominio/esquemas';

	export let clientes: Cliente[] = [];
	export let contratos: Contrato[] = [];
	export let sitios: Sitio[] = [];
	export let partidas: PartidaResumen[] = [];
	export let seleccion = {
		cliente: '',
		contrato: '',
		sitio: '',
		partida: '',
		tag: '',
		estado: '',
		desde: '',
		hasta: ''
	};
	export let resultado: PaginaReportes = { total: 0, pagina: 1, tamano: 20, filas: [] };

	const OCURRENCIA = { semana: 'S', quincena: 'Q', dia: 'D' } as const;

	$: paginas = Math.max(1, Math.ceil(resultado.total / resultado.tamano));
	$: desdeFila = resultado.total ? (resultado.pagina - 1) * resultado.tamano + 1 : 0;
	$: hastaFila = Math.min(resultado.pagina * resultado.tamano, resultado.total);

	const periodo = (fila: PaginaReportes['filas'][number]) => {
		const base = textoMes(fila.periodoMes, { inicial: true, corto: true });
		return fila.ocurrencia
			? `${base} · ${OCURRENCIA[fila.ocurrencia.tipo]}${fila.ocurrencia.numero}`
			: base;
	};

	/** Consulta de la página `n` conservando los filtros. */
	const consultaPagina = (n: number) =>
		[...Object.entries(seleccion).filter(([, valor]) => valor), ['pagina', String(n)]]
			.map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`)
			.join('&');

	function enviarAlCambiar(evento: Event) {
		(evento.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
</script>

<section class="card" aria-labelledby="titulo-historial">
	<h2 id="titulo-historial" class="view-heading">Reportes registrados</h2>
	<form method="GET" class="filtros">
		<div class="form-group">
			<label for="cliente">Cliente</label>
			<select id="cliente" name="cliente" on:change={enviarAlCambiar}>
				<option value="">Todos</option>
				{#each clientes as c (c.id)}
					<option value={c.clave} selected={c.clave === seleccion.cliente}>{c.nombre}</option>
				{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="contrato">Contrato</label>
			<select id="contrato" name="contrato" on:change={enviarAlCambiar}>
				<option value="">Todos</option>
				{#each contratos as c (c.id)}
					<option value={c.id} selected={c.id === seleccion.contrato}
						>{c.cliente?.nombre ?? ''} · {c.numero}</option
					>
				{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="sitio">Sitio</label>
			<select id="sitio" name="sitio" on:change={enviarAlCambiar} disabled={!seleccion.contrato}>
				<option value="">Todos</option>
				{#each sitios as s (s.id)}
					<option value={s.id} selected={s.id === seleccion.sitio}>{s.clave} {s.nombre}</option>
				{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="partida">Partida</label>
			<select id="partida" name="partida" on:change={enviarAlCambiar} disabled={!seleccion.sitio}>
				<option value="">Todas</option>
				{#each partidas as p (p.id)}
					<option value={p.id} selected={p.id === seleccion.partida}
						>{p.numero}.- {p.actividad}</option
					>
				{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="tag">TAG</label>
			<input id="tag" name="tag" value={seleccion.tag} placeholder="PSV-2001" />
		</div>
		<div class="form-group">
			<label for="estado">Estado</label>
			<select id="estado" name="estado" on:change={enviarAlCambiar}>
				<option value="">Todos</option>
				{#each Object.entries(ETIQUETA_ESTADO_REPORTE) as [valor, etiqueta] (valor)}
					<option value={valor} selected={valor === seleccion.estado}>{etiqueta}</option>
				{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="desde">Desde (mes)</label>
			<input id="desde" name="desde" type="month" value={seleccion.desde} />
		</div>
		<div class="form-group">
			<label for="hasta">Hasta (mes)</label>
			<input id="hasta" name="hasta" type="month" value={seleccion.hasta} />
		</div>
		<div class="form-group acciones-formulario">
			<button class="boton primario" type="submit">Buscar</button>
			<a class="boton" href={resolve('/historial')}>Limpiar</a>
		</div>
	</form>
</section>

<section class="card" aria-labelledby="titulo-resultados">
	<h2 id="titulo-resultados" class="view-heading">
		{resultado.total === 0 || resultado.filas.length === 0
			? 'Sin reportes con estos filtros'
			: `${desdeFila} a ${hastaFila} de ${resultado.total} reportes`}
	</h2>
	{#if resultado.filas.length}
		<div class="tabla-desplazable">
			<table>
				<thead>
					<tr>
						<th>Reporte</th>
						<th>Sitio</th>
						<th>TAG</th>
						<th>Periodo</th>
						<th>Estado</th>
						<th><span class="sr-only">Acciones</span></th>
					</tr>
				</thead>
				<tbody>
					{#each resultado.filas as fila (fila.id)}
						<tr>
							<td>
								<a class="enlace" href={resolve('/reportes/[id]', { id: fila.id })}>{fila.titulo}</a
								>
								<span class="view-note">{fila.usuario} · {fila.contratoTexto}</span>
							</td>
							<td>{fila.sitioTexto}</td>
							<td>{fila.tags ?? '—'}</td>
							<td>{periodo(fila)}</td>
							<td>
								<InsigniaEstado estado={fila.estado} />
								{#if fila.revision > 0}<span class="view-note">Rev. {fila.revision}</span>{/if}
							</td>
							<td class="acciones-fila">
								<a class="enlace" href={resolve('/reportes/[id]', { id: fila.id })}>Abrir</a>
								{#if fila.documento || fila.estado === 'emitido'}
									<a
										class="enlace"
										href={resolve('/reportes/[id]/documento', { id: fila.id })}
										title={fila.documento?.nombreArchivo ?? 'Generar y descargar el DOCX'}
										>Descargar</a
									>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<!-- La paginación se muestra aunque la página quede vacía (p. ej. tras emitir borradores). -->
	{#if paginas > 1 || resultado.pagina > 1}
		<nav class="paginacion" aria-label="Páginas del historial">
			{#if resultado.pagina > 1}
				<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a class="boton" href={`${resolve('/historial')}?${consultaPagina(resultado.pagina - 1)}`}
					>Anterior</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
			<span>Página {resultado.pagina} de {paginas}</span>
			{#if resultado.pagina < paginas}
				<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a class="boton" href={`${resolve('/historial')}?${consultaPagina(resultado.pagina + 1)}`}
					>Siguiente</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</nav>
	{/if}
</section>

<style>
	.filtros {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}
	td .view-note {
		display: block;
	}
	.paginacion {
		display: flex;
		gap: 12px;
		align-items: center;
		justify-content: flex-end;
		margin-top: 12px;
	}
</style>
