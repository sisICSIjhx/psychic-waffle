<!-- components/fields/TextAreaField.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label = '';
	export let name = '';
	export let value = '';
	export let placeholder = '';
	export let rows = 4;
	export let maxlength: number | null = null;
	export let readonly = false;
	export let required = false;

	const dispatch = createEventDispatcher<{ change: { name: string; value: string } }>();

	function handleInput(event: Event) {
		const newValue = (event.target as HTMLTextAreaElement).value;
		dispatch('change', { name, value: newValue });
	}
</script>

<div class="form-group">
	{#if label}
		<label for={name}>{label}</label>
	{/if}
	<textarea
		id={name}
		{name}
		{rows}
		{placeholder}
		maxlength={maxlength ?? undefined}
		{readonly}
		{required}
		{value}
		on:input={handleInput}
	></textarea>
</div>
