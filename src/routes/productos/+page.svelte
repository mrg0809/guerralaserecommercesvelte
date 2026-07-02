<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice, getDisplayPrice, getDisplayStock } from '$lib/utils';
	import { getImageKitUrl } from '$lib/storage';
	import type { Product, Category, ProductMedia } from '$lib/types';

	let products: (Product & { media?: ProductMedia[]; category?: Category })[] = $state([]);
	let categories: Category[] = $state([]);
	let selectedCategory = $state<string | null>(null);
	let loading = $state(true);
	let searchTerm = $state('');

	// Transformaciones por defecto de ImageKit para las miniaturas
	const IMAGEKIT_TRANSFORM = 'tr=w-600,h-600,fo-auto,q-80';

	function getProductImageSrc(product: Product & { media?: ProductMedia[] }) {
		if (!product.media || product.media.length === 0) return null;

		const primary = product.media.find((m) => m.is_primary) ?? product.media[0];
		const baseUrl = primary?.url;
		if (!baseUrl) return null;

		// Convertimos primero a ImageKit si viene de Supabase
		const ikUrl = getImageKitUrl(baseUrl);

		// Si no es una URL de ImageKit (por ejemplo, un dominio externo), la devolvemos tal cual
		if (!ikUrl.includes('ik.imagekit.io')) {
			return ikUrl;
		}

		// Añadir transformaciones si no existen aún
		if (ikUrl.includes('?tr=')) return ikUrl;
		return `${ikUrl}?${IMAGEKIT_TRANSFORM}`;
	}

	onMount(async () => {
		await loadCategories();
		await loadProducts();
	});

	async function loadCategories() {
		const { data } = await supabase
			.from('categories')
			.select('id, name, slug, parent_id, display_order, is_active')
			.eq('is_active', true)
			.order('display_order');

		if (data) {
			categories = data;
		}
	}

	async function loadProducts() {
		loading = true;
		let query = supabase
			.from('products')
			.select('id, name, slug, base_price, stock_quantity, short_description, category_id, product_media(*), categories(*), product_variants(id, name, sku, price, stock_quantity, is_active)')
			.eq('is_active', true);

		if (selectedCategory) {
			query = query.eq('category_id', selectedCategory);
		}

		const { data } = await query.order('created_at', { ascending: false }).limit(50);

		if (data) {
			products = data.map((p: any) => ({
				...p,
				media: p.product_media || [],
				category: p.categories,
				product_variants: p.product_variants || []
			}));
		}

		loading = false;
	}

	function filterByCategory(categoryId: string | null) {
		selectedCategory = categoryId;
		loadProducts();
	}

	let filteredProducts = $derived(
		searchTerm
			? products.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
			: products
	);
</script>

<svelte:head>
	<title>Productos - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold mb-8">Todos los Productos</h1>

	<!-- Search and Filters -->
	<div class="mb-8 flex flex-wrap gap-4">
		<input
			type="text"
			bind:value={searchTerm}
			placeholder="Buscar productos..."
			class="flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	</div>

	<!-- Category Filters -->
	<div class="mb-8">
		<div class="flex flex-wrap gap-2">
			<button
				onclick={() => filterByCategory(null)}
				class="px-4 py-2 rounded-lg {selectedCategory === null
					? 'bg-blue-600 text-white'
					: 'bg-gray-200 hover:bg-gray-300'}"
			>
				Todas las Categorías
			</button>
			{#each categories as category}
				<button
					onclick={() => filterByCategory(category.id)}
					class="px-4 py-2 rounded-lg {selectedCategory === category.id
						? 'bg-blue-600 text-white'
						: 'bg-gray-200 hover:bg-gray-300'}"
				>
					{category.name}
				</button>
			{/each}
		</div>
	</div>

	<!-- Products Grid -->
	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando productos...</p>
		</div>
	{:else if filteredProducts.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each filteredProducts as product}
				{@const displayPrice = getDisplayPrice(product)}
				{@const displayStock = getDisplayStock(product)}
				{@const imageSrc = getProductImageSrc(product)}
				<a
					href="/productos/{product.slug}"
					class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition"
				>
					{#if imageSrc}
						<img
							src={imageSrc}
							alt={product.name}
							class="w-full h-48 object-cover"
						/>
					{:else}
						<div class="w-full h-48 bg-gray-200 flex items-center justify-center">
							<span class="text-gray-400">Sin imagen</span>
						</div>
					{/if}
					<div class="p-4">
						{#if product.category}
							<p class="text-sm text-blue-600 mb-1">{product.category.name}</p>
						{/if}
						<h3 class="text-lg font-bold mb-2">{product.name}</h3>
						{#if product.short_description}
							<p class="text-gray-600 text-sm mb-3 line-clamp-2 whitespace-pre-line">{product.short_description}</p>
						{/if}
						<div class="flex items-center justify-between">
							<div class="flex items-baseline gap-1">
								{#if displayPrice.hasVariants}
									<span class="text-xs text-gray-500">Desde</span>
								{/if}
								<p class="text-xl font-bold text-blue-600">{formatPrice(displayPrice.price)}</p>
							</div>
							{#if displayStock > 0}
								<span class="text-sm text-green-600">En stock</span>
							{:else}
								<span class="text-sm text-red-600">Agotado</span>
							{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">No se encontraron productos.</p>
		</div>
	{/if}
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>