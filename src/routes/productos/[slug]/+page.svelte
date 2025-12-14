<script lang="ts">
	import { cart } from '$lib/stores/cart';
	import { formatPrice } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let selectedVariant = $state(data.product.variants?.[0] || null);
	let selectedImage = $state(
		data.product.media?.find((m: any) => m.is_primary)?.url || data.product.media?.[0]?.url || ''
	);
	let quantity = $state(1);
	let addedToCart = $state(false);

	function selectImage(url: string) {
		selectedImage = url;
	}

	function addToCart() {
		const item = {
			product: data.product,
			variant: selectedVariant || undefined,
			quantity,
			media: data.product.media
		};

		cart.addItem(item);
		addedToCart = true;
		setTimeout(() => {
			addedToCart = false;
		}, 2000);
	}

	let finalPrice = $derived(
		selectedVariant ? selectedVariant.price : data.product.base_price
	);

	let stock = $derived(
		selectedVariant ? selectedVariant.stock_quantity : data.product.stock_quantity
	);
</script>

<svelte:head>
	<title>{data.product.meta_title || data.product.name} - Guerra Láser</title>
	{#if data.product.meta_description}
		<meta name="description" content={data.product.meta_description} />
	{/if}
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Breadcrumb -->
	<nav class="mb-6 text-sm">
		<a href="/" class="text-blue-600 hover:underline">Inicio</a>
		<span class="mx-2">/</span>
		<a href="/productos" class="text-blue-600 hover:underline">Productos</a>
		{#if data.product.category}
			<span class="mx-2">/</span>
			<a href="/categorias/{data.product.category.slug}" class="text-blue-600 hover:underline">
				{data.product.category.name}
			</a>
		{/if}
		<span class="mx-2">/</span>
		<span class="text-gray-600">{data.product.name}</span>
	</nav>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Product Images -->
		<div>
			{#if selectedImage}
				<div class="mb-4 bg-white rounded-lg shadow-lg overflow-hidden">
					<img src={selectedImage} alt={data.product.name} class="w-full h-96 object-contain" />
				</div>
			{:else}
				<div
					class="mb-4 bg-gray-200 rounded-lg h-96 flex items-center justify-center shadow-lg"
				>
					<span class="text-gray-400">Sin imagen</span>
				</div>
			{/if}

			{#if data.product.media && data.product.media.length > 1}
				<div class="grid grid-cols-4 gap-2">
					{#each data.product.media as media}
						<button onclick={() => selectImage(media.url)} class="border-2 rounded-lg overflow-hidden hover:border-blue-500 transition {selectedImage === media.url ? 'border-blue-500' : 'border-gray-200'}">
							<img src={media.thumbnail_url || media.url} alt={media.alt_text || ''} class="w-full h-20 object-cover" />
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Product Info -->
		<div>
			{#if data.product.category}
				<p class="text-blue-600 mb-2">{data.product.category.name}</p>
			{/if}

			<h1 class="text-4xl font-bold mb-4">{data.product.name}</h1>

			{#if data.product.short_description}
				<p class="text-xl text-gray-600 mb-6">{data.product.short_description}</p>
			{/if}

			<div class="mb-6">
				<p class="text-4xl font-bold text-blue-600">{formatPrice(finalPrice)}</p>
				{#if data.product.discounts && data.product.discounts.length > 0}
					<div class="mt-2">
						{#each data.product.discounts as discount}
							<span class="inline-block bg-red-500 text-white px-3 py-1 rounded-full text-sm">
								{discount.discount_type === 'percentage'
									? `${discount.discount_value}% OFF`
									: `${formatPrice(discount.discount_value)} OFF`}
							</span>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Variants -->
			{#if data.product.variants && data.product.variants.length > 0}
				<div class="mb-6">
					<label class="block text-sm font-semibold mb-2">Variante:</label>
					<div class="flex flex-wrap gap-2">
						{#each data.product.variants as variant}
							<button
								onclick={() => (selectedVariant = variant)}
								class="px-4 py-2 rounded-lg border-2 transition {selectedVariant?.id === variant.id
									? 'border-blue-600 bg-blue-50'
									: 'border-gray-300 hover:border-blue-400'}"
							>
								{variant.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Quantity -->
			<div class="mb-6">
				<label class="block text-sm font-semibold mb-2">Cantidad:</label>
				<div class="flex items-center gap-2">
					<button
						onclick={() => quantity > 1 && quantity--}
						class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
						disabled={quantity <= 1}
					>
						-
					</button>
					<input
						type="number"
						bind:value={quantity}
						min="1"
						max={stock}
						class="w-20 px-4 py-2 border border-gray-300 rounded-lg text-center"
					/>
					<button
						onclick={() => quantity < stock && quantity++}
						class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
						disabled={quantity >= stock}
					>
						+
					</button>
					<span class="ml-4 text-sm text-gray-600">
						{stock > 0 ? `${stock} disponibles` : 'Agotado'}
					</span>
				</div>
			</div>

			<!-- Add to Cart -->
			<button
				onclick={addToCart}
				disabled={stock === 0}
				class="w-full bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				{addedToCart ? '✓ Agregado al Carrito' : '🛒 Agregar al Carrito'}
			</button>

			{#if data.product.sku}
				<p class="mt-4 text-sm text-gray-600">SKU: {data.product.sku}</p>
			{/if}
		</div>
	</div>

	<!-- Product Description -->
	{#if data.product.description}
		<div class="mt-12">
			<h2 class="text-2xl font-bold mb-4">Descripción</h2>
			<div class="prose max-w-none">
				<p class="text-gray-700 whitespace-pre-line">{data.product.description}</p>
			</div>
		</div>
	{/if}
</div>