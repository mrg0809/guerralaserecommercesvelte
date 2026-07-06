<script lang="ts">
	import type { QuoteDraft, QuoteLine, CatalogProductHit } from '$lib/types/assistant';
	import { calculateQuoteTotals } from '$lib/assistantQuoteUtils';
	import { displayQuotationAmount } from '$lib/utils/quotationTax';
	import { aiFetch } from '$lib/assistantApi';

	let {
		draft = $bindable(),
		onconfirm,
		onsave,
		saving = false,
		savedId = null
	}: {
		draft: QuoteDraft;
		onconfirm?: (draft: QuoteDraft) => void;
		onsave?: (draft: QuoteDraft) => void | Promise<void>;
		saving?: boolean;
		savedId?: string | null;
	} = $props();

	let catalogQuery = $state('');
	let catalogResults = $state<CatalogProductHit[]>([]);
	let catalogLoading = $state(false);
	let includeAllDetails = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const totals = $derived(calculateQuoteTotals(draft));

	function lineTotal(line: QuoteLine) {
		const discount = line.discount_percent ?? 0;
		return line.quantity * line.unit_price * (1 - discount / 100);
	}

	function displayUnitPrice(line: QuoteLine) {
		return displayQuotationAmount(line.unit_price, draft.prices_exclude_iva ?? false);
	}

	function displayLineTotal(line: QuoteLine) {
		return displayQuotationAmount(lineTotal(line), draft.prices_exclude_iva ?? false);
	}

	function addLine() {
		draft.lines = [
			...draft.lines,
			{
				id: crypto.randomUUID(),
				source: 'manual',
				description: '',
				quantity: 1,
				unit_price: 0,
				discount_percent: 0,
				detail_description: '',
				include_detail: false
			}
		];
	}

	function addCatalogProduct(hit: CatalogProductHit) {
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
				sku: hit.sku,
				image_url: hit.image_url,
				catalog_detail: hit.catalog_detail,
				detail_description: '',
				include_detail: false
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

	function fillDetailFromCatalog(lineId: string) {
		const line = draft.lines.find((l) => l.id === lineId);
		if (!line?.catalog_detail) return;
		updateLine(lineId, {
			detail_description: line.catalog_detail,
			include_detail: true
		});
	}

	function toggleIncludeAllDetails() {
		for (const line of draft.lines) {
			line.include_detail = includeAllDetails;
			if (includeAllDetails && !line.detail_description?.trim() && line.catalog_detail) {
				line.detail_description = line.catalog_detail;
			}
		}
		draft.lines = [...draft.lines];
	}

	function toggleLineDetail(lineId: string, include: boolean) {
		const line = draft.lines.find((l) => l.id === lineId);
		if (!line) return;
		const patch: Partial<QuoteLine> = { include_detail: include };
		if (include && !line.detail_description?.trim() && line.catalog_detail) {
			patch.detail_description = line.catalog_detail;
		}
		updateLine(lineId, patch);
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
		<label class="flex items-center gap-2 text-xs text-[var(--as-text-muted)] self-end pb-1">
			<input
				type="checkbox"
				class="rounded"
				checked={draft.prices_exclude_iva ?? false}
				onchange={(e) => (draft.prices_exclude_iva = e.currentTarget.checked)}
			/>
			Precios sin IVA
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
						class="w-full text-left px-3 py-2 text-sm hover:bg-[var(--as-surface-hover)] border-b border-[var(--as-border)] last:border-b-0 flex gap-3 items-center"
						onclick={() => addCatalogProduct(hit)}
					>
						{#if hit.image_url}
							<img src={hit.image_url} alt="" class="h-10 w-10 object-contain rounded border border-[var(--as-border)] bg-white shrink-0" />
						{:else}
							<span class="h-10 w-10 shrink-0"></span>
						{/if}
						<div class="min-w-0">
							<div class="font-medium">{hit.description}</div>
							<div class="text-xs text-[var(--as-text-muted)]">
								{hit.sku ? `SKU: ${hit.sku} · ` : ''}{hit.unit_price > 0 ? `$${hit.unit_price.toFixed(2)}` : 'Sin precio — editar manual'}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-center justify-between gap-2 mb-2">
		<label class="flex items-center gap-2 text-xs text-[var(--as-text-muted)]">
			<input
				type="checkbox"
				class="rounded"
				bind:checked={includeAllDetails}
				onchange={toggleIncludeAllDetails}
			/>
			Incluir descripciones detalladas en el PDF
		</label>
	</div>

	<div class="overflow-x-auto">
		<table>
			<thead>
				<tr>
					<th style="width:52px">Foto</th>
					<th>Descripción</th>
					<th style="width:70px">Cant.</th>
					<th style="width:90px">
						Precio{draft.prices_exclude_iva ? ' s/IVA' : ''}
					</th>
					<th style="width:60px">Desc%</th>
					<th style="width:70px">
						Total{draft.prices_exclude_iva ? ' s/IVA' : ''}
					</th>
					<th style="width:40px"></th>
				</tr>
			</thead>
			<tbody>
				{#each draft.lines as line (line.id)}
					<tr>
						<td class="align-middle text-center">
							{#if line.image_url}
								<img src={line.image_url} alt="" class="h-10 w-10 object-contain mx-auto rounded border border-[var(--as-border)] bg-white" />
							{/if}
						</td>
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
							{#if draft.prices_exclude_iva}
								<p class="text-[10px] text-[var(--as-text-muted)] mt-1">
									s/IVA: ${displayUnitPrice(line).toFixed(2)}
								</p>
							{/if}
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
						<td class="text-right text-sm whitespace-nowrap">${displayLineTotal(line).toFixed(2)}</td>
						<td>
							<button
								type="button"
								class="assistant-btn text-red-400"
								onclick={() => removeLine(line.id)}
								title="Eliminar">✕</button
							>
						</td>
					</tr>
					<tr>
						<td colspan="7" class="!py-2 !px-2 bg-[var(--as-surface-hover)]/40">
							<label class="flex items-center gap-2 text-xs text-[var(--as-text-muted)] mb-2">
								<input
									type="checkbox"
									class="rounded"
									checked={line.include_detail}
									onchange={(e) => toggleLineDetail(line.id, e.currentTarget.checked)}
								/>
								Incluir descripción detallada en el PDF
							</label>
							{#if line.include_detail}
								<textarea
									class="assistant-select w-full min-h-[80px] text-sm"
									value={line.detail_description ?? ''}
									oninput={(e) => updateLine(line.id, { detail_description: e.currentTarget.value })}
									placeholder="Características, especificaciones técnicas..."
								></textarea>
								<div class="flex flex-wrap gap-2 mt-2">
									{#if line.catalog_detail}
										<button
											type="button"
											class="assistant-chip text-xs"
											onclick={() => fillDetailFromCatalog(line.id)}
										>
											Usar descripción del catálogo
										</button>
									{/if}
								</div>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="flex flex-wrap gap-2 mt-3 items-center justify-between">
		<button type="button" class="assistant-chip" onclick={addLine}>+ Línea manual</button>
		<div class="text-sm space-y-1 text-right">
			{#if totals.shipping > 0}
				<div class="text-[var(--as-text-muted)]">Envío: ${totals.shipping.toFixed(2)}</div>
			{/if}
			{#if totals.installation > 0}
				<div class="text-[var(--as-text-muted)]">Instalación: ${totals.installation.toFixed(2)}</div>
			{/if}
			<div class="text-[var(--as-text-muted)]">Subtotal (sin IVA): ${totals.subtotalSinIva.toFixed(2)}</div>
			<div class="text-[var(--as-text-muted)]">IVA (16%): ${totals.iva.toFixed(2)}</div>
			<div>
				Total: <strong class="text-[var(--as-accent)]">${totals.total.toFixed(2)} MXN</strong>
			</div>
		</div>
	</div>

	<div class="flex flex-wrap gap-2 mt-3">
		<button type="button" class="assistant-chip active" onclick={() => onconfirm?.(draft)}>
			📋 Generar texto WhatsApp
		</button>
		{#if onsave}
			<button
				type="button"
				class="assistant-chip"
				disabled={saving || !draft.lines.length}
				onclick={() => onsave?.(draft)}
			>
				{#if saving}
					⏳ Guardando...
				{:else if savedId}
					💾 Actualizar guardada
				{:else}
					💾 Guardar cotización
				{/if}
			</button>
		{/if}
	</div>
</div>
