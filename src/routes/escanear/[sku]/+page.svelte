<script lang="ts">
	import { userStore } from '$lib/stores/user';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice } from '$lib/utils';
	import { getImageKitUrl } from '$lib/storage';
	import { getPrimaryProductImageUrl } from '$lib/utils/productMedia';
	import FormattedText from '$lib/components/FormattedText.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let stockInput = $state(String(data.stock_quantity ?? 0));
	let currentStock = $state(data.stock_quantity ?? 0);
	let saving = $state(false);
	let saveMessage = $state('');
	let saveError = $state('');

	$effect(() => {
		stockInput = String(data.stock_quantity ?? 0);
		currentStock = data.stock_quantity ?? 0;
	});

	const canManageStock = $derived(
		$userStore.initialized &&
			!!$userStore.user &&
			$userStore.permissions.includes('manage_inventory')
	);

	const imageUrl = $derived.by(() => {
		const attrs = data.attributes;
		const variantImage =
			attrs && typeof attrs.image_url === 'string' ? attrs.image_url.trim() : '';
		if (variantImage) return getImageKitUrl(variantImage);
		return getPrimaryProductImageUrl(
			data.media as Array<{ url?: string | null; is_primary?: boolean | null; display_order?: number | null }>
		);
	});

	const specRows = $derived.by(() => {
		const specs = (data.specifications ?? []) as Array<{
			specification_key?: string | null;
			specification_value?: string | null;
		}>;
		return specs.filter((s) => s.specification_key);
	});

	const attrRows = $derived.by(() => {
		const attrs = data.attributes;
		if (!attrs) return [] as Array<{ key: string; value: string }>;
		const keys = ['color', 'grosor', 'tamano', 'tamaño'];
		const rows: Array<{ key: string; value: string }> = [];
		for (const key of keys) {
			const value = attrs[key];
			if (value === undefined || value === null || value === '') continue;
			if (typeof value === 'boolean' || typeof value === 'object') continue;
			rows.push({ key, value: String(value) });
		}
		return rows;
	});

	async function saveStock(e: Event) {
		e.preventDefault();
		saveMessage = '';
		saveError = '';
		const qty = Math.floor(Number(stockInput));
		if (!Number.isFinite(qty) || qty < 0) {
			saveError = 'Indica un número de piezas válido (0 o más).';
			return;
		}

		saving = true;
		try {
			if (data.kind === 'variant' && data.variantId) {
				const { error } = await supabase
					.from('product_variants')
					.update({ stock_quantity: qty })
					.eq('id', data.variantId);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('products')
					.update({ stock_quantity: qty })
					.eq('id', data.productId);
				if (error) throw error;
			}
			currentStock = qty;
			saveMessage = 'Inventario actualizado.';
		} catch (err: any) {
			saveError = err?.message || 'No se pudo guardar el inventario.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{data.name} · Escaneo</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-8">
	<p class="text-sm text-gray-500 mb-2">Artículo escaneado</p>
	<h1 class="text-3xl font-bold mb-1">{data.name}</h1>
	<p class="font-mono text-sm text-gray-600 mb-6">SKU / referencia: {data.sku}</p>

	<div class="bg-white rounded-lg shadow overflow-hidden mb-6">
		{#if imageUrl}
			<img src={imageUrl} alt={data.name} class="w-full max-h-80 object-contain bg-gray-50" />
		{:else}
			<div class="h-48 bg-gray-100 flex items-center justify-center text-gray-400">Sin foto</div>
		{/if}
		<div class="p-5 space-y-3">
			<p class="text-xl font-semibold">{formatPrice(data.price)}</p>
			<p class="text-sm text-gray-700">Existencia: <span class="font-semibold">{currentStock}</span> piezas</p>
			{#if !data.is_active}
				<p class="text-sm text-amber-700">Este artículo no está activo en catálogo.</p>
			{/if}
			{#if data.short_description}
				<div class="text-sm text-gray-700">
					<FormattedText text={data.short_description} />
				</div>
			{/if}
			{#if data.slug}
				<a href="/productos/{data.slug}" class="inline-block text-blue-600 hover:underline text-sm">
					Ver ficha completa en la tienda
				</a>
			{/if}
		</div>
	</div>

	{#if attrRows.length > 0}
		<section class="bg-white rounded-lg shadow p-5 mb-6">
			<h2 class="text-lg font-semibold mb-3">Características de la variante</h2>
			<dl class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
				{#each attrRows as row}
					<div class="flex justify-between gap-4 border-b border-gray-100 py-1">
						<dt class="text-gray-500 capitalize">{row.key}</dt>
						<dd class="font-medium">{row.value}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/if}

	{#if specRows.length > 0}
		<section class="bg-white rounded-lg shadow p-5 mb-6">
			<h2 class="text-lg font-semibold mb-3">Especificaciones</h2>
			<dl class="space-y-2 text-sm">
				{#each specRows as spec}
					<div class="flex justify-between gap-4 border-b border-gray-100 py-1">
						<dt class="text-gray-500">{spec.specification_key}</dt>
						<dd class="font-medium text-right">{spec.specification_value || '—'}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/if}

	{#if data.description}
		<section class="bg-white rounded-lg shadow p-5 mb-6">
			<h2 class="text-lg font-semibold mb-3">Descripción</h2>
			<div class="text-sm text-gray-700">
				<FormattedText text={data.description} />
			</div>
		</section>
	{/if}

	{#if canManageStock}
		<section class="bg-amber-50 border border-amber-200 rounded-lg p-5">
			<h2 class="text-lg font-semibold mb-2">Actualizar inventario</h2>
			<p class="text-sm text-gray-600 mb-4">Indica el conteo actual de piezas de este SKU.</p>
			<form onsubmit={saveStock} class="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
				<label class="block">
					<span class="text-sm font-medium">Piezas</span>
					<input
						type="number"
						min="0"
						step="1"
						bind:value={stockInput}
						class="mt-1 w-32 px-3 py-2 border border-gray-300 rounded-lg"
					/>
				</label>
				<button
					type="submit"
					disabled={saving}
					class="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
				>
					{saving ? 'Guardando…' : 'Guardar existencias'}
				</button>
			</form>
			{#if saveMessage}
				<p class="text-sm text-green-700 mt-3">{saveMessage}</p>
			{/if}
			{#if saveError}
				<p class="text-sm text-red-700 mt-3">{saveError}</p>
			{/if}
		</section>
	{:else if $userStore.initialized && !$userStore.user}
		<p class="text-sm text-gray-500">
			<a href="/login" class="text-blue-600 hover:underline">Inicia sesión</a>
			con una cuenta de inventario para actualizar existencias desde este código.
		</p>
	{/if}
</div>
