<script lang="ts">
	import type { QuoteDraft, QuoteLine } from '$lib/types/assistant';
	import { calculateQuoteTotals } from '$lib/assistantQuoteUtils';

	let {
		draft = $bindable(),
		onconfirm
	}: {
		draft: QuoteDraft;
		onconfirm?: (draft: QuoteDraft) => void;
	} = $props();

	const totals = $derived(calculateQuoteTotals(draft));

	function addLine() {
		draft.lines = [
			...draft.lines,
			{
				id: crypto.randomUUID(),
				source: 'manual',
				description: '',
				quantity: 1,
				unit_price: 0,
				discount_percent: 0
			}
		];
	}

	function removeLine(id: string) {
		draft.lines = draft.lines.filter((l) => l.id !== id);
	}

	function updateLine(id: string, patch: Partial<QuoteLine>) {
		draft.lines = draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
	}
</script>

<div class="assistant-quote-editor">
	<div class="flex flex-wrap gap-3 mb-3 items-end">
		<label class="flex flex-col gap-1 text-xs text-[var(--as-text-muted)]">
			Cliente
			<input
				class="assistant-select min-w-[180px]"
				value={draft.client_name ?? ''}
				oninput={(e) => (draft.client_name = e.currentTarget.value)}
				placeholder="Nombre del cliente"
			/>
		</label>
		<label class="flex flex-col gap-1 text-xs text-[var(--as-text-muted)]">
			Envío $
			<input
				type="number"
				class="assistant-select w-24"
				value={draft.shipping_amount ?? ''}
				oninput={(e) =>
					(draft.shipping_amount = e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
			/>
		</label>
		<label class="flex flex-col gap-1 text-xs text-[var(--as-text-muted)]">
			Instalación $
			<input
				type="number"
				class="assistant-select w-24"
				value={draft.installation_amount ?? ''}
				oninput={(e) =>
					(draft.installation_amount = e.currentTarget.value
						? Number(e.currentTarget.value)
						: undefined)}
			/>
		</label>
	</div>

	<div class="overflow-x-auto">
		<table>
			<thead>
				<tr>
					<th>Descripción</th>
					<th style="width:70px">Cant.</th>
					<th style="width:90px">Precio</th>
					<th style="width:60px">Desc%</th>
					<th style="width:40px"></th>
				</tr>
			</thead>
			<tbody>
				{#each draft.lines as line (line.id)}
					<tr>
						<td>
							<input
								value={line.description}
								oninput={(e) => updateLine(line.id, { description: e.currentTarget.value })}
								placeholder="Producto o servicio"
							/>
						</td>
						<td>
							<input
								type="number"
								min="1"
								value={line.quantity}
								oninput={(e) => updateLine(line.id, { quantity: Number(e.currentTarget.value) || 1 })}
							/>
						</td>
						<td>
							<input
								type="number"
								min="0"
								step="0.01"
								value={line.unit_price}
								oninput={(e) =>
									updateLine(line.id, { unit_price: Number(e.currentTarget.value) || 0 })}
							/>
						</td>
						<td>
							<input
								type="number"
								min="0"
								max="100"
								value={line.discount_percent ?? 0}
								oninput={(e) =>
									updateLine(line.id, { discount_percent: Number(e.currentTarget.value) || 0 })}
							/>
						</td>
						<td>
							<button
								type="button"
								class="assistant-btn text-red-400"
								onclick={() => removeLine(line.id)}
								title="Eliminar">✕</button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="flex flex-wrap gap-2 mt-3 items-center justify-between">
		<button type="button" class="assistant-chip" onclick={addLine}>+ Agregar línea</button>
		<div class="text-sm">
			Total: <strong class="text-[var(--as-accent)]">${totals.total.toFixed(2)} MXN</strong>
		</div>
	</div>

	<div class="flex flex-wrap gap-2 mt-3">
		<button type="button" class="assistant-chip active" onclick={() => onconfirm?.(draft)}>
			📋 Generar texto WhatsApp
		</button>
	</div>
</div>
