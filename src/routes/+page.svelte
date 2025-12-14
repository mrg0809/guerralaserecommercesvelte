<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice } from '$lib/utils';
	import { getBannerVideoUrl } from '$lib/storage';
	import type { Product, Category, ProductMedia } from '$lib/types';

	let featuredProducts: (Product & { media?: ProductMedia[]; category?: Category })[] = $state([]);
	let categories: Category[] = $state([]);
	let loading = $state(true);
	
	const bannerVideoUrl = getBannerVideoUrl();

	onMount(async () => {
		// Load featured products
		const { data: products } = await supabase
			.from('products')
			.select('*, product_media(*), categories(*)')
			.eq('is_featured', true)
			.eq('is_active', true)
			.limit(6);

		if (products) {
			featuredProducts = products.map((p: any) => ({
				...p,
				media: p.product_media,
				category: p.categories
			}));
		}

		// Load categories
		const { data: cats } = await supabase
			.from('categories')
			.select('*')
			.eq('is_active', true)
			.order('display_order');

		if (cats) {
			categories = cats;
		}

		loading = false;
	});

	function getChildCategories(parentId: string): Category[] {
		return categories.filter(c => c.parent_id === parentId).sort((a, b) => {
			if (a.display_order !== b.display_order) {
				return a.display_order - b.display_order;
			}
			return a.name.localeCompare(b.name);
		});
	}

	function getRootCategories(): Category[] {
		return categories.filter(c => !c.parent_id).sort((a, b) => {
			if (a.display_order !== b.display_order) {
				return a.display_order - b.display_order;
			}
			return a.name.localeCompare(b.name);
		});
	}

	// Obtener la categoría Maquinaria y sus subcategorías
	function getMaquinariaSubcategories(): Category[] {
		const maquinaria = categories.find(c => c.slug === 'maquinaria' || c.name.toLowerCase().includes('maquinaria'));
		if (!maquinaria) return [];
		return getChildCategories(maquinaria.id);
	}
</script>

<svelte:head>
	<title>Guerra Láser - Máquinas de Corte y Grabado Láser</title>
	<meta
		name="description"
		content="Tienda en línea de máquinas láser de alta precisión, refacciones y accesorios."
	/>
</svelte:head>

<!-- Hero Banner with Video -->
<section class="relative w-full h-[500px] overflow-hidden">
	<!-- Video de fondo -->
	<video
		autoplay
		loop
		muted
		playsinline
		class="absolute inset-0 w-full h-full object-cover"
	>
		<source
			src={bannerVideoUrl}
			type="video/mp4"
		/>
		Tu navegador no soporta el elemento de video.
	</video>

	<!-- Overlay azul translúcido para dar tono azulado al video -->
	<div class="absolute inset-0 bg-blue-900 bg-opacity-30"></div>

	<!-- Contenido del banner -->
	<div class="relative z-10 container mx-auto px-4 h-full flex flex-col items-center justify-center text-center text-white">
		<h1 class="text-5xl md:text-6xl font-bold mb-6 drop-shadow-lg">ESPECIALISTAS EN VENTA DE MAQUINARIA</h1>
		<p class="text-xl md:text-2xl drop-shadow-lg">En corte de metales, corte laser co2, fibra óptica, plasma, router, etc.</p>
	</div>
</section>

<!-- Categories Section -->
{#if getMaquinariaSubcategories().length > 0}
	<section class="py-16 bg-gray-50">
		<div class="container mx-auto px-4">
			<h2 class="text-3xl font-bold mb-8 text-center">Nuestras Máquinas</h2>
			
			<!-- Grid de subcategorías de Maquinaria -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{#each getMaquinariaSubcategories() as category}
					<a
						href="/categorias/{category.slug}"
						class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition"
					>
						{#if category.image_url}
							<img
								src={category.image_url}
								alt={category.name}
								class="w-full h-48 object-cover"
							/>
						{:else}
							<div class="w-full h-48 bg-gray-200 flex items-center justify-center">
								<span class="text-gray-400">Sin imagen</span>
							</div>
						{/if}
						<div class="p-4">
							<h3 class="text-xl font-bold mb-2">{category.name}</h3>
							{#if category.description}
								<p class="text-gray-600 mb-4">{category.description}</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- Featured Products -->
{#if loading}
	<section class="py-16">
		<div class="container mx-auto px-4 text-center">
			<p class="text-xl text-gray-600">Cargando productos destacados...</p>
		</div>
	</section>
{:else if featuredProducts.length > 0}
	<section class="py-16">
		<div class="container mx-auto px-4">
			<h2 class="text-3xl font-bold mb-8 text-center">Productos Destacados</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each featuredProducts as product}
					<a
						href="/productos/{product.slug}"
						class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition"
					>
						{#if product.media && product.media.length > 0}
							<img
								src={product.media.find((m) => m.is_primary)?.url || product.media[0].url}
								alt={product.name}
								class="w-full h-64 object-cover"
							/>
						{:else}
							<div class="w-full h-64 bg-gray-200 flex items-center justify-center">
								<span class="text-gray-400">Sin imagen</span>
							</div>
						{/if}
						<div class="p-4">
							{#if product.category}
								<p class="text-sm text-blue-600 mb-2">{product.category.name}</p>
							{/if}
							<h3 class="text-xl font-bold mb-2">{product.name}</h3>
							{#if product.short_description}
								<p class="text-gray-600 mb-4">{product.short_description}</p>
							{/if}
							<p class="text-2xl font-bold text-blue-600">{formatPrice(product.base_price)}</p>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>
{:else}
	<section class="py-16">
		<div class="container mx-auto px-4 text-center">
			<p class="text-xl text-gray-600">No hay productos destacados en este momento.</p>
		</div>
	</section>
{/if}

<!-- Features Section -->
<section class="py-16 bg-gray-50">
	<div class="container mx-auto px-4">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
			<div class="p-6">
				<div class="text-5xl mb-4">🚚</div>
				<h3 class="text-xl font-bold mb-2">Envío a Todo México</h3>
				<p class="text-gray-600">Entrega segura y rápida</p>
			</div>
			<div class="p-6">
				<div class="text-5xl mb-4">🛡️</div>
				<h3 class="text-xl font-bold mb-2">Garantía de Calidad</h3>
				<p class="text-gray-600">Productos de la más alta calidad</p>
			</div>
			<div class="p-6">
				<div class="text-5xl mb-4">💬</div>
				<h3 class="text-xl font-bold mb-2">Soporte Técnico</h3>
				<p class="text-gray-600">Asesoría especializada</p>
			</div>
		</div>
	</div>
</section>
