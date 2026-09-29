<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice, textMatchesSearch } from '$lib/utils';
	import {
		expandLabelCopies,
		openProductLabelsPdf,
		type ProductLabelFormat
	} from '$lib/productLabelPdf';

	type Category = {
		id: string;
		name: string;
		parent_id: string | null;
		is_active: boolean | null;
	};

	type LabelRow = {
		key: string;
		productId: string;
		categoryId: string | null;
		name: string;
		sku: string;
		price: number;
		stock: number;
		quantity: number;
	};

	let loading = $state(true);
	let printing = $state(false);
	let categories: Category[] = $state([]);
	let categoryHierarchy: Record<string, string> = $state({});
	let rows: LabelRow[] = $state([]);
	let searchQuery = $state('');
	let selectedCategoryFilter = $state('');
	let format: ProductLabelFormat = $state('small');

	let sortedCategories = $derived.by(() => {
		return [...categories].sort((a, b) => {
			const nameA = categoryHierarchy[a.id] || a.name;
			const nameB = categoryHierarchy[b.id] || b.name;
			return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
		});
	});

	function getChildCategoryIds(categoryId: string): string[] {
		const childIds: string[] = [categoryId];
		for (const child of categories.filter((c) => c.parent_id === categoryId)) {
			childIds.push(...getChildCategoryIds(child.id));
		}
		return childIds;
	}

	let filteredRows = $derived.by(() => {
		let list = rows;
		if (searchQuery.trim()) {
			const q = searchQuery.trim();
			list = list.filter(
				(r) => textMatchesSearch(r.name, q) || textMatchesSearch(r.sku, q)
			);
		}
		if (selectedCategoryFilter) {
			const ids = getChildCategoryIds(selectedCategoryFilter);
			list = list.filter((r) => r.categoryId && ids.includes(r.categoryId));
		}
		return list;
	});

	let printCount = $derived(
		filteredRows.reduce((sum, r) => sum + Math.max(0, Math.floor(r.quantity) || 0), 0)
	);

	function buildCategoryHierarchy() {
		const map: Record<string, string> = {};
		for (const cat of categories) {
			if (cat.parent_id) {
				const parent = categories.find((c) => c.id === cat.parent_id);
				map[cat.id] = parent ? `${parent.name} → ${cat.name}` : cat.name;
			} else {
				map[cat.id] = cat.name;
			}
		}
		categoryHierarchy = map;
	}

	async function loadData() {
		loading = true;
		try {
			const [{ data: catData, error: catError }, { data: productData, error: productError }] =
				await Promise.all([
					supabase
						.from('categories')
						.select('id, name, parent_id, is_active')
						.eq('is_active', true),
					supabase
						.from('products')
						.select(
							'id, name, sku, base_price, stock_quantity, category_id, is_active, product_variants(id, name, sku, price, stock_quantity, is_active)'
						)
						.order('name')
				]);

			if (catError) throw catError;
			if (productError) throw productError;

			categories = (catData ?? []) as Category[];
			buildCategoryHierarchy();

			const next: LabelRow[] = [];
			for (const product of productData ?? []) {
				const variants = ((product as any).product_variants ?? []).filter(
					(v: { is_active?: boolean | null }) => v.is_active !== false
				);
				if (variants.length > 0) {
					for (const variant of variants) {
						const sku = String(variant.sku || '').trim();
						if (!sku) continue;
						const variantName = String(variant.name || '').trim();
						next.push({
							key: `v-${variant.id}`,
							productId: product.id,
							categoryId: product.category_id,
							name: variantName ? `${product.name} — ${variantName}` : product.name,
							sku,
							price: Number(variant.price ?? product.base_price ?? 0),
							stock: Number(variant.stock_quantity ?? 0),
							quantity: 0
						});
					}
				} else {
					const sku = String(product.sku || '').trim();
					if (!sku) continue;
					next.push({
						key: `p-${product.id}`,
						productId: product.id,
						categoryId: product.category_id,
						name: product.name,
						sku,
						price: Number(product.base_price ?? 0),
						stock: Number(product.stock_quantity ?? 0),
						quantity: 0
					});
				}
			}
			rows = next;
		} catch (e: any) {
			alert(e?.message || 'No se pudo cargar el inventario de etiquetas.');
			rows = [];
		} finally {
			loading = false;
		}
	}

	function setQuantity(key: string, value: string) {
		const qty = Math.max(0, Math.floor(Number(value) || 0));
		rows = rows.map((r) => (r.key === key ? { ...r, quantity: qty } : r));
	}

	function setVisibleQuantities(qty: number) {
		const keys = new Set(filteredRows.map((r) => r.key));
		const n = Math.max(0, Math.floor(qty));
		rows = rows.map((r) => (keys.has(r.key) ? { ...r, quantity: n } : r));
	}

	async function printSelected() {
		const copies: ReturnType<typeof expandLabelCopies> = [];
		for (const row of filteredRows) {
			copies.push(
				...expandLabelCopies(
					{ name: row.name, sku: row.sku, price: row.price },
					row.quantity
				)
			);
		}
		if (copies.length === 0) {
			alert('Indica al menos 1 etiqueta en algún artículo visible.');
			return;
		}
		printing = true;
		try {
			await openProductLabelsPdf(copies, window.location.origin, format);
		} catch (e: any) {
			alert(e?.message || 'No se pudo generar el PDF de etiquetas.');
		} finally {
			printing = false;
		}
	}

	onMount(loadData);
</script>

<svelte:head>
	<title>Impresión de etiquetas - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex flex-wrap justify-between items-center gap-4 mb-8">
		<div>
			<h1 class="text-4xl font-bold">Impresión de etiquetas</h1>
			<p class="text-sm text-gray-600 mt-1">
				Elige categoría, cantidades y formato. Grande: 60×40 mm con código de barras. Chica: 90,3×29 mm
				con QR (sin Code128).
			</p>
		</div>
		<a href="/admin/productos" class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
			← Productos
		</a>
	</div>

	<div class="bg-white rounded-lg shadow-md p-4 mb-6 space-y-4">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="md:col-span-2">
				<label class="block text-sm font-medium mb-2" for="label-search">Buscar por nombre o SKU</label>
				<input
					id="label-search"
					type="text"
					bind:value={searchQuery}
					placeholder="Fuente, REF-…"
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
				/>
			</div>
			<div>
				<label class="block text-sm font-medium mb-2" for="label-category">Categoría (incluye subcategorías)</label>
				<select
					id="label-category"
					bind:value={selectedCategoryFilter}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
				>
					<option value="">Todas</option>
					{#each sortedCategories as category}
						<option value={category.id}>{categoryHierarchy[category.id] || category.name}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="flex flex-wrap items-end gap-4 pt-2 border-t">
			<fieldset>
				<legend class="text-sm font-medium mb-2">Formato</legend>
				<div class="flex gap-4">
					<label class="inline-flex items-center gap-2 text-sm">
						<input type="radio" bind:group={format} value="large" />
						Grande 60×40 mm
					</label>
					<label class="inline-flex items-center gap-2 text-sm">
						<input type="radio" bind:group={format} value="small" />
						Chica 90,3×29 mm
					</label>
				</div>
			</fieldset>
			<button
				type="button"
				onclick={() => setVisibleQuantities(1)}
				disabled={loading || filteredRows.length === 0}
				class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-50"
			>
				1 etiqueta a las visibles
			</button>
			<button
				type="button"
				onclick={() => setVisibleQuantities(0)}
				disabled={loading}
				class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-50"
			>
				Poner visibles en 0
			</button>
			<button
				type="button"
				onclick={printSelected}
				disabled={printing || printCount === 0}
				class="ml-auto px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
			>
				{printing ? 'Generando…' : `Imprimir ${printCount} etiqueta(s)`}
			</button>
		</div>
		<p class="text-sm text-gray-600">
			Mostrando {filteredRows.length} SKU
			{#if selectedCategoryFilter || searchQuery}
				<button
					type="button"
					class="ml-2 text-amber-700 hover:underline"
					onclick={() => {
						searchQuery = '';
						selectedCategoryFilter = '';
					}}
				>
					Limpiar filtros
				</button>
			{/if}
		</p>
	</div>

	{#if loading}
		<p class="text-center py-12 text-gray-600">Cargando inventario…</p>
	{:else if filteredRows.length === 0}
		<p class="text-center py-12 text-gray-600">No hay artículos con SKU para estos filtros.</p>
	{:else}
		<div class="bg-white rounded-lg shadow-md overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-gray-100">
					<tr>
						<th class="px-4 py-3 text-left">Artículo</th>
						<th class="px-4 py-3 text-left">SKU</th>
						<th class="px-4 py-3 text-left">Precio</th>
						<th class="px-4 py-3 text-left">Stock</th>
						<th class="px-4 py-3 text-right w-36">Etiquetas</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredRows as row (row.key)}
						<tr class="border-t hover:bg-gray-50">
							<td class="px-4 py-2 font-medium">{row.name}</td>
							<td class="px-4 py-2 font-mono text-xs">{row.sku}</td>
							<td class="px-4 py-2">{formatPrice(row.price)}</td>
							<td class="px-4 py-2">{row.stock}</td>
							<td class="px-4 py-2 text-right">
								<input
									type="number"
									min="0"
									step="1"
									value={row.quantity}
									onchange={(e) => setQuantity(row.key, e.currentTarget.value)}
									class="w-20 px-2 py-1 border rounded-lg text-right"
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
