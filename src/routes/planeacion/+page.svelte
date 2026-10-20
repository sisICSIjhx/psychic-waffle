<script lang="ts">
	import PlaneacionView from '$lib/components/views/PlaneacionView.svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<PlaneacionView {...data} {form} />
