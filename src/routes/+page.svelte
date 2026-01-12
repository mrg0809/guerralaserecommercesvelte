<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice, getDisplayPrice, getDisplayStock } from '$lib/utils';
	import { getBannerVideoUrl, getImageKitUrl } from '$lib/storage';
	import type { Product, Category, ProductMedia, TestimonialVideo } from '$lib/types';

	let featuredProducts: (Product & { media?: ProductMedia[]; category?: Category })[] = $state([]);
	let categories: Category[] = $state([]);
	let loading = $state(true);
	
	const bannerVideoUrl = getImageKitUrl(getBannerVideoUrl());
	
	// Variables para el carrusel de videos
	let currentVideoIndex = $state(0);
	let autoplayInterval: number | null = null;
	let testimonialVideos: TestimonialVideo[] = $state([]);

	// Variables para el carrusel de productos destacados
	let productsCarouselRef: HTMLDivElement;
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	function checkScrollButtons() {
		if (productsCarouselRef) {
			canScrollLeft = productsCarouselRef.scrollLeft > 0;
			canScrollRight = productsCarouselRef.scrollLeft < (productsCarouselRef.scrollWidth - productsCarouselRef.clientWidth - 10);
		}
	}

	function scrollProducts(direction: 'left' | 'right') {
		if (productsCarouselRef) {
			const scrollAmount = productsCarouselRef.clientWidth * 0.8;
			productsCarouselRef.scrollBy({
				left: direction === 'left' ? -scrollAmount : scrollAmount,
				behavior: 'smooth'
			});
			setTimeout(checkScrollButtons, 300);
		}
	}

	onMount(async () => {
		// Load featured products
		const { data: products } = await supabase
			.from('products')
			.select('*, product_media(*), categories(*), product_variants(*)')
			.eq('is_featured', true)
			.eq('is_active', true)
			.limit(12);

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

		// Load testimonial videos from database
		const { data: videos } = await supabase
			.from('testimonial_videos')
			.select('*')
			.eq('is_active', true)
			.order('display_order');

		if (videos) {
			testimonialVideos = videos;
		}

		loading = false;
		
		// Inicializar botones del carrusel de productos
		setTimeout(checkScrollButtons, 100);
		
		// Iniciar autoplay del carrusel de videos si hay videos
		if (testimonialVideos.length > 0) {
			startVideoCarousel();
		}
		
		// Limpiar interval al desmontar
		return () => {
			if (autoplayInterval) {
				clearInterval(autoplayInterval);
			}
		};
	});
	
	function startVideoCarousel() {
		// Cambiar video cada 5 segundos
		autoplayInterval = setInterval(() => {
			nextVideo();
		}, 5000);
	}
	
	function nextVideo() {
		currentVideoIndex = (currentVideoIndex + 1) % testimonialVideos.length;
	}
	
	function prevVideo() {
		currentVideoIndex = (currentVideoIndex - 1 + testimonialVideos.length) % testimonialVideos.length;
	}
	
	function goToVideo(index: number) {
		currentVideoIndex = index;
		// Reiniciar autoplay
		if (autoplayInterval) {
			clearInterval(autoplayInterval);
		}
		startVideoCarousel();
	}

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
	<section id="categorias" class="py-16 bg-gray-50">
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
								src={getImageKitUrl(category.image_url)}
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
	<section id="productos-destacados" class="py-16 bg-gray-50">
		<div class="container mx-auto px-4">
			<h2 class="text-3xl font-bold mb-8 text-center">Productos Destacados</h2>
			
			<div class="relative group">
				<!-- Botón Izquierdo -->
				{#if canScrollLeft}
					<button
						onclick={() => scrollProducts('left')}
						class="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0"
						aria-label="Anterior"
					>
						<svg class="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
				{/if}

				<!-- Carrusel de Productos -->
				<div
					bind:this={productsCarouselRef}
					onscroll={checkScrollButtons}
					class="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
					style="scroll-snap-type: x mandatory;"
				>
					{#each featuredProducts as product}
						{@const displayPrice = getDisplayPrice(product)}
						<a
							href="/productos/{product.slug}"
							class="flex-none w-[300px] bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition"
							style="scroll-snap-align: start;"
						>
							{#if product.media && product.media.length > 0}
								<img
									src={getImageKitUrl(product.media.find((m) => m.is_primary)?.url || product.media[0].url)}
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
							<h3 class="text-xl font-bold mb-2 line-clamp-2">{product.name}</h3>
							{#if product.short_description}
								<p class="text-gray-600 mb-4 line-clamp-2">{product.short_description}</p>
						{/if}
					<div class="flex items-baseline gap-1">
							{#if displayPrice.hasVariants}
									<span class="text-xs text-gray-500">Desde</span>
								{/if}
								<p class="text-2xl font-bold text-blue-600">{formatPrice(displayPrice.price)}</p>
							</div>
						</div>
						</a>
					{/each}
				</div>

				<!-- Botón Derecho -->
				{#if canScrollRight}
					<button
						onclick={() => scrollProducts('right')}
						class="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0"
						aria-label="Siguiente"
					>
						<svg class="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				{/if}
			</div>

			<!-- Indicador de scroll en móvil -->
			<p class="text-center text-gray-500 text-sm mt-4 md:hidden">
				Desliza para ver más productos →
			</p>
		</div>
	</section>
{:else}
	<section class="py-16">
		<div class="container mx-auto px-4 text-center">
			<p class="text-xl text-gray-600">No hay productos destacados en este momento.</p>
		</div>
	</section>
{/if}

<!-- Video Testimonials Carousel -->
{#if testimonialVideos.length > 0}
	<section id="videos-testimonios" class="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
		<div class="container mx-auto px-4">
			<div class="text-center mb-12">
				<h2 class="text-4xl font-bold mb-4 text-gray-800">Clientes Satisfechos</h2>
				<p class="text-xl text-gray-600">Mira lo que nuestros clientes han logrado con nuestras máquinas</p>
			</div>
			
			<div class="relative max-w-5xl mx-auto">
				<!-- Carrusel Principal -->
				<div class="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
					<!-- Video Container -->
					<div class="aspect-video bg-black">
						{#each testimonialVideos as video, index}
							{#if index === currentVideoIndex}
								<div class="w-full h-full animate-fadeIn">
									<iframe
										src={video.video_url}
										title={video.title}
										class="w-full h-full"
										frameborder="0"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowfullscreen
									></iframe>
								</div>
							{/if}
						{/each}
					</div>
					
					<!-- Video Title -->
					<div class="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
						<h3 class="text-xl font-bold text-center">
							{testimonialVideos[currentVideoIndex].title}
						</h3>
						{#if testimonialVideos[currentVideoIndex].description}
							<p class="text-sm text-blue-100 text-center mt-2">
								{testimonialVideos[currentVideoIndex].description}
							</p>
						{/if}
					</div>
				</div>
				
				<!-- Navigation Arrows -->
				{#if testimonialVideos.length > 1}
					<button
						onclick={prevVideo}
						class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 bg-white hover:bg-blue-600 text-gray-800 hover:text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 group"
						aria-label="Video anterior"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					
					<button
						onclick={nextVideo}
						class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 bg-white hover:bg-blue-600 text-gray-800 hover:text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 group"
						aria-label="Video siguiente"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
					
					<!-- Dots Navigation -->
					<div class="flex justify-center gap-3 mt-8">
						{#each testimonialVideos as video, index}
							<button
								onclick={() => goToVideo(index)}
								class="transition-all duration-300 {index === currentVideoIndex 
									? 'w-12 h-3 bg-blue-600' 
									: 'w-3 h-3 bg-gray-300 hover:bg-blue-400'} rounded-full"
								aria-label="Ir al video {index + 1}"
							></button>
						{/each}
					</div>
					
					<!-- Thumbnails Preview (Desktop only) -->
					{#if testimonialVideos.length > 1}
						<div class="hidden lg:grid grid-cols-{Math.min(testimonialVideos.length, 4)} gap-4 mt-8">
							{#each testimonialVideos.slice(0, 4) as video, index}
								<button
									onclick={() => goToVideo(index)}
									class="relative group overflow-hidden rounded-lg transition-all duration-300 {index === currentVideoIndex ? 'ring-4 ring-blue-600 scale-105' : 'hover:scale-105'}"
								>
									<div class="aspect-video bg-gray-200 relative">
										{#if video.thumbnail_url}
											<img 
												src={video.thumbnail_url} 
												alt={video.title}
												class="w-full h-full object-cover"
											/>
										{:else}
											<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400">
												<svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
													<path d="M8 5v14l11-7z"/>
												</svg>
											</div>
										{/if}
										
										<!-- Play Icon Overlay -->
										<div class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group-hover:bg-opacity-50 transition-all">
											<div class="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
												<svg class="w-6 h-6 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
													<path d="M8 5v14l11-7z"/>
												</svg>
											</div>
										</div>
										
										{#if index === currentVideoIndex}
											<div class="absolute inset-0 border-4 border-blue-600 pointer-events-none"></div>
										{/if}
									</div>
									<p class="text-xs text-center mt-2 font-medium text-gray-700 group-hover:text-blue-600 transition-colors line-clamp-2">
										{video.title}
									</p>
								</button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
			
			<!-- Social Proof -->
			<div class="text-center mt-12">
				<p class="text-gray-600 mb-4">¿Quieres compartir tu experiencia?</p>
				<div class="flex justify-center gap-4">
					<a 
						href="https://www.youtube.com/@TuCanalYouTube" 
						target="_blank"
						rel="noopener noreferrer"
						class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition inline-flex items-center gap-2"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
						</svg>
						YouTube
					</a>
					<a 
						href="https://www.tiktok.com/@TuUsuarioTikTok" 
						target="_blank"
						rel="noopener noreferrer"
						class="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition inline-flex items-center gap-2"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
						</svg>
						TikTok
					</a>
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Features Section -->
<section id="caracteristicas" class="py-16 bg-gray-50">
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

<style>
	/* Ocultar scrollbar pero mantener funcionalidad */
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	
	/* Limitar líneas de texto */
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
