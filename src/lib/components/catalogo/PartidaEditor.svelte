<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Contrato, Equipo, Partida, Sitio } from '$lib/dominio/esquemas';
	import Aviso from './Aviso.svelte';

	export let partida: Partida | null = null;
	export let contrato: Contrato;
	export let sitio: Sitio;
	export let equipos: Equipo[] = [];
	export let form: { mensaje?: string; error?: string } | null = null;

	const PERIODICIDADES = [
		['diaria', 'Diaria'],
		['semanal', 'Semanal'],
		['quincenal', 'Quincenal'],
		['mensual', 'Mensual'],
		['bimestral', 'Bimestral'],
		['trimestral', 'Trimestral'],
		['cuatrimestral', 'Cuatrimestral'],
		['semestral', 'Semestral'],
		['anual', 'Anual'],
		['cuando_aplique', 'Cuando aplique']
	] as const;
	const TIPOS = [
		['alcance', 'Alcance'],
		['nota', 'Nota'],
		['norma', 'Norma o referencia']
	] as const;

	type Alcance = { tipo: 'alcance' | 'nota' | 'norma'; texto: string };
	type Herramienta = { cantidad: string | null; descripcion: string };

	let alcances: Alcance[] = (partida?.alcances ?? []).map((a) => ({
		tipo: a.tipo,
		texto: a.texto
	}));
	let herramientas: Herramienta[] = (partida?.herramientas ?? []).map((h) => ({
		cantidad: h.cantidad,
		descripcion: h.descripcion
	}));
	let equipoIds: string[] = (partida?.equipos ?? []).map((e) => e.id);
	let objetivo = partida?.objetivo ?? '';
	let conclusionesBase = partida?.conclusionesBase ?? '';

	const conservarCampos: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });

	function mover(indice: number, desplazamiento: number) {
		const destino = indice + desplazamiento;
		if (destino < 0 || destino >= alcances.length) return;
		const copia = [...alcances];
		[copia[indice], copia[destino]] = [copia[destino], copia[indice]];
		alcances = copia;
	}

	function alternarEquipo(id: string, marcado: boolean) {
		equipoIds = marcado ? [...equipoIds, id] : equipoIds.filter((e) => e !== id);
	}

	// Lo que falta para que un reporte de esta partida salga completo (no impide guardar).
	$: faltantes = [
		objetivo.trim() ? null : 'objetivo',
		alcances.some((a) => a.tipo === 'alcance' && a.texto.trim())
			? null
			: 'al menos un alcance ejecutable',
		herramientas.some((h) => h.descripcion.trim()) ? null : 'herramientas y equipo',
		conclusionesBase.trim() ? null : 'texto base de conclusiones'
	].filter((f): f is string => f !== null);

	$: alcancesValidos = alcances.filter((a) => a.texto.trim());
	$: herramientasValidas = herramientas.filter((h) => h.descripcion.trim());
</script>

<p class="migas">
	<a class="enlace" href={resolve('/catalogo')}>Catálogo</a> /
	<a class="enlace" href={resolve('/catalogo/contratos/[id]', { id: contrato.id })}
		>Contrato {contrato.numero}</a
	>
	/ {partida ? `Partida ${partida.numero}` : 'Nueva partida'}
</p>

<Aviso {form} />

{#if partida?.estadoCatalogo === 'por_confirmar'}
	<p class="aviso aviso-alerta">
		Partida derivada de reportes, pendiente de confirmar. Se reemplaza al importar el catálogo
		oficial.
	</p>
{/if}
{#if faltantes.length}
	<p class="aviso aviso-alerta">
		Falta capturar: {faltantes.join(', ')}. Los reportes lo señalarán antes de generarse.
	</p>
{/if}

<!-- Sin reinicio tras guardar: el formulario conserva lo capturado (Svelte 5 reinicia los
	campos enlazados con form.reset()). -->
<form method="POST" action="?/guardar" use:enhance={conservarCampos}>
	<input type="hidden" name="contratoId" value={contrato.id} />
	<input type="hidden" name="sitioId" value={sitio.id} />
	<input type="hidden" name="alcances" value={JSON.stringify(alcancesValidos)} />
	<input type="hidden" name="herramientas" value={JSON.stringify(herramientasValidas)} />
	<input type="hidden" name="equipoIds" value={JSON.stringify(equipoIds)} />

	<section class="card" aria-labelledby="titulo-datos">
		<h2 id="titulo-datos" class="view-heading">
			Datos de la partida · {sitio.clave}
			{sitio.nombre}
		</h2>
		<div class="form-grid">
			<div class="form-group">
				<label for="numero">Número</label>
				<input id="numero" name="numero" value={partida?.numero ?? ''} required />
			</div>
			<div class="form-group campo-ancho">
				<label for="actividad">Actividad</label>
				<input id="actividad" name="actividad" value={partida?.actividad ?? ''} required />
			</div>
			<div class="form-group">
				<label for="nombreCorto">Nombre corto (archivo)</label>
				<input
					id="nombreCorto"
					name="nombreCorto"
					value={partida?.nombreCorto ?? ''}
					placeholder="Manómetros"
				/>
			</div>
			<div class="form-group">
				<label for="periodicidad">Periodicidad</label>
				<select id="periodicidad" name="periodicidad" value={partida?.periodicidad ?? 'mensual'}>
					{#each PERIODICIDADES as [valor, etiqueta] (valor)}<option value={valor}
							>{etiqueta}</option
						>{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="cantidadAnual">Cantidad anual</label>
				<input
					id="cantidadAnual"
					name="cantidadAnual"
					type="number"
					min="0"
					step="any"
					value={partida?.cantidadAnual ?? ''}
				/>
			</div>
			<div class="form-group">
				<label for="distribucion">Distribución</label>
				<select id="distribucion" name="distribucion" value={partida?.distribucion ?? ''}>
					<option value="">Sin indicar</option>
					<option value="produccion">Producción</option>
					<option value="mantenimiento">Mantenimiento</option>
				</select>
			</div>
			<div class="form-group">
				<label for="tipoMantenimiento">Tipo de mantenimiento</label>
				<input
					id="tipoMantenimiento"
					name="tipoMantenimiento"
					value={partida?.tipoMantenimiento ?? 'Preventivo'}
				/>
			</div>
			<div class="form-group">
				<label for="materialesPor">Materiales por</label>
				<select id="materialesPor" name="materialesPor" value={partida?.materialesPor ?? ''}>
					<option value="">Sin indicar</option>
					<option value="icsi">ICSI</option>
					<option value="cliente">Cliente</option>
				</select>
			</div>
			<div class="form-group">
				<label for="estadoCatalogo">Estado en el catálogo</label>
				<select
					id="estadoCatalogo"
					name="estadoCatalogo"
					value={partida?.estadoCatalogo ?? 'confirmado'}
				>
					<option value="confirmado">Confirmada</option>
					<option value="por_confirmar">Por confirmar</option>
				</select>
			</div>
		</div>
		<fieldset class="casillas">
			<legend>Requisitos</legend>
			<label
				><input type="checkbox" name="requiereOdm" checked={partida?.requiereOdm ?? false} /> ODM</label
			>
			<label
				><input type="checkbox" name="requierePt" checked={partida?.requierePt ?? false} /> PT</label
			>
			<label
				><input type="checkbox" name="requiereAst" checked={partida?.requiereAst ?? false} /> AST</label
			>
		</fieldset>
		<div class="form-group">
			<label for="descripcion">Descripción</label>
			<textarea id="descripcion" name="descripcion" rows="2">{partida?.descripcion ?? ''}</textarea>
		</div>
		<div class="form-grid">
			<div class="form-group">
				<label for="entrega">Entrega</label>
				<textarea id="entrega" name="entrega" rows="2">{partida?.entrega ?? ''}</textarea>
			</div>
			<div class="form-group">
				<label for="entregaOma">Entrega de acuerdo con OMA</label>
				<textarea id="entregaOma" name="entregaOma" rows="2">{partida?.entregaOma ?? ''}</textarea>
			</div>
			<div class="form-group">
				<label for="entregaPropuesta">Entrega propuesta</label>
				<textarea id="entregaPropuesta" name="entregaPropuesta" rows="2"
					>{partida?.entregaPropuesta ?? ''}</textarea
				>
			</div>
			<div class="form-group">
				<label for="reportesHomologados">Reportes homologados</label>
				<textarea id="reportesHomologados" name="reportesHomologados" rows="2"
					>{partida?.reportesHomologados ?? ''}</textarea
				>
			</div>
		</div>
	</section>

	<section class="card" aria-labelledby="titulo-contenido">
		<h2 id="titulo-contenido" class="view-heading">Contenido que prellena el reporte</h2>
		<div class="form-group">
			<label for="objetivo">1. Objetivo</label>
			<textarea id="objetivo" name="objetivo" rows="3" bind:value={objetivo}></textarea>
		</div>

		<h3 class="subtitulo">2. Alcances</h3>
		<p class="view-note">
			Solo los de tipo «Alcance» entran en la captura y en la tabla de verificación.
		</p>
		<ol class="lista-editable">
			{#each alcances as alcance, i (i)}
				<li>
					<select aria-label="Tipo del renglón {i + 1}" bind:value={alcance.tipo}>
						{#each TIPOS as [valor, etiqueta] (valor)}<option value={valor}>{etiqueta}</option
							>{/each}
					</select>
					<textarea aria-label="Texto del renglón {i + 1}" rows="2" bind:value={alcance.texto}
					></textarea>
					<span class="botones-fila">
						<button
							type="button"
							class="action-btn"
							aria-label="Subir"
							on:click={() => mover(i, -1)}>↑</button
						>
						<button type="button" class="action-btn" aria-label="Bajar" on:click={() => mover(i, 1)}
							>↓</button
						>
						<button
							type="button"
							class="action-btn delete"
							aria-label="Quitar"
							on:click={() => (alcances = alcances.filter((_, j) => j !== i))}>✕</button
						>
					</span>
				</li>
			{/each}
		</ol>
		<button
			type="button"
			class="boton"
			on:click={() => (alcances = [...alcances, { tipo: 'alcance', texto: '' }])}
			>Agregar renglón</button
		>

		<h3 class="subtitulo">3. Herramientas y equipo</h3>
		<ul class="lista-editable">
			{#each herramientas as herramienta, i (i)}
				<li>
					<input
						class="campo-cantidad"
						aria-label="Cantidad {i + 1}"
						placeholder="Cantidad"
						bind:value={herramienta.cantidad}
					/>
					<input
						aria-label="Descripción {i + 1}"
						placeholder="Material o equipo"
						bind:value={herramienta.descripcion}
					/>
					<button
						type="button"
						class="action-btn delete"
						aria-label="Quitar"
						on:click={() => (herramientas = herramientas.filter((_, j) => j !== i))}>✕</button
					>
				</li>
			{/each}
		</ul>
		<button
			type="button"
			class="boton"
			on:click={() => (herramientas = [...herramientas, { cantidad: '', descripcion: '' }])}
			>Agregar herramienta</button
		>

		<div class="form-group separado">
			<label for="conclusionesBase">Texto base de conclusiones</label>
			<textarea id="conclusionesBase" name="conclusionesBase" rows="3" bind:value={conclusionesBase}
			></textarea>
		</div>
		<div class="form-grid">
			<div class="form-group">
				<label for="disposicionFotos">Disposición de las fotografías</label>
				<select
					id="disposicionFotos"
					name="disposicionFotos"
					value={partida?.disposicionFotos ?? 'cuadricula'}
				>
					<option value="cuadricula">Cuadrícula de dos columnas</option>
					<option value="antes_durante_despues">Antes, durante y después</option>
				</select>
			</div>
			<label class="casilla-sola">
				<input
					type="checkbox"
					name="proponeVerificacion"
					checked={partida?.proponeVerificacion ?? false}
				/>
				Proponer la tabla de verificación en los reportes nuevos
			</label>
		</div>
	</section>

	<section class="card" aria-labelledby="titulo-equipos-partida">
		<h2 id="titulo-equipos-partida" class="view-heading">Equipos que atiende (TAG)</h2>
		{#if equipos.length}
			<div class="casillas">
				{#each equipos as equipo (equipo.id)}
					<label>
						<input
							type="checkbox"
							checked={equipoIds.includes(equipo.id)}
							on:change={(e) => alternarEquipo(equipo.id, e.currentTarget.checked)}
						/>
						{equipo.tag}
					</label>
				{/each}
			</div>
		{:else}
			<p class="view-note">
				El sitio no tiene equipos registrados; agréguelos en la página del contrato.
			</p>
		{/if}
	</section>

	<div class="toolbar">
		<button class="primary" type="submit">Guardar partida</button>
	</div>
</form>
