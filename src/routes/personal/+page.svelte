<script lang="ts">
	import PersonalView from '$lib/components/views/PersonalView.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<PersonalView personal={data.personal} puedeEditar={data.puedeEditar} />
