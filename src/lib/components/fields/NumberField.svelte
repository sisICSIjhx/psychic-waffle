<!-- components/fields/NumberField.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label = '';
	export let name = '';
	export let value: number | null = null;
	export let min: number | null = null;
	export let max: number | null = null;
	export let step: number | 'any' = 1;
	export let placeholder = '';
	export let readonly = false;
	export let required = false;

	const dispatch = createEventDispatcher<{ change: { name: string; value: number | null } }>();

	function handleInput(event: Event) {
		const input = event.target as HTMLInputElement;
		// Campo vacío o no numérico: se informa null para no confundirlo con cero.
		const newValue =
			input.value === '' || Number.isNaN(input.valueAsNumber) ? null : input.valueAsNumber;
		dispatch('change', { name, value: newValue });
	}
</script>

<div class="form-group">
	{#if label}
		<label for={name}>{label}</label>
	{/if}
	<input
		id={name}
		{name}
		type="number"
		inputmode="decimal"
		min={min ?? undefined}
		max={max ?? undefined}
		{step}
		{placeholder}
		{readonly}
		{required}
		value={value ?? ''}
		on:input={handleInput}
	/>
</div>
