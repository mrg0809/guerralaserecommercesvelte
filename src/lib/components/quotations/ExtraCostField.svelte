<script lang="ts">
	import type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';
	import { QUOTATION_EXTRA_COST_MODE_LABELS } from '$lib/types/quotationExtraCost';

	let {
		label,
		mode = $bindable<QuotationExtraCostMode>('na'),
		amount = $bindable(0),
		selectClass = 'border rounded-md px-3 py-2 w-full',
		inputClass = 'border rounded-md px-3 py-2 w-full mt-2'
	}: {
		label: string;
		mode?: QuotationExtraCostMode;
		amount?: number;
		selectClass?: string;
		inputClass?: string;
	} = $props();
</script>

<div>
	<label class="block text-sm font-medium text-gray-700 mb-1">{label}</label>
	<select class={selectClass} bind:value={mode}>
		{#each Object.entries(QUOTATION_EXTRA_COST_MODE_LABELS) as [value, text]}
			<option value={value}>{text}</option>
		{/each}
	</select>
	{#if mode === 'cost'}
		<input
			type="number"
			step="0.01"
			min="0"
			class={inputClass}
			bind:value={amount}
			placeholder="0.00"
		/>
	{/if}
</div>
