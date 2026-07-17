<script lang="ts">
	import { onMount } from 'svelte';
	import { formatPrice, getDisplayPrice } from '$lib/utils';
	import { getImageKitUrlWithTransform, IMAGEKIT_TRANSFORMS, getSiteLogoUrl } from '$lib/storage';
	import HeroBanner from '$lib/components/HeroBanner.svelte';
	import VideoEmbedFacade from '$lib/components/VideoEmbedFacade.svelte';
	import type { Product, Category, ProductMedia, Promotion, TestimonialVideo } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const promotions = $derived(data.promotions as Promotion[]);
	const categories = $derived(data.categories as Category[]);
	const featuredProducts = $derived(
		data.featuredProducts as (Product & { media?: ProductMedia[]; category?: Category })[]
	);
	const testimonialVideos = $derived(data.testimonialVideos as TestimonialVideo[]);

	let currentVideoIndex = $state(0);
	let videoAutoplayInterval: ReturnType<typeof setInterval> | null = null;

	let productsCarouselRef = $state<HTMLDivElement | null>(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	function checkScrollButtons() {
		if (productsCarouselRef) {
			canScrollLeft = productsCarouselRef.scrollLeft > 0;
			canScrollRight =
				productsCarouselRef.scrollLeft <
				productsCarouselRef.scrollWidth - productsCarouselRef.clientWidth - 10;
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

	onMount(() => {
		setTimeout(checkScrollButtons, 100);

		if (testimonialVideos.length > 0) {
			startVideoCarousel();
		}

		return () => {
			if (videoAutoplayInterval) {
				clearInterval(videoAutoplayInterval);
			}
		};
	});

	function getLoopPromotions(): Promotion[] {
		if (promotions.length === 0) return [];
		return [...promotions, ...promotions];
	}

	function startVideoCarousel() {
		videoAutoplayInterval = setInterval(() => {
			nextVideo();
		}, 5000);
	}

	function nextVideo() {
		currentVideoIndex = (currentVideoIndex + 1) % testimonialVideos.length;
	}

	function prevVideo() {
		currentVideoIndex =
			(currentVideoIndex - 1 + testimonialVideos.length) % testimonialVideos.length;
	}

	function goToVideo(index: number) {
		currentVideoIndex = index;
		if (videoAutoplayInterval) {
			clearInterval(videoAutoplayInterval);
		}
		startVideoCarousel();
	}

	function getChildCategories(parentId: string): Category[] {
		return categories
			.filter((c) => c.parent_id === parentId)
			.sort((a, b) => {
				const orderA = a.display_order ?? 0;
				const orderB = b.display_order ?? 0;
				if (orderA !== orderB) {
					return orderA - orderB;
				}
				return a.name.localeCompare(b.name);
			});
	}

	function getMaquinariaSubcategories(): Category[] {
		const maquinaria = categories.find(
			(c) => c.slug === 'maquinaria' || c.name.toLowerCase().includes('maquinaria')
		);
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

<HeroBanner config={data.heroBanner} />

<!-- Sección de Promociones -->
{#if promotions.length > 0}
	<section class="relative w-full py-10 md:py-14 overflow-hidden bg-gradient-to-b from-slate-100 to-white">
		<div class="container mx-auto px-4">
			<div class="text-center mb-6 md:mb-8">
				<h2 class="text-2xl md:text-4xl font-bold text-gray-900">PROMOCIONES</h2>
			</div>

			<div class="promo-marquee" aria-label="Carrusel de promociones">
				<div
					class="promo-track"
					style="--promo-duration: {Math.max(promotions.length * 4, 16)}s;"
				>
					{#each getLoopPromotions() as promotion, index (`${promotion.id}-${index}`)}
						{#if promotion.link_url}
							<a
								href={promotion.link_url}
								class="promo-item"
								aria-label={promotion.title}
							>
								<img
									src={getImageKitUrlWithTransform(promotion.image_url, IMAGEKIT_TRANSFORMS.promotion)}
									alt={promotion.title}
									class="w-full h-full object-contain"
									loading={index === 0 ? 'eager' : 'lazy'}
									fetchpriority={index === 0 ? 'high' : undefined}
									decoding="async"
								/>
							</a>
						{:else}
							<div class="promo-item">
								<img
									src={getImageKitUrlWithTransform(promotion.image_url, IMAGEKIT_TRANSFORMS.promotion)}
									alt={promotion.title}
									class="w-full h-full object-contain"
									loading={index === 0 ? 'eager' : 'lazy'}
									fetchpriority={index === 0 ? 'high' : undefined}
									decoding="async"
								/>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}

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
								src={getImageKitUrlWithTransform(category.image_url, IMAGEKIT_TRANSFORMS.category)}
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
{#if featuredProducts.length > 0}
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
									src={getImageKitUrlWithTransform(
										product.media.find((m) => m.is_primary)?.url || product.media[0].url,
										IMAGEKIT_TRANSFORMS.featuredProduct
									)}
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
								<p class="text-gray-600 mb-4 line-clamp-2 whitespace-pre-line">{product.short_description}</p>
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
									<VideoEmbedFacade
										videoUrl={video.video_url}
										videoType={video.video_type}
										title={video.title}
										thumbnailUrl={video.thumbnail_url}
										active={index === currentVideoIndex}
									/>
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
								class="h-3 w-3 rounded-full origin-center transition-transform duration-300 will-change-transform {index === currentVideoIndex
									? 'scale-x-[4] bg-blue-600'
									: 'scale-x-100 bg-gray-300 hover:bg-blue-400'}"
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
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.promo-marquee {
		overflow: hidden;
		mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
	}

	.promo-track {
		display: flex;
		gap: 1rem;
		width: max-content;
		animation: promo-scroll var(--promo-duration) linear infinite;
		will-change: transform;
	}

	.promo-track:hover {
		animation-play-state: paused;
	}

	.promo-item {
		flex: 0 0 min(76vw, 280px);
		aspect-ratio: 1 / 1;
		overflow: hidden;
	}

	@media (min-width: 768px) {
		.promo-item {
			flex-basis: min(28vw, 340px);
		}
	}

	@keyframes promo-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}
</style>
