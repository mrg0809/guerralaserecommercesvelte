<script lang="ts">
	import type { QuoteDraft, QuoteLine } from '$lib/types/assistant';
	import { calculateQuoteTotals } from '$lib/assistantQuoteUtils';
	import { aiFetch } from '$lib/assistantApi';

	let {
		draft = $bindable(),
		onconfirm
	}: {
		draft: QuoteDraft;
		onconfirm?: (draft: QuoteDraft) => void;
	} = $props();

	type CatalogHit = {
		id: string;
		product_id: string;
		variant_id?: string;
		description: string;
		sku?: string;
		unit_price: number;
		is_variant: boolean;
	};

	let catalogQuery = $state('');
	let catalogResults = $state<CatalogHit[]>([]);
	let catalogLoading = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

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

	function addCatalogProduct(hit: CatalogHit) {
		draft.lines = [
			...draft.lines,
			{
				id: crypto.randomUUID(),
				source: 'catalog',
				product_id: hit.product_id,
				variant_id: hit.variant_id,
				description: hit.description,
				quantity: 1,
				unit_price: hit.unit_price,
				discount_percent: 0,
				sku: hit.sku
			}
		];
		catalogQuery = '';
		catalogResults = [];
	}

	function removeLine(id: string) {
		draft.lines = draft.lines.filter((l) => l.id !== id);
	}

	function updateLine(id: string, patch: Partial<QuoteLine>) {
		draft.lines = draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
	}

	function onCatalogQueryInput(value: string) {
		catalogQuery = value;
		clearTimeout(searchTimer);
		if (value.trim().length < 2) {
			catalogResults = [];
			return;
		}
		searchTimer = setTimeout(searchCatalog, 300);
	}

	async function searchCatalog() {
		const q = catalogQuery.trim();
		if (q.length < 2) return;
		catalogLoading = true;
		try {
			const res = await aiFetch(`/api/ai/quote/products?q=${encodeURIComponent(q)}`);
			const data = await res.json();
			catalogResults = res.ok ? (data.products ?? []) : [];
		} finally {
			catalogLoading = false;
		}
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

	<div class="mb-3 relative">
		<label class="flex flex-col gap-1 text-xs text-[var(--as-text-muted)]">
			Agregar desde catálogo
			<input
				class="assistant-select w-full max-w-xl"
				value={catalogQuery}
				oninput={(e) => onCatalogQueryInput(e.currentTarget.value)}
				placeholder="Buscar por nombre o SKU..."
			/>
		</label>
		{#if catalogLoading}
			<p class="text-xs text-[var(--as-text-muted)] mt-1">Buscando...</p>
		{/if}
		{#if catalogResults.length}
			<div class="absolute z-10 mt-1 w-full max-w-xl rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] shadow-lg max-h-48 overflow-y-auto">
				{#each catalogResults as hit (hit.id)}
					<button
						type="button"
						class="w-full text-left px-3 py-2 text-sm hover:bg-[var(--as-surface-hover)] border-b border-[var(--as-border)] last:border-b-0"
						onclick={() => addCatalogProduct(hit)}
					>
						<div class="font-medium">{hit.description}</div>
						<div class="text-xs text-[var(--as-text-muted)]">
							{hit.sku ? `SKU: ${hit.sku} · ` : ''}${hit.unit_price > 0 ? `$${hit.unit_price.toFixed(2)}` : 'Sin precio — editar manual'}
						</div>
					</button>
				{/each}
			</div>
		{/if}
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
		<button type="button" class="assistant-chip" onclick={addLine}>+ Línea manual</button>
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
