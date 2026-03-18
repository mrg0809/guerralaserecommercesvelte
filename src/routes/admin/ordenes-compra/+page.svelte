<script lang="ts">
	import { supabase } from '$lib/supabaseClient';

	type PO = {
		id: string;
		po_number: string;
		supplier_name: string | null;
		status: string;
		currency: string;
		created_at: string;
		purchase_order_items?: any[];
	};

	const supabaseAny: any = supabase;

	let loading = $state(true);
	let pos: PO[] = $state([]);
	let filterStatus = $state<string>('all');

	let createOpen = $state(false);
	let receivingOpen = $state(false);
	let activePO: PO | null = $state(null);

	// Formulario de creación
	let form = $state({
		po_number: '',
		supplier_name: '',
		items: [] as Array<{
			product_id: string;
			variant_id: string | null;
			quantity_ordered: number;
			unit_cost_usd: number;
		}>
	});

	// Search / add items
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let selectedProduct = $state<any | null>(null);
	let selectedVariantId = $state<string | null>(null);
	let itemQty = $state(1);
	let itemUnitCostUsd = $state(0);

	function genPoNumber() {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
		return `PO-${y}${m}${day}-${rand}`;
	}

	function resetCreateForm() {
		form = {
			po_number: genPoNumber(),
			supplier_name: '',
			items: []
		};

		searchQuery = '';
		searchResults = [];
		selectedProduct = null;
		selectedVariantId = null;
		itemQty = 1;
		itemUnitCostUsd = 0;
	}

	async function loadPOs() {
		loading = true;
		try {
			let query = supabaseAny
				.from('purchase_orders')
				.select('*, purchase_order_items(*)')
				.order('created_at', { ascending: false });

			if (filterStatus !== 'all') {
				query = query.eq('status', filterStatus);
			}

			const { data } = await query;
			pos = (data ?? []) as PO[];
		} finally {
			loading = false;
		}
	}

	// Cuando cambie el filtro, recargar
	$effect(() => {
		void filterStatus;
		void loadPOs();
	});

	function openCreate() {
		createOpen = true;
		resetCreateForm();
	}

	function openReceiving(po: PO) {
		activePO = po;
		receivingOpen = true;
	}

	function closeModals() {
		createOpen = false;
		receivingOpen = false;
		activePO = null;
	}

	async function searchProducts() {
		const q = searchQuery.trim();
		if (!q) {
			searchResults = [];
			return;
		}

		const { data } = await supabaseAny
			.from('products')
			.select('id, name, sku, product_variants(id, name, sku, is_active)')
			.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
			.eq('is_active', true)
			.limit(8);

		searchResults = data ?? [];
	}

	function getVariantCandidates(product: any) {
		const variants = product?.product_variants ?? [];
		return variants.filter((v: any) => v.is_active !== false);
	}

	function addCurrentItem() {
		if (!selectedProduct) return;

		const variants = getVariantCandidates(selectedProduct);
		const variantIdToUse = variants.length > 0 ? selectedVariantId : null;

		if (itemQty <= 0) {
			alert('La cantidad debe ser mayor a 0');
			return;
		}
		if (itemUnitCostUsd < 0) {
			alert('El costo USD no puede ser negativo');
			return;
		}

		// Si tiene variantes, necesitamos que se haya elegido una.
		if (variants.length > 0 && !variantIdToUse) {
			alert('Selecciona una variante');
			return;
		}

		form.items = [
			...form.items,
			{
				product_id: selectedProduct.id,
				variant_id: variantIdToUse,
				quantity_ordered: Math.floor(itemQty),
				unit_cost_usd: Number(itemUnitCostUsd)
			}
		];

		// Reset de selección para siguiente item
		searchQuery = '';
		searchResults = [];
		selectedProduct = null;
		selectedVariantId = null;
		itemQty = 1;
		itemUnitCostUsd = 0;
	}

	async function createPO() {
		if (form.items.length === 0) {
			alert('Agrega al menos un artículo a la orden');
			return;
		}

		const { data: createdPO, error } = await supabaseAny
			.from('purchase_orders')
			.insert({
				po_number: form.po_number,
				supplier_name: form.supplier_name.trim() || null,
				status: 'draft',
				currency: 'USD'
			})
			.select()
			.single();

		if (error) {
			alert('Error al crear orden: ' + error.message);
			return;
		}

		const purchase_order_id = createdPO.id;

		const itemsPayload = form.items.map((it) => ({
			purchase_order_id,
			product_id: it.product_id,
			variant_id: it.variant_id,
			quantity_ordered: it.quantity_ordered,
			unit_cost_usd: it.unit_cost_usd
		}));

		const { error: itemsError } = await supabaseAny.from('purchase_order_items').insert(itemsPayload);
		if (itemsError) {
			alert('Error al guardar artículos: ' + itemsError.message);
			return;
		}

		createOpen = false;
		await loadPOs();
	}

	async function receiveItem(item: any, qty: number) {
		if (!activePO) return;

		const remaining = item.quantity_ordered - item.quantity_received;
		if (qty <= 0) return;
		if (qty > remaining) {
			alert('La cantidad recibida supera el pendiente');
			return;
		}

		// 1) Guardar recibo (historial)
		const { error: receiptError } = await supabaseAny.from('purchase_order_receipts').insert({
			purchase_order_item_id: item.id,
			received_quantity: qty
		});

		if (receiptError) {
			alert('Error al registrar recibo: ' + receiptError.message);
			return;
		}

		// 2) Actualizar quantity_received
		const newReceived = item.quantity_received + qty;
		const { error: itemError } = await supabaseAny
			.from('purchase_order_items')
			.update({ quantity_received: newReceived })
			.eq('id', item.id);

		if (itemError) {
			alert('Error al actualizar inventario (PO item): ' + itemError.message);
			return;
		}

		// 3) Incrementar inventario en products o product_variants
		if (item.variant_id) {
			const { error: incError } = await supabaseAny.rpc('increment_product_variant_stock', {
				p_variant_id: item.variant_id,
				p_qty: qty
			});
			if (incError) {
				alert('Error al incrementar stock de variante: ' + incError.message);
				return;
			}
		} else {
			const { error: incError } = await supabaseAny.rpc('increment_product_stock', {
				p_product_id: item.product_id,
				p_qty: qty
			});
			if (incError) {
				alert('Error al incrementar stock del producto: ' + incError.message);
				return;
			}
		}

		// 3.5) Actualizar Costo unitario USD del producto (último costo)
		const unitCostUsd = Number(item.unit_cost_usd ?? 0);
		const { error: costError } = await supabaseAny.rpc('set_product_cost_usd', {
			p_product_id: item.product_id,
			p_unit_cost_usd: unitCostUsd
		});
		if (costError) {
			alert('Error al actualizar costo USD: ' + costError.message);
			return;
		}

		// 4) Actualizar status de la PO si ya está completamente recibida
		const { data: allItems } = await supabaseAny
			.from('purchase_order_items')
			.select('quantity_ordered, quantity_received')
			.eq('purchase_order_id', item.purchase_order_id ?? activePO.id);

		if (Array.isArray(allItems) && allItems.length > 0) {
			const isFullyReceived = allItems.every((it: any) => (it.quantity_received ?? 0) >= (it.quantity_ordered ?? 0));
			if (isFullyReceived) {
				await supabaseAny.from('purchase_orders').update({ status: 'received' }).eq('id', activePO.id);
			}
		}

		alert('Recibido y stock actualizado');
		closeModals();
		await loadPOs();
	}

	function remainingForItem(item: any) {
		return Math.max(0, (item.quantity_ordered ?? 0) - (item.quantity_received ?? 0));
	}
</script>

<svelte:head>
	<title>Órdenes de Compra - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Órdenes de Compra</h1>
		<div class="flex gap-3 items-center">
			<a
				href="/admin/inventario"
				class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
			>
				← Volver
			</a>
			<button
				type="button"
				onclick={openCreate}
				disabled={loading}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
			>
				+ Nueva Orden
			</button>
		</div>
	</div>

	<div class="mb-6 flex flex-wrap gap-2">
		<button
			type="button"
			onclick={() => (filterStatus = 'all')}
			class="px-4 py-2 rounded-lg {filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
		>
			Todas
		</button>
		{#each ['draft', 'received', 'cancelled'] as st}
			<button
				type="button"
				onclick={() => (filterStatus = st)}
				class="px-4 py-2 rounded-lg {filterStatus === st ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
			>
				{st === 'draft' ? 'Borrador' : st === 'received' ? 'Recibida' : 'Cancelada'}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando órdenes...</p>
		</div>
	{:else if pos.length === 0}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-xl text-gray-600">No hay órdenes</p>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow-md overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-100">
					<tr>
						<th class="px-4 py-3 text-left">PO</th>
						<th class="px-4 py-3 text-left">Proveedor</th>
						<th class="px-4 py-3 text-left">Estado</th>
						<th class="px-4 py-3 text-right">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each pos as po}
						<tr class="border-t hover:bg-gray-50">
							<td class="px-4 py-3 font-mono text-sm">{po.po_number}</td>
							<td class="px-4 py-3">{po.supplier_name || '-'}</td>
							<td class="px-4 py-3">
								<span class="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
									{po.status}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<button
									type="button"
									onclick={() => openReceiving(po)}
									class="text-blue-600 hover:text-blue-800"
								>
									Recibir
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if createOpen}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
			<div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
				<h2 class="text-2xl font-bold">Nueva Orden de Compra</h2>
				<button type="button" onclick={() => (createOpen = false)} class="text-gray-500 hover:text-gray-700 text-2xl">
					×
				</button>
			</div>

			<div class="p-6 space-y-6">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-semibold mb-2" for="po-number">Número PO</label>
						<input id="po-number" type="text" bind:value={form.po_number} class="w-full px-3 py-2 border rounded-lg" />
					</div>
					<div>
						<label class="block text-sm font-semibold mb-2" for="supplier">Proveedor</label>
						<input id="supplier" type="text" bind:value={form.supplier_name} class="w-full px-3 py-2 border rounded-lg" />
					</div>
				</div>

				<div class="border rounded-lg p-4 bg-gray-50 space-y-4">
					<h3 class="font-bold">Agregar Artículos</h3>

					<div class="flex gap-3 items-center">
						<input
							type="text"
							placeholder="Buscar por nombre o SKU..."
							bind:value={searchQuery}
							class="flex-1 px-3 py-2 border rounded-lg"
							oninput={() => {
								// Simple: disparar búsqueda cuando exista texto
								void searchProducts();
							}}
						/>
					</div>

					{#if searchResults.length > 0}
						<div class="max-h-48 overflow-y-auto border rounded-lg bg-white">
							{#each searchResults as p}
								<button
									type="button"
									onclick={() => {
										selectedProduct = p;
										const variants = getVariantCandidates(p);
										selectedVariantId = variants.length ? variants[0].id : null;
									}}
									class="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
								>
									<div class="font-semibold">{p.name}</div>
									<div class="text-xs text-gray-600">{p.sku || '-'}</div>
								</button>
							{/each}
						</div>
					{/if}

					{#if selectedProduct}
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div class="md:col-span-1">
								<div class="block text-sm font-semibold mb-2">Artículo</div>
								<div class="p-3 border rounded-lg bg-white">
									<div class="font-semibold">{selectedProduct.name}</div>
									<div class="text-xs text-gray-600">{selectedProduct.sku || '-'}</div>
								</div>
							</div>

							<div class="md:col-span-1">
								<div class="block text-sm font-semibold mb-2">Variante</div>
								{#if getVariantCandidates(selectedProduct).length > 0}
									<select
										bind:value={selectedVariantId}
										class="w-full px-3 py-2 border rounded-lg"
									>
										{#each getVariantCandidates(selectedProduct) as v}
											<option value={v.id}>
												{v.name || v.sku || 'Variante'}
											</option>
										{/each}
									</select>
								{:else}
									<input type="text" value="(Sin variantes)" disabled class="w-full px-3 py-2 border rounded-lg bg-gray-100" />
								{/if}
							</div>

							<div class="md:col-span-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label class="block text-sm font-semibold mb-2" for="qty">Cantidad</label>
									<input id="qty" type="number" min="1" bind:value={itemQty} class="w-full px-3 py-2 border rounded-lg" />
								</div>
								<div>
									<label class="block text-sm font-semibold mb-2" for="cost">Costo USD</label>
									<input id="cost" type="number" min="0" step="0.01" bind:value={itemUnitCostUsd} class="w-full px-3 py-2 border rounded-lg" />
								</div>
							</div>
						</div>

						<div class="flex justify-end">
							<button type="button" onclick={addCurrentItem} class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
								+ Agregar a la orden
							</button>
						</div>
					{/if}
				</div>

				<div class="border rounded-lg p-4">
					<h3 class="font-bold mb-3">Artículos en la orden</h3>
					{#if form.items.length === 0}
						<p class="text-gray-600">Aún no agregaste artículos.</p>
					{:else}
						<div class="space-y-2">
							{#each form.items as it, idx (it.product_id + (it.variant_id || ''))}
								<div class="flex items-center justify-between gap-3 border rounded-lg p-3 bg-white">
									<div class="min-w-0">
										<div class="font-semibold text-sm truncate">
											{it.variant_id ? `Variante` : `Producto`}
										</div>
										<div class="text-xs text-gray-600">
											Cant: {it.quantity_ordered} - Costo USD: {Number(it.unit_cost_usd).toFixed(2)}
										</div>
									</div>
									<button
										type="button"
										onclick={() => (form.items = form.items.filter((_, i) => i !== idx))}
										class="text-red-600 hover:text-red-800"
									>
										Eliminar
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex gap-3 justify-end">
					<button type="button" onclick={() => (createOpen = false)} class="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
						Cancelar
					</button>
					<button
						type="button"
						onclick={createPO}
						disabled={form.items.length === 0}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						Crear Orden
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if receivingOpen && activePO}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
			<div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
				<h2 class="text-2xl font-bold">Recibir Orden {activePO.po_number}</h2>
				<button type="button" onclick={() => (receivingOpen = false)} class="text-gray-500 hover:text-gray-700 text-2xl">
					×
				</button>
			</div>

			<div class="p-6 space-y-4">
				<p class="text-sm text-gray-600">
					Proveedor: <span class="font-semibold">{activePO.supplier_name || '-'}</span> ·
					Items: <span class="font-semibold">{activePO.purchase_order_items?.length || 0}</span>
				</p>

				{#if activePO.purchase_order_items && activePO.purchase_order_items.length > 0}
					<div class="space-y-3">
						{#each activePO.purchase_order_items as item}
							<div class="border rounded-lg p-4 bg-gray-50">
								<div class="flex justify-between gap-3 items-start">
									<div>
										<div class="font-semibold">
											{item.variant_id ? 'Variante' : 'Producto'}
										</div>
										<div class="text-xs text-gray-600 mt-1">
											Ordenado: {item.quantity_ordered} · Recibido: {item.quantity_received} · Pendiente: {remainingForItem(item)}
										</div>
										<div class="text-xs text-gray-600 mt-1">
											Costo USD unitario: {Number(item.unit_cost_usd ?? 0).toFixed(2)}
										</div>
									</div>
								</div>

								{#if remainingForItem(item) > 0}
									<div class="mt-3 flex gap-3 items-center">
										<input
											type="number"
											min="1"
											max={remainingForItem(item)}
										value={(item as any).__recvQty ?? remainingForItem(item)}
											oninput={(e) => {
												// Guardar input en una propiedad temporal en el item
												(item as any).__recvQty = Number((e.currentTarget as HTMLInputElement).value);
											}}
											class="w-32 px-3 py-2 border rounded-lg"
										/>
										<button
											type="button"
											onclick={() => receiveItem(item, Number((item as any).__recvQty ?? remainingForItem(item)))}
											class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
										>
											Recibir
										</button>
									</div>
								{:else}
									<div class="mt-3 text-sm text-gray-600">Pendiente: 0</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-gray-600">No hay items en esta orden.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

