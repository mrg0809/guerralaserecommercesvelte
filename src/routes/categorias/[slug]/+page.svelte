<script lang="ts">
    import { formatPrice } from '$lib/utils';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.category.name} - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Category Header -->
	{#if data.category.image_url}
		<div class="relative h-64 rounded-lg overflow-hidden mb-8">
			<img
				src={data.category.image_url}
				alt={data.category.name}
				class="w-full h-full object-cover"
			/>
			<div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
				<div class="text-center text-white">
					<h1 class="text-5xl font-bold mb-4">{data.category.name}</h1>
					{#if data.category.description}
						<p class="text-xl">{data.category.description}</p>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="mb-8">
			<h1 class="text-4xl font-bold mb-4">{data.category.name}</h1>
			{#if data.category.description}
				<p class="text-xl text-gray-600">{data.category.description}</p>
			{/if}
		</div>
	{/if}

	<!-- Breadcrumb -->
	<nav class="mb-6 text-sm">
		<a href="/" class="text-blue-600 hover:underline">Inicio</a>
		<span class="mx-2">/</span>
		<a href="/categorias" class="text-blue-600 hover:underline">Categorías</a>
		<span class="mx-2">/</span>
		<span class="text-gray-600">{data.category.name}</span>
	</nav>



	<!-- Products -->
	{#if data.products.length === 0}
		<div class="text-center py-12 bg-gray-50 rounded-lg">
			<p class="text-xl text-gray-600">No hay productos en esta categoría.</p>
			<a
				href="/productos"
				class="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				Ver Todos los Productos
			</a>
		</div>
	{:else}
		<div class="mb-4">
			<p class="text-gray-600">{data.products.length} producto{data.products.length !== 1 ? 's' : ''}</p>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each data.products as product}
				<a
					href="/productos/{product.slug}"
					class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition"
				>
					{#if product.media && product.media.length > 0}
						<img
							src={product.media.find((m) => m.is_primary)?.url || product.media[0].url}
							alt={product.name}
							class="w-full h-48 object-cover"
						/>
					{:else}
						<div class="w-full h-48 bg-gray-200 flex items-center justify-center">
							<span class="text-gray-400">Sin imagen</span>
						</div>
					{/if}
					<div class="p-4">
						<h3 class="text-lg font-bold mb-2">{product.name}</h3>
						{#if product.short_description}
							<p class="text-gray-600 text-sm mb-3 line-clamp-2">{product.short_description}</p>
						{/if}
						<div class="flex items-center justify-between">
							<p class="text-xl font-bold text-blue-600">{formatPrice(product.base_price)}</p>
							{#if product.stock_quantity > 0}
								<span class="text-sm text-green-600">En stock</span>
							{:else}
								<span class="text-sm text-red-600">Agotado</span>
							{/if}
						</div>
					</div>
				</a>
			{/each}
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