<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { resumenEfectos } from '$lib/dominio/bitacora';
	import type {
		Contrato,
		Equipo,
		Firmante,
		PaginaCambios,
		PartidaResumen,
		Programa,
		ResultadoEdicion,
		ResumenSitio,
		Sitio
	} from '$lib/dominio/esquemas';
	import type { SubmitFunction } from '@sveltejs/kit';
	import TextField from '$lib/components/fields/TextField.svelte';
	import { notificaciones } from '$lib/components/ui/notificaciones';
	import Aviso from './Aviso.svelte';
	import DatosContrato from './DatosContrato.svelte';
	import DialogoCambioCatalogo from './DialogoCambioCatalogo.svelte';
	import FirmantesContrato from './FirmantesContrato.svelte';
	import HistorialCambios from './HistorialCambios.svelte';
	import SitiosContrato from './SitiosContrato.svelte';
	import ResumenImportacion from './ResumenImportacion.svelte';
	import ResumenPrograma from './ResumenPrograma.svelte';

	export let contrato: Contrato;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let estado: 'todas' | 'por_confirmar' = 'todas';
	export let partidas: PartidaResumen[] = [];
	export let equipos: Equipo[] = [];
	export let firmantes: Firmante[] = [];
	export let programas: Programa[] = [];
	export let resumenSitios: ResumenSitio[] = [];
	export let cambios: PaginaCambios = { total: 0, pagina: 1, tamano: 20, filas: [] };
	export let historialAbierto = false;
	export let permisos = { editarCatalogo: true };
	// Resultado de la última acción (forma flexible: cada acción devuelve campos distintos).
	export let form: Record<string, unknown> | null = null;

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

	// Formulario de equipo: sirve para agregar y, con «Editar», para corregir una fila (lleva su id).
	const equipoVacio = () => ({
		id: '',
		tag: '',
		tipo: '',
		marca: '',
		modelo: '',
		rango: '',
		numeroSerie: ''
	});
	let equipo = equipoVacio();
	let equipoAbierto = false;
	/** Firmante que propone el Excel importado, para prellenar el alta. */
	let propuesto: { nombre: string; cargo: string; empresa: string } | null = null;

	async function enfocar(id: string) {
		// Espera a que se abra el panel del formulario antes de enfocar el campo.
		await tick();
		document.getElementById(id)?.focus();
	}

	function editarEquipo(e: Equipo) {
		equipo = {
			id: e.id,
			tag: e.tag,
			tipo: e.tipo ?? '',
			marca: e.marca ?? '',
			modelo: e.modelo ?? '',
			rango: e.rango ?? '',
			numeroSerie: e.numeroSerie ?? ''
		};
		equipoAbierto = true;
		enfocar('equipo-tag');
	}

	// Corrección del catálogo: el ensayo abre la confirmación; la aplicación avisa sus efectos y
	// recarga los datos. Ante un conflicto de versión también se recargan.
	let dialogoAbierto = false;
	let ensayo: { campos: Record<string, string>; resultado: ResultadoEdicion } | null = null;
	let ultimoEnsayo: unknown = null;
	$: if (form?.accion === 'ensayarCambio' && form.resultado && form !== ultimoEnsayo) {
		ultimoEnsayo = form;
		ensayo = {
			campos: form.campos as Record<string, string>,
			resultado: form.resultado as ResultadoEdicion
		};
		dialogoAbierto = true;
	}
	$: errorEnsayo =
		form?.accion === 'ensayarCambio' && !form.resultado
			? (form as {
					tipo?: string;
					error?: string;
					motivo?: string | null;
					detalle?: Record<string, unknown>;
				})
			: null;
	const errorDe = (tipos: string[]) =>
		errorEnsayo && tipos.includes(String(errorEnsayo.tipo)) ? errorEnsayo : null;

	const alAplicar: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'success') {
				const efectos = resumenEfectos(
					(result.data?.efectos as Record<string, unknown> | undefined) ?? {}
				);
				notificaciones.mostrar({
					mensaje: ['Cambio guardado y registrado en el historial.', efectos.join(', ')]
						.filter(Boolean)
						.join(' ')
				});
			}
			await update({ reset: false });
			if (result.type === 'failure' && result.status === 409) await invalidateAll();
		};

	function enlacePagina(pagina: number): string {
		const consulta = [
			sitio ? `sitio=${sitio.id}` : '',
			estado !== 'todas' ? `estado=${estado}` : '',
			`cambios=${pagina}`
		].filter(Boolean);
		return `${resolve('/catalogo/contratos/[id]', { id: contrato.id })}?${consulta.join('&')}`;
	}

	// Tras guardar con éxito se vacía el formulario; si falla, se conserva lo capturado.
	const limpiarAlGuardar =
		(limpiar: () => void): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'success') limpiar();
			await update({ reset: false });
		};

	function enviarAlCambiar(evento: Event) {
		(evento.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}

	// Los errores del ensayo se muestran junto a sus campos, no en el aviso general.
	$: aviso = (form?.accion === 'ensayarCambio' ? null : form) as {
		mensaje?: string;
		error?: string;
	} | null;
</script>

<p class="migas">
	<a class="enlace" href={resolve('/catalogo')}>Catálogo</a> / Contrato {contrato.numero}
</p>

<DatosContrato {contrato} puedeEditar={permisos.editarCatalogo} error={errorDe(['contrato'])} />

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
		<SitiosContrato
			{sitios}
			resumen={resumenSitios}
			puedeEditar={permisos.editarCatalogo}
			error={errorDe(['sitio', 'quitarSitio'])}
		/>
	{:else}
		<p class="view-note">El contrato aún no tiene sitios.</p>
	{/if}
	{#if permisos.editarCatalogo}
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
	{/if}
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
		<h2 id="titulo-importar" class="view-heading">Importar catálogo o programa desde Excel</h2>
		<p class="view-note">
			Se aceptan dos formatos: el libro del catálogo (hojas del programa anual y del catálogo de
			alcances) o un programa anual solo, con uno o varios sitios; de este se toma el bloque de {sitio.clave}.
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
		{#if form?.accion === 'importar' && form?.tipo === 'programa' && form?.resultadoPrograma}
			<ResumenPrograma
				resultado={form.resultadoPrograma as never}
				token={String(form.token)}
				nombreArchivo={String(form.nombreArchivo)}
				sitio={String(form.sitio)}
				advertencias={(form.advertenciasPrograma as never[]) ?? []}
			/>
		{:else if form?.accion === 'importar' && form?.resultado}
			<ResumenImportacion
				resultado={form.resultado as never}
				token={String(form.token)}
				nombreArchivo={String(form.nombreArchivo)}
				advertencias={(form.advertencias as string[]) ?? []}
				firmantesPropuestos={(form.firmantesPropuestos as never[]) ?? []}
				encabezado={form.encabezado as never}
				on:usarFirmante={(e) => (propuesto = { ...e.detail })}
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
							><th>TAG</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Rango</th><th>Serie</th><th
								><span class="sr-only">Acciones</span></th
							></tr
						></thead
					>
					<tbody>
						{#each equipos as fila (fila.id)}
							<tr>
								<td>{fila.tag}</td>
								<td>{fila.tipo ?? ''}</td>
								<td>{fila.marca ?? ''}</td>
								<td>{fila.modelo ?? ''}</td>
								<td>{fila.rango ?? ''}</td>
								<td>{fila.numeroSerie ?? ''}</td>
								<td>
									<button class="action-btn edit" type="button" on:click={() => editarEquipo(fila)}
										>Editar <span class="sr-only">{fila.tag}</span></button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="view-note">Sin equipos registrados en este sitio.</p>
		{/if}
		<details bind:open={equipoAbierto}>
			<summary>{equipo.id ? `Editar equipo ${equipo.tag}` : 'Agregar equipo'}</summary>
			<form
				method="POST"
				action="?/guardarEquipo"
				use:enhance={limpiarAlGuardar(() => (equipo = equipoVacio()))}
				class="form-grid"
			>
				<input type="hidden" name="sitioId" value={sitio.id} />
				<input type="hidden" name="id" value={equipo.id} />
				<div class="form-group">
					<label for="equipo-tag">TAG</label>
					<input
						id="equipo-tag"
						name="tag"
						placeholder="PI-0001"
						bind:value={equipo.tag}
						required
					/>
				</div>
				<div class="form-group">
					<label for="equipo-tipo">Tipo</label>
					<input id="equipo-tipo" name="tipo" bind:value={equipo.tipo} />
				</div>
				<div class="form-group">
					<label for="equipo-marca">Marca</label>
					<input id="equipo-marca" name="marca" bind:value={equipo.marca} />
				</div>
				<div class="form-group">
					<label for="equipo-modelo">Modelo</label>
					<input id="equipo-modelo" name="modelo" bind:value={equipo.modelo} />
				</div>
				<div class="form-group">
					<label for="equipo-rango">Rango</label>
					<input id="equipo-rango" name="rango" bind:value={equipo.rango} />
				</div>
				<div class="form-group">
					<label for="equipo-serie">Número de serie</label>
					<input id="equipo-serie" name="numeroSerie" bind:value={equipo.numeroSerie} />
				</div>
				<div class="form-group acciones-formulario">
					<button class="boton primario" type="submit"
						>{equipo.id ? 'Guardar cambios' : 'Agregar'}</button
					>
					{#if equipo.id}
						<button class="boton" type="button" on:click={() => (equipo = equipoVacio())}
							>Cancelar edición</button
						>
					{/if}
				</div>
			</form>
		</details>
	</section>
{/if}

<section class="card" aria-labelledby="titulo-firmantes">
	<h2 id="titulo-firmantes" class="view-heading">Firmantes del contrato</h2>
	<FirmantesContrato
		{firmantes}
		vigenciaInicio={contrato.vigenciaInicio}
		puedeEditar={permisos.editarCatalogo}
		{propuesto}
		error={errorDe(['corregirFirmante', 'cambiarFirmante'])}
	/>
</section>

<section class="card" aria-label="Historial de cambios">
	<HistorialCambios {cambios} abierto={historialAbierto} {enlacePagina} />
</section>

<DialogoCambioCatalogo
	bind:abierto={dialogoAbierto}
	campos={ensayo?.campos ?? {}}
	resultado={ensayo?.resultado ?? null}
	{alAplicar}
/>
