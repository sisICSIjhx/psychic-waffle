<script lang="ts">
	import { onMount } from 'svelte';
	import type { AnimationItem } from 'lottie-web';

	export let ruta: string;
	let superficie: HTMLSpanElement;
	let listo = false;

	onMount(() => {
		const enlace = superficie.closest('a, button');
		const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
		let animacion: AnimationItem | undefined;
		let vigente = true;
		let solicitado = false;

		function reproducir() {
			if (preferencia.matches) return;
			solicitado = true;
			if (listo && animacion?.isPaused) animacion.goToAndPlay(0, true);
		}

		function ajustarMovimiento() {
			if (preferencia.matches) {
				solicitado = false;
				animacion?.goToAndStop(0, true);
			}
		}

		async function cargar() {
			const { default: lottie } = await import('lottie-web');
			if (!vigente) return;
			animacion = lottie.loadAnimation({
				container: superficie,
				renderer: 'svg',
				path: ruta,
				loop: false,
				autoplay: false
			});
			animacion.addEventListener('DOMLoaded', () => {
				listo = true;
				if (solicitado && enlace?.matches(':hover, :focus-visible')) reproducir();
			});
		}

		enlace?.addEventListener('mouseenter', reproducir);
		enlace?.addEventListener('focus', reproducir);
		preferencia.addEventListener('change', ajustarMovimiento);
		void cargar().catch(() => {
			// El SVG de respaldo sigue visible si el navegador no pudo cargar el reproductor.
			listo = false;
		});
		return () => {
			vigente = false;
			enlace?.removeEventListener('mouseenter', reproducir);
			enlace?.removeEventListener('focus', reproducir);
			preferencia.removeEventListener('change', ajustarMovimiento);
			animacion?.destroy();
		};
	});
</script>

<span class="icono" aria-hidden="true">
	{#if !listo}<slot />{/if}
	<span class="superficie" class:listo bind:this={superficie}></span>
</span>

<style>
	.icono {
		position: relative;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--tinta-secundaria);
	}
	:global([aria-current='page']) .icono {
		color: var(--accion);
	}
	.superficie {
		position: absolute;
		inset: 0;
		visibility: hidden;
	}
	.listo {
		visibility: visible;
	}
	.superficie :global(path[stroke^='rgb']) {
		stroke: currentColor;
	}
	.superficie :global(path[fill='rgb(0,0,0)']) {
		fill: currentColor;
	}
</style>
