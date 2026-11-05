<!-- Ficha de un equipo del catálogo: identificación, datos técnicos, estado y calibración, con los
     campos del Excel «Catálogo de equipos». Eliminar solo si no está en partidas ni reportes. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		ESTADOS_EQUIPO,
		type Cliente,
		type EquipoCatalogo,
		type Sitio
	} from '$lib/dominio/esquemas';
	import {
		estadoCalibracion,
		ETIQUETAS_CALIBRACION,
		ETIQUETAS_ESTADO_EQUIPO,
		INTERVALOS_CON_NOMBRE,
		proximaCalibracion,
		textoFechaCorta,
		textoIntervalo
	} from '$lib/dominio/equipos';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';

	export let equipo: EquipoCatalogo | null = null;
	export let proyecto: Cliente | null = null;
	export let sitios: Sitio[] = [];
	export let hoy: string;
	export let puedeEditar = true;
	export let form: { mensaje?: string; error?: string } | null = null;

	let intervaloMeses = equipo?.intervaloMeses ? String(equipo.intervaloMeses) : '';
	let ultimaCalibracion = equipo?.ultimaCalibracion ?? '';
	let proximaCapturada = equipo?.proximaCalibracion ?? '';
	let dialogoAbierto = false;
	let formularioEliminar: HTMLFormElement | undefined;

	/** Los intervalos con nombre, 2 y 5 años y, si es otro, el del equipo. */
	$: intervalos = [
		...new Set([
			...INTERVALOS_CON_NOMBRE.map(([meses]) => meses),
			24,
			60,
			...(equipo?.intervaloMeses ? [equipo.intervaloMeses] : [])
		])
	].sort((a, b) => a - b);

	$: datosCalibracion = {
		intervaloMeses: intervaloMeses ? Number(intervaloMeses) : null,
		ultimaCalibracion: ultimaCalibracion || null,
		proximaCalibracion: proximaCapturada || null
	};
	$: proxima = proximaCalibracion(datosCalibracion);
	$: estadoCal = estadoCalibracion(datosCalibracion, hoy);

	$: lista = proyecto
		? `${resolve('/equipos')}?proyecto=${encodeURIComponent(proyecto.clave)}`
		: resolve('/equipos');

	const conservarCampos: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });
</script>

<p class="migas">
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() ya aplicado; el proyecto va en la consulta. -->
	<a class="enlace" href={lista}>Equipos{proyecto ? ` de ${proyecto.nombre}` : ''}</a> /
	{equipo ? equipo.tag : 'Nuevo equipo'}
</p>

<Aviso {form} />

{#if sitios.length === 0}
	<section class="card">
		<p class="view-note">
			El proyecto no tiene sitios. Agréguelos desde un contrato del
			<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
		</p>
	</section>
{:else}
	<form method="POST" action="?/guardar" use:enhance={conservarCampos}>
		<input type="hidden" name="proyecto" value={proyecto?.clave ?? ''} />
		<fieldset class="sin-marco" disabled={!puedeEditar}>
			<section class="card" aria-labelledby="titulo-identificacion">
				<h2 id="titulo-identificacion" class="view-heading">Identificación</h2>
				<div class="form-grid">
					<div class="form-group">
						<label for="sitioId">Sitio</label>
						<select id="sitioId" name="sitioId" value={equipo?.sitioId ?? sitios[0].id} required>
							{#each sitios as sitio (sitio.id)}
								<option value={sitio.id}
									>{sitio.clave}{sitio.nombre ? ` · ${sitio.nombre}` : ''}</option
								>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="tag">Equipo ID (TAG)</label>
						<input
							id="tag"
							name="tag"
							value={equipo?.tag ?? ''}
							placeholder="PIT-1701"
							autocomplete="off"
							required
						/>
					</div>
					<div class="form-group campo-ancho">
						<label for="tipo">Nombre</label>
						<input
							id="tipo"
							name="tipo"
							value={equipo?.tipo ?? ''}
							placeholder="Transmisor indicador de presión"
							autocomplete="off"
						/>
					</div>
					<div class="form-group">
						<label for="ubicacion">Ubicación</label>
						<input
							id="ubicacion"
							name="ubicacion"
							value={equipo?.ubicacion ?? ''}
							placeholder="Separador"
							autocomplete="off"
						/>
					</div>
				</div>
			</section>

			<section class="card" aria-labelledby="titulo-tecnicos">
				<h2 id="titulo-tecnicos" class="view-heading">Datos técnicos</h2>
				<div class="form-grid">
					<div class="form-group">
						<label for="marca">Marca</label>
						<input id="marca" name="marca" value={equipo?.marca ?? ''} autocomplete="off" />
					</div>
					<div class="form-group">
						<label for="modelo">Modelo</label>
						<input id="modelo" name="modelo" value={equipo?.modelo ?? ''} autocomplete="off" />
					</div>
					<div class="form-group">
						<label for="numeroSerie">No. de serie</label>
						<input
							id="numeroSerie"
							name="numeroSerie"
							value={equipo?.numeroSerie ?? ''}
							autocomplete="off"
						/>
					</div>
					<div class="form-group">
						<label for="rango">Rango</label>
						<input
							id="rango"
							name="rango"
							value={equipo?.rango ?? ''}
							placeholder="0 - 100 kg/cm²"
							autocomplete="off"
						/>
					</div>
					<div class="form-group">
						<label for="resolucion">Resolución</label>
						<input
							id="resolucion"
							name="resolucion"
							value={equipo?.resolucion ?? ''}
							autocomplete="off"
						/>
					</div>
					<div class="form-group">
						<label for="clase">Clase / tolerancia</label>
						<input
							id="clase"
							name="clase"
							value={equipo?.clase ?? ''}
							placeholder="Clase I / Div I"
							autocomplete="off"
						/>
					</div>
				</div>
			</section>

			<section class="card" aria-labelledby="titulo-estado">
				<h2 id="titulo-estado" class="view-heading">Estado y responsables</h2>
				<div class="form-grid">
					<div class="form-group">
						<label for="estado">Estado</label>
						<select id="estado" name="estado" value={equipo?.estado ?? 'en_servicio'}>
							{#each ESTADOS_EQUIPO as valor (valor)}<option value={valor}
									>{ETIQUETAS_ESTADO_EQUIPO[valor]}</option
								>{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="propietario">Propietario</label>
						<input
							id="propietario"
							name="propietario"
							value={equipo?.propietario ?? ''}
							autocomplete="off"
						/>
					</div>
					<div class="form-group">
						<label for="responsable">Responsable</label>
						<input
							id="responsable"
							name="responsable"
							value={equipo?.responsable ?? ''}
							autocomplete="off"
						/>
					</div>
				</div>
				<label class="casilla-sola">
					<input type="checkbox" name="critico" checked={equipo?.critico ?? false} />
					Equipo crítico
				</label>
			</section>

			<section class="card" aria-labelledby="titulo-calibracion">
				<h2 id="titulo-calibracion" class="view-heading">Calibración o verificación</h2>
				<div class="form-grid">
					<div class="form-group">
						<label for="intervaloMeses">Intervalo</label>
						<select id="intervaloMeses" name="intervaloMeses" bind:value={intervaloMeses}>
							<option value="">Sin intervalo</option>
							{#each intervalos as meses (meses)}<option value={String(meses)}
									>{textoIntervalo(meses)}</option
								>{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="ultimaCalibracion">Última</label>
						<input
							id="ultimaCalibracion"
							name="ultimaCalibracion"
							type="date"
							bind:value={ultimaCalibracion}
						/>
					</div>
					<div class="form-group">
						<label for="proximaCalibracion">Próxima</label>
						<input
							id="proximaCalibracion"
							name="proximaCalibracion"
							type="date"
							bind:value={proximaCapturada}
							aria-describedby="ayuda-proxima"
						/>
					</div>
					<div class="form-group">
						<label for="proveedor">Proveedor</label>
						<input
							id="proveedor"
							name="proveedor"
							value={equipo?.proveedor ?? ''}
							placeholder="Laboratorio externo"
							autocomplete="off"
						/>
					</div>
				</div>
				<p id="ayuda-proxima" class="view-note">
					{#if proxima.fecha}
						Próxima: {textoFechaCorta(proxima.fecha)}{proxima.calculada
							? ' (calculada con la última y el intervalo)'
							: ''} ·
						<span
							class="status-badge"
							class:err={estadoCal === 'vencida'}
							class:warn={estadoCal === 'por_vencer'}
							class:ok={estadoCal === 'vigente'}>{ETIQUETAS_CALIBRACION[estadoCal]}</span
						>
					{:else}
						Si deja vacía la próxima fecha, se calcula con la última y el intervalo.
					{/if}
				</p>
				<div class="form-group separado">
					<label for="notas">Notas</label>
					<textarea id="notas" name="notas" rows="3">{equipo?.notas ?? ''}</textarea>
				</div>
			</section>
		</fieldset>

		{#if puedeEditar}
			<div class="toolbar">
				<button class="boton primario" type="submit"
					>{equipo ? 'Guardar cambios' : 'Registrar equipo'}</button
				>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() ya aplicado; el proyecto va en la consulta. -->
				<a class="boton" href={lista}>Volver a la lista</a>
				{#if equipo}
					<button
						class="boton fantasma peligro"
						type="button"
						on:click={() => (dialogoAbierto = true)}>Eliminar</button
					>
				{/if}
			</div>
		{/if}
	</form>

	{#if equipo && puedeEditar}
		<form bind:this={formularioEliminar} method="POST" action="?/eliminar" use:enhance hidden>
			<input type="hidden" name="proyecto" value={proyecto?.clave ?? ''} />
		</form>
		<Dialogo
			id="eliminar-equipo"
			bind:abierto={dialogoAbierto}
			titulo="¿Eliminar el equipo {equipo.tag}?"
			textoConfirmar="Eliminar"
			textoCancelar={equipo.enUso ? 'Entendido' : 'Cancelar'}
			conConfirmar={!equipo.enUso}
			on:confirmar={() => formularioEliminar?.requestSubmit()}
		>
			{#if equipo.enUso}
				<p>
					Está asignado a partidas o reportes, así que no se puede eliminar. Cambie su estado a
					«Dado de baja» para conservar el historial.
				</p>
			{:else}
				<p>Se borrará del catálogo. Si solo dejó de usarse, márquelo «Dado de baja».</p>
			{/if}
		</Dialogo>
	{/if}
{/if}

<style>
	.sin-marco {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: none;
	}
</style>
