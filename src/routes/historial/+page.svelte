<script lang="ts">
	import HistorialView from '$lib/components/views/HistorialView.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<HistorialView {...data} />
