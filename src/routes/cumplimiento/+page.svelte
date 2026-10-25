<script lang="ts">
	import CumplimientoView from '$lib/components/views/CumplimientoView.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<CumplimientoView {...data} />
