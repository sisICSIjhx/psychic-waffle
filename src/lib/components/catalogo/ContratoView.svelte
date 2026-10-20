<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type {
		Contrato,
		Equipo,
		Firmante,
		PartidaResumen,
		Programa,
		Sitio
	} from '$lib/dominio/esquemas';
	import TextField from '$lib/components/fields/TextField.svelte';
	import DateField from '$lib/components/fields/DateField.svelte';
	import Aviso from './Aviso.svelte';
	import ResumenImportacion from './ResumenImportacion.svelte';

	export let contrato: Contrato;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let estado: 'todas' | 'por_confirmar' = 'todas';
	export let partidas: PartidaResumen[] = [];
	export let equipos: Equipo[] = [];
	export let firmantes: Firmante[] = [];
	export let programas: Programa[] = [];
	// Resultado de la última acción (forma flexible: cada acción devuelve campos distintos).
	export let form: Record<string, unknown> | null = null;

	const FUNCIONES = { elaboro: 'Elaboró', aprobo: 'Aprobó', recibio: 'Recibió' } as const;
	const PERIODICIDAD: Record<string, string> = {
		diaria: 'Diaria',
		semanal: 'Semanal',
		quincenal: 'Quincenal',
		mensual: 'Mensual',
		bimestral: 'Bimestral',
		trimestral: 'Trimestral',
		cuatrimestral: 'Cuatrimestral',
		semestral: 'Semestral',
		anual: 'Anual',
		cuando_aplique: 'Cuando aplique'
	};

	// Formulario de firmante; los firmantes que propone el Excel lo prellenan para confirmarlos.
	let firmante = { funcion: 'elaboro', nombre: '', cargo: '', empresa: '' };
	async function usarPropuesto(propuesto: { nombre: string; cargo: string; empresa: string }) {
		firmante = {
			...firmante,
			nombre: propuesto.nombre,
			cargo: propuesto.cargo,
			empresa: propuesto.empresa
		};
		// Espera a que se abra el panel del formulario antes de enfocar el nombre.
		await tick();
		document.getElementById('firmante-nombre')?.focus();
	}

	function enviarAlCambiar(evento: Event) {
		(evento.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}

	$: aviso = form as { mensaje?: string; error?: string } | null;
</script>

<p class="migas">
	<a class="enlace" href={resolve('/catalogo')}>Catálogo</a> / Contrato {contrato.numero}
</p>

<section class="card" aria-labelledby="titulo-contrato">
	<h2 id="titulo-contrato" class="view-heading">
		{contrato.cliente?.razonSocial ?? ''} · Contrato {contrato.numero}
	</h2>
	<p class="view-note">
		Vigencia del {contrato.vigenciaInicio} al {contrato.vigenciaFin}.
		{#if contrato.vigente}<span class="status-badge vigente">Vigente</span>{/if}
	</p>
</section>

<Aviso form={aviso} />

<section class="card" aria-labelledby="titulo-sitios">
	<h2 id="titulo-sitios" class="view-heading">Sitios</h2>
	{#if sitios.length}
		<form method="GET" class="toolbar">
			<label for="sitio">Sitio</label>
			<select id="sitio" name="sitio" on:change={enviarAlCambiar}>
				{#each sitios as s (s.id)}
					<option value={s.id} selected={s.id === sitio?.id}>{s.clave} {s.nombre}</option>
				{/each}
			</select>
			<input type="hidden" name="estado" value={estado} />
			<noscript><button type="submit">Ver</button></noscript>
		</form>
	{:else}
		<p class="view-note">El contrato aún no tiene sitios.</p>
	{/if}
	<details>
		<summary>Asociar un sitio</summary>
		<form method="POST" action="?/asociarSitio" use:enhance class="form-grid">
			<TextField label="Clave (EM/ERM)" name="clave" placeholder="EM-30167" />
			<TextField label="Nombre" name="nombre" placeholder="CERRITOS" />
			<div class="form-group acciones-formulario">
				<button class="boton primario" type="submit">Asociar</button>
			</div>
		</form>
	</details>
</section>

{#if sitio}
	<section class="card" aria-labelledby="titulo-partidas">
		<h2 id="titulo-partidas" class="view-heading">Partidas de {sitio.clave} {sitio.nombre}</h2>
		<div class="toolbar">
			<form method="GET">
				<input type="hidden" name="sitio" value={sitio.id} />
				<label for="estado">Mostrar</label>
				<select id="estado" name="estado" on:change={enviarAlCambiar}>
					<option value="todas" selected={estado === 'todas'}>Todas</option>
					<option value="por_confirmar" selected={estado === 'por_confirmar'}>Por confirmar</option>
				</select>
				<noscript><button type="submit">Filtrar</button></noscript>
			</form>
			<form method="GET" action={resolve('/catalogo/partidas/[id]', { id: 'nueva' })}>
				<input type="hidden" name="contrato" value={contrato.id} />
				<input type="hidden" name="sitio" value={sitio.id} />
				<button class="primary" type="submit">Nueva partida</button>
			</form>
		</div>
		{#if partidas.length === 0}
			<p class="view-note">
				{estado === 'por_confirmar'
					? 'No hay partidas por confirmar.'
					: 'No hay partidas. Importe el catálogo de Excel o agréguelas una por una.'}
			</p>
		{:else}
			<div class="tabla-desplazable">
				<table>
					<thead>
						<tr>
							<th>Partida</th>
							<th>Actividad</th>
							<th>Periodicidad</th>
							<th>Estado</th>
							<th><span class="sr-only">Acciones</span></th>
						</tr>
					</thead>
					<tbody>
						{#each partidas as partida (partida.id)}
							<tr>
								<td>{partida.numero}</td>
								<td>{partida.actividad}</td>
								<td>{PERIODICIDAD[partida.periodicidad]}</td>
								<td>
									{#if partida.estadoCatalogo === 'por_confirmar'}
										<span class="status-badge por-confirmar">Por confirmar</span>
									{:else}
										<span class="status-badge vigente">Confirmada</span>
									{/if}
								</td>
								<td class="acciones-fila">
									<a class="enlace" href={resolve('/catalogo/partidas/[id]', { id: partida.id })}
										>Editar</a
									>
									{#if partida.estadoCatalogo === 'por_confirmar'}
										<form method="POST" action="?/confirmarPartida" use:enhance>
											<input type="hidden" name="id" value={partida.id} />
											<button class="action-btn edit" type="submit">Confirmar</button>
										</form>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		{#if programas.length}
			<p class="view-note">
				Programa anual: {programas.map((p) => `${p.periodoInicio} a ${p.periodoFin}`).join(', ')}.
			</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="titulo-importar">
		<h2 id="titulo-importar" class="view-heading">Importar catálogo y programa desde Excel</h2>
		<p class="view-note">
			Primero se muestra un ensayo con lo que se creará o actualizará; nada se guarda hasta
			confirmar.
		</p>
		<form
			method="POST"
			action="?/importarEnsayo"
			enctype="multipart/form-data"
			use:enhance
			class="toolbar"
		>
			<input type="hidden" name="sitioId" value={sitio.id} />
			<label for="archivo" class="sr-only">Archivo de Excel</label>
			<input id="archivo" name="archivo" type="file" accept=".xlsx" required />
			<button class="primary" type="submit">Revisar archivo</button>
		</form>
		{#if form?.accion === 'importar' && form?.resultado}
			<ResumenImportacion
				resultado={form.resultado as never}
				token={String(form.token)}
				nombreArchivo={String(form.nombreArchivo)}
				advertencias={(form.advertencias as string[]) ?? []}
				firmantesPropuestos={(form.firmantesPropuestos as never[]) ?? []}
				encabezado={form.encabezado as never}
				on:usarFirmante={(e) => usarPropuesto(e.detail)}
			/>
		{/if}
	</section>

	<section class="card" aria-labelledby="titulo-equipos">
		<h2 id="titulo-equipos" class="view-heading">Equipos e instrumentos (TAG) del sitio</h2>
		{#if equipos.length}
			<div class="tabla-desplazable">
				<table>
					<thead
						><tr
							><th>TAG</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Rango</th><th>Serie</th
							></tr
						></thead
					>
					<tbody>
						{#each equipos as equipo (equipo.id)}
							<tr>
								<td>{equipo.tag}</td>
								<td>{equipo.tipo ?? ''}</td>
								<td>{equipo.marca ?? ''}</td>
								<td>{equipo.modelo ?? ''}</td>
								<td>{equipo.rango ?? ''}</td>
								<td>{equipo.numeroSerie ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="view-note">Sin equipos registrados en este sitio.</p>
		{/if}
		<details>
			<summary>Agregar equipo</summary>
			<form method="POST" action="?/guardarEquipo" use:enhance class="form-grid">
				<input type="hidden" name="sitioId" value={sitio.id} />
				<TextField label="TAG" name="tag" placeholder="PI-0001" />
				<TextField label="Tipo" name="tipo" />
				<TextField label="Marca" name="marca" />
				<TextField label="Modelo" name="modelo" />
				<TextField label="Rango" name="rango" />
				<TextField label="Número de serie" name="numeroSerie" />
				<div class="form-group acciones-formulario">
					<button class="boton primario" type="submit">Agregar</button>
				</div>
			</form>
		</details>
	</section>
{/if}

<section class="card" aria-labelledby="titulo-firmantes">
	<h2 id="titulo-firmantes" class="view-heading">Firmantes del contrato</h2>
	{#if firmantes.length}
		<div class="tabla-desplazable">
			<table>
				<thead
					><tr><th>Función</th><th>Nombre</th><th>Cargo</th><th>Empresa</th><th>Vigencia</th></tr
					></thead
				>
				<tbody>
					{#each firmantes as f (f.id)}
						<tr>
							<td>{FUNCIONES[f.funcion]}</td>
							<td>{f.nombre}</td>
							<td>{f.cargo}</td>
							<td>{f.empresa}</td>
							<td>{f.vigenteDesde} {f.vigenteHasta ? `a ${f.vigenteHasta}` : 'en adelante'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="view-note">Sin firmantes. Los reportes nuevos copian los firmantes vigentes.</p>
	{/if}
	<details open={firmante.nombre !== ''}>
		<summary>Registrar firmante</summary>
		<form method="POST" action="?/guardarFirmante" use:enhance class="form-grid">
			<div class="form-group">
				<label for="firmante-funcion">Función</label>
				<select id="firmante-funcion" name="funcion" bind:value={firmante.funcion}>
					{#each Object.entries(FUNCIONES) as [valor, etiqueta] (valor)}
						<option value={valor}>{etiqueta}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="firmante-nombre">Nombre</label>
				<input id="firmante-nombre" name="nombre" bind:value={firmante.nombre} required />
			</div>
			<div class="form-group">
				<label for="firmante-cargo">Cargo</label>
				<input id="firmante-cargo" name="cargo" bind:value={firmante.cargo} />
			</div>
			<div class="form-group">
				<label for="firmante-empresa">Empresa</label>
				<input id="firmante-empresa" name="empresa" bind:value={firmante.empresa} />
			</div>
			<DateField
				label="Vigente desde"
				name="vigenteDesde"
				value={contrato.vigenciaInicio}
				required
			/>
			<DateField label="Vigente hasta (opcional)" name="vigenteHasta" />
			<div class="form-group acciones-formulario">
				<button class="boton primario" type="submit">Registrar</button>
			</div>
		</form>
	</details>
</section>
