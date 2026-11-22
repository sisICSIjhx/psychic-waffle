<!-- Tablero de estatus: una tarjeta por centro de costo, del más atrasado al más al corriente, con el
     mes de corte, el filtro por estatus (enlaces) y la búsqueda (formulario GET; con JavaScript filtra
     al escribir). En escritorio, además, la misma información como tabla de solo lectura. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { EstatusCentro, Kpi } from '$lib/dominio/estatus';
	import { plural, textoMes } from '$lib/dominio/textos';
	import InsigniaEstatus from '$lib/components/estatus/InsigniaEstatus.svelte';
	import TarjetaCentro from '$lib/components/estatus/TarjetaCentro.svelte';
	import { rutaCobranza, rutaSeguimiento } from '$lib/components/estatus/enlaces';
	import { CLASE_ESTATUS, TRAZOS_ESTATUS } from '$lib/components/estatus/iconos';
	import { cifraDeKpi, kpiConDatos } from '$lib/components/estatus/textos';
	import NavegacionMes from '$lib/components/ui/NavegacionMes.svelte';
	import {
		consultaTablero,
		cuentasPorEstatus,
		filtrarTarjetas,
		FILTROS_ESTATUS,
		mesVecino,
		textoFiltroVacio,
		textoResumenTablero,
		type FiltrosTablero,
		type TarjetaTablero
	} from './tablero';

	/** Todas las tarjetas del mes, ya ordenadas. */
	export let tarjetas: TarjetaTablero[] = [];
	/** Mes de corte, «AAAA-MM-01». */
	export let corte: string;
	/** Fecha de hoy, «AAAA-MM-DD»: el corte no pasa del mes en curso. */
	export let hoy: string;
	/** Estatus elegido en la dirección (`?estatus=`); null = todos. */
	export let estatus: EstatusCentro | null = null;
	/** Búsqueda de la dirección (`?q=`). */
	export let busqueda = '';
	/** Periodicidad del programa anual, para conservarla en los enlaces. */
	export let periodicidad: string | null = null;
	/** Quien consulta puede abrir «Contrato y cobranza» (capacidad `verContrato`). */
	export let verCobranza = false;
	/** Hay una navegación en curso a esta misma página (cambio de mes o de filtro). */
	export let cargando = false;

	const NOMBRE_FILTRO: Record<EstatusCentro, string> = {
		atrasado: 'Atrasados',
		con_pendientes: 'Con pendientes',
		al_corriente: 'Al corriente',
		sin_datos: 'Sin datos'
	};
	const MES_MINIMO = '2000-01';

	// Con JavaScript la búsqueda filtra al escribir; al navegar se queda con la de la dirección.
	let texto = busqueda;
	$: texto = busqueda;

	// «Quitar filtros» puede llevar a la misma dirección (búsqueda escrita sin enviar): se limpia aquí.
	function limpiarBusqueda() {
		texto = '';
	}

	$: mes = corte.slice(0, 7);
	$: esMesActual = mes === hoy.slice(0, 7);
	$: cuentas = cuentasPorEstatus(tarjetas);
	$: visibles = filtrarTarjetas(tarjetas, estatus, texto);
	$: primeraAtrasada = visibles.find((t) => t.estatus === 'atrasado')?.centro.id ?? null;

	// Filtros vigentes; cada enlace cambia uno y conserva los demás.
	$: filtros = { corte: mes, estatus, q: texto, periodicidad };
	const ruta = (actuales: FiltrosTablero, cambios: Partial<FiltrosTablero> = {}) =>
		`${resolve('/cumplimiento')}?${consultaTablero({ ...actuales, ...cambios })}`;
	const paso = (destino: string, actuales: FiltrosTablero) => ({
		href: ruta(actuales, { corte: destino }),
		texto: textoMes(destino, { corto: true }).slice(0, 3),
		nombre: textoMes(destino)
	});
	$: anterior = mes > MES_MINIMO ? paso(mesVecino(mes, -1), filtros) : null;
	$: siguiente = esMesActual ? null : paso(mesVecino(mes, 1), filtros);
	$: sinFiltros = ruta(filtros, { estatus: null, q: '' });

	const kpi = (tarjeta: TarjetaTablero, clave: Kpi['clave']) =>
		tarjeta.kpis.find((k) => k.clave === clave && kpiConDatos(k));
	const cifra = (tarjeta: TarjetaTablero, clave: Kpi['clave']) => {
		const indicador = kpi(tarjeta, clave);
		return indicador ? cifraDeKpi(indicador) : '—';
	};
	const nombre = (tarjeta: TarjetaTablero) =>
		[tarjeta.centro.clave, tarjeta.centro.nombre].filter(Boolean).join(' · ');
</script>

<!-- Cada enlace sale de `ruta` o de enlaces.ts, que ya aplican resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<section class="tablero" aria-labelledby="titulo-estatus">
	<div class="cabecera">
		<h2 id="titulo-estatus" class="view-heading">Estatus de los centros de costo</h2>
		<NavegacionMes
			{anterior}
			{siguiente}
			titulo={textoMes(mes, { inicial: true })}
			actual={esMesActual}
			etiqueta="Cambiar el mes de corte"
		/>
	</div>

	{#if tarjetas.length === 0}
		<p class="card vacio">
			Aún no tiene centros de costo asignados. Pida a administración que se los asigne en Personal.
		</p>
	{:else}
		<p class="view-note resumen">{textoResumenTablero(tarjetas, mes)}</p>

		<div class="controles">
			<nav aria-label="Filtrar por estatus">
				<ul class="pildoras">
					<li>
						<a
							class="status-badge grande pildora"
							href={ruta(filtros, { estatus: null })}
							aria-current={estatus === null ? 'true' : undefined}
						>
							Todos <span class="cifra">{tarjetas.length}</span>
						</a>
					</li>
					{#each FILTROS_ESTATUS as opcion (opcion)}
						<li>
							<svelte:element
								this={cuentas[opcion] ? 'a' : 'span'}
								class="status-badge grande pildora {CLASE_ESTATUS[opcion]}"
								class:sin-centros={!cuentas[opcion]}
								href={cuentas[opcion] ? ruta(filtros, { estatus: opcion }) : undefined}
								aria-current={estatus === opcion ? 'true' : undefined}
								data-filtro={opcion}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.25"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									{#each TRAZOS_ESTATUS[opcion] as trazo (trazo)}<path d={trazo} />{/each}
								</svg>
								{NOMBRE_FILTRO[opcion]}
								<span class="cifra">{cuentas[opcion]}</span>
							</svelte:element>
						</li>
					{/each}
				</ul>
			</nav>

			<form method="GET" action={resolve('/cumplimiento')} role="search" class="busqueda">
				<input type="hidden" name="corte" value={mes} />
				{#if estatus}<input type="hidden" name="estatus" value={estatus} />{/if}
				{#if periodicidad}<input type="hidden" name="periodicidad" value={periodicidad} />{/if}
				<div class="form-group">
					<label for="buscar-centro">Buscar centro de costo</label>
					<input
						id="buscar-centro"
						type="search"
						name="q"
						placeholder="Clave o nombre"
						autocomplete="off"
						enterkeyhint="search"
						maxlength="100"
						bind:value={texto}
					/>
				</div>
				<noscript><button class="boton" type="submit">Buscar</button></noscript>
			</form>
		</div>

		<p class="view-note cuenta" role="status">
			{#if visibles.length}
				{#if estatus || texto.trim()}
					<span>{plural(visibles.length, 'centro de costo', 'centros de costo')}.</span>
					<a class="enlace" href={sinFiltros} on:click={limpiarBusqueda}>Quitar filtros</a>
				{/if}
			{:else if texto.trim()}
				<span>
					Ningún centro coincide con «{texto.trim()}». Revise la clave o quite el filtro.
				</span>
				<a class="enlace" href={sinFiltros} on:click={limpiarBusqueda}>Quitar filtros</a>
			{:else if estatus}
				<span>{textoFiltroVacio(estatus, mes)}</span>
				<a class="enlace" href={sinFiltros}>Ver todos</a>
			{/if}
		</p>

		<div class="rejilla" class:cargando aria-busy={cargando ? 'true' : undefined}>
			{#each visibles as tarjeta (tarjeta.centro.id)}
				<TarjetaCentro
					centro={tarjeta.centro}
					{mes}
					estatus={tarjeta.estatus}
					kpis={tarjeta.kpis}
					falta={tarjeta.falta}
					emergencias={tarjeta.emergencias}
					variante="tablero"
					{verCobranza}
					principal={tarjeta.centro.id === primeraAtrasada}
				/>
			{/each}
		</div>

		{#if visibles.length}
			<details class="card como-tabla">
				<summary class="view-heading">Ver como tabla</summary>
				<div class="tabla-desplazable">
					<table class="tabla">
						<thead>
							<tr>
								<th scope="col">Centro de costo</th>
								<th scope="col">Estatus</th>
								<th scope="col" class="numero">Ejecución</th>
								<th scope="col" class="numero">Documentos</th>
								<th scope="col" class="numero">Carpetas</th>
								{#if verCobranza}<th scope="col" class="numero">Cobranza</th>{/if}
								<th scope="col">Qué falta</th>
								<th scope="col">Abrir</th>
							</tr>
						</thead>
						<tbody>
							{#each visibles as tarjeta (tarjeta.centro.id)}
								<tr>
									<th scope="row">
										<a class="enlace" href={rutaSeguimiento(tarjeta.centro.id, mes)}
											>{nombre(tarjeta)}</a
										>
									</th>
									<td><InsigniaEstatus estatus={tarjeta.estatus} /></td>
									<td class="numero">{cifra(tarjeta, 'ejecucion')}</td>
									<td class="numero">{cifra(tarjeta, 'documentos')}</td>
									<td class="numero">{cifra(tarjeta, 'carpetas')}</td>
									{#if verCobranza}<td class="numero">{cifra(tarjeta, 'cobranza')}</td>{/if}
									<td class="falta">
										{#if tarjeta.pendientes}
											{tarjeta.falta[0].texto}
											{#if tarjeta.pendientes > 1}
												<span class="view-note">y {tarjeta.pendientes - 1} más</span>
											{/if}
										{:else}
											<span class="view-note">Nada pendiente</span>
										{/if}
									</td>
									<td>
										<div class="abrir">
											<a
												class="enlace"
												href={rutaSeguimiento(tarjeta.centro.id, mes)}
												aria-label={`Seguimiento de ${nombre(tarjeta)}`}>Seguimiento</a
											>
											{#if tarjeta.contratoId}
												<a
													class="enlace"
													href={`${resolve('/cumplimiento')}?contrato=${tarjeta.contratoId}&sitio=${tarjeta.centro.id}&corte=${mes}`}
													aria-label={`Programa anual de ${nombre(tarjeta)}`}>Programa anual</a
												>
											{/if}
											{#if verCobranza}
												<a
													class="enlace"
													href={rutaCobranza(tarjeta.centro.id)}
													aria-label={`Contrato y cobranza de ${nombre(tarjeta)}`}
													>Contrato y cobranza</a
												>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		{/if}
	{/if}
</section>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	.tablero {
		margin-bottom: 32px;
	}
	.cabecera {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 24px;
		margin-bottom: 8px;
	}
	.cabecera .view-heading {
		margin: 0;
	}
	.resumen {
		margin-bottom: 16px;
		font-size: var(--texto-base);
	}
	.controles {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px 24px;
	}
	.pildoras {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pildora {
		min-height: 44px;
		padding-inline: 14px;
		border-width: 1px;
		border-style: solid;
	}
	a.pildora:hover {
		border-color: currentColor;
	}
	.pildora[aria-current='true'] {
		border-color: var(--accion);
		box-shadow: 0 0 0 1px var(--accion);
	}
	.pildora.sin-centros {
		background: transparent;
		border-color: var(--linea);
		color: var(--tinta-tenue);
	}
	.pildora .cifra {
		font-weight: 800;
	}
	.busqueda {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		flex: 0 1 320px;
		min-width: min(100%, 240px);
	}
	.busqueda .form-group {
		flex: 1;
		min-width: 0;
		margin: 0;
	}
	.busqueda input {
		width: 100%;
		min-height: 44px;
	}
	.cuenta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 12px;
		margin: 12px 0 0;
		font-size: var(--texto-base);
	}
	.cuenta a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
	.rejilla {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 16px;
		margin-top: 12px;
	}
	.rejilla.cargando {
		opacity: 0.6;
	}
	.vacio {
		margin: 16px 0 0;
	}
	.como-tabla {
		margin: 16px 0 0;
	}
	.como-tabla summary {
		font-size: var(--texto-base);
	}
	.tabla th[scope='row'] {
		text-align: left;
		font-weight: 600;
		min-width: 200px;
	}
	.numero {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.falta {
		min-width: 220px;
	}
	.abrir {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
	}
	.abrir a {
		white-space: nowrap;
	}
	/* La tabla es para escritorio: en teléfono las tarjetas dicen lo mismo. */
	@media (max-width: 768px) {
		.como-tabla {
			display: none;
		}
		.busqueda {
			flex-basis: 100%;
		}
	}
</style>
