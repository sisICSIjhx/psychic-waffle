<!-- Catálogo de equipos de un proyecto (cliente), con las columnas del Excel «Catálogo de equipos»:
     indicadores de calibración, búsqueda y filtros, tabla, importación del Excel por sitio y
     exportación a CSV. El alta y la edición van a /equipos/[id]. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		ESTADOS_EQUIPO,
		type Cliente,
		type EquipoCatalogo,
		type EstadoEquipo,
		type ResultadoImportacionEquipos,
		type Sitio
	} from '$lib/dominio/esquemas';
	import {
		csvEquipos,
		estadoCalibracion,
		ETIQUETAS_CALIBRACION,
		ETIQUETAS_ESTADO_EQUIPO,
		filtrarEquipos,
		indicadoresEquipos,
		marcaModelo,
		proximaCalibracion,
		textoFechaCorta,
		textoIntervalo,
		type EstadoCalibracion
	} from '$lib/dominio/equipos';
	import { plural } from '$lib/dominio/textos';
	import BotonesSegmentados from '$lib/components/ui/BotonesSegmentados.svelte';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';

	export let clientes: Cliente[] = [];
	export let proyecto: Cliente | null = null;
	export let equipos: EquipoCatalogo[] = [];
	export let sitios: Sitio[] = [];
	export let hoy: string;
	export let puedeEditar = true;
	export let form: {
		accion?: string;
		mensaje?: string;
		error?: string;
		ensayo?: boolean;
		archivo?: string;
		hoja?: string;
		sitio?: string;
		leidos?: number;
		resultado?: ResultadoImportacionEquipos;
		avisos?: string[];
	} | null = null;

	const CLASE_ESTADO: Record<EstadoEquipo, string> = {
		en_servicio: 'ok',
		fuera_de_servicio: 'err',
		fuera_de_operacion: 'warn',
		baja: ''
	};
	const CLASE_CALIBRACION: Record<EstadoCalibracion, string> = {
		vencida: 'err',
		por_vencer: 'warn',
		vigente: 'ok',
		sin_fecha: ''
	};

	let busqueda = '';
	let sitioId = '';
	let estado: EstadoEquipo | '' = '';
	let calibracion: EstadoCalibracion | '' = '';
	let soloCriticos = false;
	let importacionAbierta = form?.accion === 'importar';
	let sitioImportacion = sitios[0]?.id ?? '';

	$: opciones = clientes.map((c) => ({ valor: c.clave, texto: c.nombre }));
	$: indicadores = indicadoresEquipos(equipos, hoy);
	$: visibles = filtrarEquipos(
		equipos,
		{
			texto: busqueda,
			sitioId: sitioId || null,
			estado: estado || null,
			calibracion: calibracion || null,
			soloCriticos
		},
		hoy
	);
	$: variosSitios = sitios.length > 1;
	$: hayFiltros = !!(busqueda || sitioId || estado || calibracion || soloCriticos);
	$: if (!sitios.some((s) => s.id === sitioImportacion)) sitioImportacion = sitios[0]?.id ?? '';

	function cambiarProyecto(evento: CustomEvent<string>) {
		limpiarFiltros();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() ya aplicado; el proyecto va en la consulta.
		goto(`${resolve('/equipos')}?proyecto=${encodeURIComponent(evento.detail)}`, {
			keepFocus: true,
			noScroll: true
		});
	}

	function limpiarFiltros() {
		busqueda = '';
		sitioId = '';
		estado = '';
		calibracion = '';
		soloCriticos = false;
	}

	/** Los indicadores filtran la tabla; pulsar el activo lo quita. */
	function filtrarPorCalibracion(valor: EstadoCalibracion) {
		calibracion = calibracion === valor ? '' : valor;
		if (calibracion && estado === 'baja') estado = '';
	}

	function exportarCsv() {
		const url = URL.createObjectURL(
			new Blob([csvEquipos(visibles)], { type: 'text/csv;charset=utf-8' })
		);
		const enlace = document.createElement('a');
		enlace.href = url;
		enlace.download = `catalogo-equipos-${proyecto?.clave ?? 'proyecto'}-${hoy}.csv`;
		enlace.click();
		URL.revokeObjectURL(url);
	}

	// Revisar e importar comparten el archivo elegido: el formulario no se limpia.
	const conservarArchivo: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });

	$: enlaceNuevo = proyecto
		? `${resolve('/equipos/[id]', { id: 'nuevo' })}?proyecto=${encodeURIComponent(proyecto.clave)}`
		: resolve('/equipos/[id]', { id: 'nuevo' });
</script>

{#if !proyecto}
	<section class="card">
		<p class="view-note">
			Aún no hay proyectos. Registre primero un cliente en el
			<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
		</p>
	</section>
{:else}
	<section class="card" aria-labelledby="titulo-proyecto-equipos">
		<h2 id="titulo-proyecto-equipos" class="view-heading">Proyecto</h2>
		<BotonesSegmentados
			id="proyecto-equipos"
			etiqueta="Proyecto"
			{opciones}
			valor={proyecto.clave}
			on:change={cambiarProyecto}
		/>
		<p class="view-note">
			Equipos e instrumentos de los sitios de los contratos de {proyecto.nombre}. Son los mismos TAG
			que se eligen en las partidas y los reportes.
		</p>
	</section>

	{#if form?.accion !== 'importar'}<Aviso {form} />{/if}

	{#if sitios.length === 0}
		<section class="card">
			<p class="view-note">
				{proyecto.nombre} aún no tiene sitios. Agréguelos desde un contrato del
				<a class="enlace" href={resolve('/catalogo')}>catálogo</a> para registrar sus equipos.
			</p>
		</section>
	{:else}
		<section class="indicadores" aria-label="Indicadores del catálogo">
			<div class="indicador">
				<span class="etiqueta-indicador">Equipos</span>
				<span class="cifra">{indicadores.total}</span>
				{#if indicadores.bajas}<span class="nota-indicador"
						>{plural(indicadores.bajas, 'dado de baja', 'dados de baja')}</span
					>{/if}
			</div>
			<div class="indicador">
				<span class="etiqueta-indicador">En servicio</span>
				<span class="cifra">{indicadores.enServicio}</span>
			</div>
			<button
				type="button"
				class="indicador interactivo"
				aria-pressed={soloCriticos}
				on:click={() => (soloCriticos = !soloCriticos)}
			>
				<span class="etiqueta-indicador">Críticos</span>
				<span class="cifra">{indicadores.criticos}</span>
			</button>
			<button
				type="button"
				class="indicador interactivo e-vencida"
				aria-pressed={calibracion === 'vencida'}
				on:click={() => filtrarPorCalibracion('vencida')}
			>
				<span class="etiqueta-indicador">Calibración vencida</span>
				<span class="cifra">{indicadores.vencidas}</span>
			</button>
			<button
				type="button"
				class="indicador interactivo e-por-vencer"
				aria-pressed={calibracion === 'por_vencer'}
				on:click={() => filtrarPorCalibracion('por_vencer')}
			>
				<span class="etiqueta-indicador">Por vencer (30 días)</span>
				<span class="cifra">{indicadores.porVencer}</span>
			</button>
		</section>

		{#if puedeEditar}
			<div class="toolbar">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() ya aplicado; el proyecto va en la consulta. -->
				<a class="boton primario" href={enlaceNuevo}>Agregar equipo</a>
				<button
					type="button"
					class="boton"
					aria-expanded={importacionAbierta}
					aria-controls="importar-equipos"
					on:click={() => (importacionAbierta = !importacionAbierta)}>Importar Excel</button
				>
				<button type="button" class="boton" on:click={exportarCsv} disabled={!visibles.length}
					>Exportar CSV</button
				>
			</div>
		{:else}
			<div class="toolbar">
				<button type="button" class="boton" on:click={exportarCsv} disabled={!visibles.length}
					>Exportar CSV</button
				>
			</div>
		{/if}

		{#if puedeEditar && importacionAbierta}
			<section id="importar-equipos" class="card" aria-labelledby="titulo-importar-equipos">
				<h2 id="titulo-importar-equipos" class="view-heading">Importar el catálogo desde Excel</h2>
				<p class="view-note separado-abajo">
					El archivo debe tener los encabezados del catálogo («Equipo ID», «Nombre», «Marca/Modelo»,
					«Estado», «Intervalo», «Última» y «Próxima calibración», etc.). Los equipos con el mismo
					TAG y nombre en el sitio se actualizan; los demás se agregan. «Revisar» no cambia nada.
				</p>
				<form
					method="POST"
					action="?/importar"
					enctype="multipart/form-data"
					use:enhance={conservarArchivo}
				>
					<input type="hidden" name="clienteId" value={proyecto.id} />
					<div class="form-grid">
						<div class="form-group">
							<label for="importar-sitio">Sitio</label>
							<select id="importar-sitio" name="sitioId" bind:value={sitioImportacion} required>
								{#each sitios as sitio (sitio.id)}
									<option value={sitio.id}
										>{sitio.clave}{sitio.nombre ? ` · ${sitio.nombre}` : ''}</option
									>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label for="importar-archivo">Archivo (.xlsx)</label>
							<input
								id="importar-archivo"
								name="archivo"
								type="file"
								accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
								required
							/>
						</div>
					</div>
					<div class="acciones">
						<button class="boton" type="submit" name="modo" value="revisar">Revisar</button>
						<button class="boton primario" type="submit" name="modo" value="importar"
							>Importar</button
						>
					</div>
				</form>

				{#if form?.accion === 'importar'}
					<div class="resumen-importacion" role="status">
						<Aviso {form} />
						{#if form.resultado}
							<h3>
								{form.ensayo ? 'Revisión' : 'Resultado'} de «{form.archivo}» en {form.sitio}
							</h3>
							<p>
								{plural(form.leidos ?? 0, 'equipo leído', 'equipos leídos')} de la hoja «{form.hoja}»:
								<span class="status-badge accion-crear"
									>{plural(form.resultado.nuevos, 'nuevo')}</span
								>
								<span class="status-badge accion-actualizar"
									>{form.resultado.actualizados}
									{form.ensayo ? 'se actualizarían' : 'actualizados'}</span
								>
							</p>
							{#if form.ensayo}
								<p class="view-note">
									Nada ha cambiado todavía. Si el resumen es correcto, pulse «Importar».
								</p>
							{/if}
						{/if}
						{#if form.resultado?.repetidas.length || form.avisos?.length}
							<ul class="lista-advertencias">
								{#each form.resultado?.repetidas ?? [] as repetida (repetida.fila)}
									<li>
										Fila {repetida.fila} ({repetida.tag}): repite el TAG y el nombre de otra fila;
										se omitió.
									</li>
								{/each}
								{#each form.avisos ?? [] as aviso (aviso)}<li>{aviso}</li>{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		<section class="card" aria-labelledby="titulo-lista-equipos">
			<h2 id="titulo-lista-equipos" class="view-heading">
				{hayFiltros
					? `${visibles.length} de ${plural(equipos.length, 'equipo')}`
					: plural(equipos.length, 'equipo')}
			</h2>

			<div class="filtros">
				<div class="form-group buscar">
					<label for="buscar-equipo">Buscar</label>
					<input
						id="buscar-equipo"
						type="search"
						bind:value={busqueda}
						placeholder="TAG, nombre, marca, serie o ubicación"
						autocomplete="off"
					/>
				</div>
				{#if variosSitios}
					<div class="form-group">
						<label for="filtro-sitio">Sitio</label>
						<select id="filtro-sitio" bind:value={sitioId}>
							<option value="">Todos</option>
							{#each sitios as sitio (sitio.id)}<option value={sitio.id}>{sitio.clave}</option
								>{/each}
						</select>
					</div>
				{/if}
				<div class="form-group">
					<label for="filtro-estado">Estado</label>
					<select id="filtro-estado" bind:value={estado}>
						<option value="">Todos</option>
						{#each ESTADOS_EQUIPO as valor (valor)}<option value={valor}
								>{ETIQUETAS_ESTADO_EQUIPO[valor]}</option
							>{/each}
					</select>
				</div>
				<div class="form-group">
					<label for="filtro-calibracion">Calibración</label>
					<select id="filtro-calibracion" bind:value={calibracion}>
						<option value="">Todas</option>
						{#each Object.entries(ETIQUETAS_CALIBRACION) as [valor, etiqueta] (valor)}<option
								value={valor}>{etiqueta}</option
							>{/each}
					</select>
				</div>
				<label class="casilla-sola criticos">
					<input type="checkbox" bind:checked={soloCriticos} />
					Solo críticos
				</label>
				{#if hayFiltros}
					<button type="button" class="boton fantasma compacto" on:click={limpiarFiltros}
						>Quitar filtros</button
					>
				{/if}
			</div>

			{#if equipos.length === 0}
				<p class="view-note">
					{proyecto.nombre} aún no tiene equipos registrados.
					{puedeEditar ? 'Use «Agregar equipo» o «Importar Excel».' : ''}
				</p>
			{:else if visibles.length === 0}
				<p class="view-note">Ningún equipo coincide con los filtros.</p>
			{:else}
				<div class="tabla-desplazable">
					<table class="tabla-equipos">
						<thead>
							<tr>
								<th class="fija">Equipo ID</th>
								<th>Nombre</th>
								{#if variosSitios}<th>Sitio</th>{/if}
								<th>Marca / modelo</th>
								<th>No. de serie</th>
								<th>Rango</th>
								<th>Resolución</th>
								<th>Clase / tolerancia</th>
								<th>Ubicación</th>
								<th>Propietario</th>
								<th>Responsable</th>
								<th>Crítico</th>
								<th>Estado</th>
								<th>Intervalo</th>
								<th>Última calibración</th>
								<th>Próxima calibración</th>
								<th>Proveedor</th>
								<th>Notas</th>
							</tr>
						</thead>
						<tbody>
							{#each visibles as equipo (equipo.id)}
								{@const proxima = proximaCalibracion(equipo)}
								{@const estadoCal = estadoCalibracion(equipo, hoy)}
								<tr class:baja={equipo.estado === 'baja'}>
									<th class="fija" scope="row">
										<a class="enlace" href={resolve('/equipos/[id]', { id: equipo.id })}
											>{equipo.tag}</a
										>
									</th>
									<td class="ancho">{equipo.tipo ?? ''}</td>
									{#if variosSitios}<td>{equipo.sitio.clave}</td>{/if}
									<td class="ancho">{marcaModelo(equipo)}</td>
									<td>{equipo.numeroSerie ?? ''}</td>
									<td>{equipo.rango ?? ''}</td>
									<td>{equipo.resolucion ?? ''}</td>
									<td>{equipo.clase ?? ''}</td>
									<td>{equipo.ubicacion ?? ''}</td>
									<td>{equipo.propietario ?? ''}</td>
									<td>{equipo.responsable ?? ''}</td>
									<td>
										{#if equipo.critico}<span class="status-badge warn">Crítico</span>{/if}
									</td>
									<td>
										<span class="status-badge {CLASE_ESTADO[equipo.estado]}"
											>{ETIQUETAS_ESTADO_EQUIPO[equipo.estado]}</span
										>
									</td>
									<td>{textoIntervalo(equipo.intervaloMeses)}</td>
									<td>{textoFechaCorta(equipo.ultimaCalibracion)}</td>
									<td>
										<span class="proxima">
											{#if proxima.fecha}
												<span
													title={proxima.calculada ? 'Calculada: última + intervalo' : undefined}
													>{textoFechaCorta(proxima.fecha)}{proxima.calculada ? '*' : ''}</span
												>
											{/if}
											{#if estadoCal !== 'sin_fecha'}
												<span class="status-badge {CLASE_CALIBRACION[estadoCal]}"
													>{ETIQUETAS_CALIBRACION[estadoCal]}</span
												>
											{/if}
										</span>
									</td>
									<td>{equipo.proveedor ?? ''}</td>
									<td class="notas" title={equipo.notas ?? undefined}>{equipo.notas ?? ''}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="view-note pie">
					* Próxima calibración calculada con la última y el intervalo, porque no se capturó.
				</p>
			{/if}
		</section>
	{/if}
{/if}

<style>
	.indicadores {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 12px;
		margin-bottom: 16px;
	}
	.indicador {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 18px 20px;
		border: 1px solid var(--borde-panel);
		border-radius: var(--radio-panel);
		background: var(--superficie);
		box-shadow: var(--sombra-panel);
		color: var(--tinta);
		font: inherit;
		text-align: left;
	}
	/* Punto de color antes de la etiqueta, como las leyendas de los kits. */
	.etiqueta-indicador::before {
		content: '';
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-right: 8px;
		border-radius: 50%;
		background: var(--punto-indicador, var(--ficha-azul-icono));
		vertical-align: 1px;
	}
	.indicador.interactivo {
		cursor: pointer;
	}
	.indicador.interactivo:hover {
		background: var(--superficie-hover);
	}
	.indicador[aria-pressed='true'] {
		border-color: var(--accion);
		box-shadow: inset 0 0 0 1px var(--accion);
	}
	.indicador.e-vencida {
		--punto-indicador: var(--peligro);
		box-shadow:
			inset 4px 0 0 var(--peligro),
			var(--sombra-panel);
	}
	.indicador.e-por-vencer {
		--punto-indicador: var(--alerta);
		box-shadow:
			inset 4px 0 0 var(--alerta),
			var(--sombra-panel);
	}
	.etiqueta-indicador {
		color: var(--tinta-secundaria);
		font-size: var(--texto-sm);
		font-weight: 600;
	}
	.cifra {
		font-size: 1.75rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.nota-indicador {
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.separado-abajo {
		margin-bottom: 16px;
	}
	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.filtros {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0 16px;
	}
	.filtros .buscar {
		flex: 1 1 260px;
	}
	.filtros .criticos {
		margin-bottom: 16px;
		min-height: var(--alto-control);
	}
	.filtros .boton {
		margin-bottom: 16px;
	}
	.tabla-equipos {
		font-size: var(--texto-sm);
	}
	.tabla-equipos td,
	.tabla-equipos th {
		white-space: nowrap;
	}
	.tabla-equipos .ancho {
		min-width: 180px;
		white-space: normal;
	}
	.tabla-equipos .notas {
		max-width: 280px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tabla-equipos .proxima {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	/* El TAG queda a la vista al desplazar la tabla a la derecha. */
	.tabla-equipos .fija {
		position: sticky;
		left: 0;
		z-index: 1;
		background: var(--superficie);
	}
	.tabla-equipos thead .fija {
		background: var(--superficie-alta);
	}
	.tabla-equipos tbody tr:hover > .fija {
		background: var(--superficie-alta);
	}
	.tabla-equipos tr.baja td,
	.tabla-equipos tr.baja th {
		color: var(--tinta-tenue);
	}
	.pie {
		margin-top: 12px;
	}
</style>
