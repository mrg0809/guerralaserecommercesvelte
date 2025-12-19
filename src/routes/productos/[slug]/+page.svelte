<script lang="ts">
	import { cart } from '$lib/stores/cart';
	import { formatPrice } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let selectedVariant = $state<any>(null);
	let selectedImage = $state('');
	let quantity = $state(1);
	let addedToCart = $state(false);
	let shareMessage = $state('');

	$effect(() => {
		if (!selectedVariant && data.product?.variants?.length > 0) {
			selectedVariant = data.product.variants[0];
		}
	});

	$effect(() => {
		if (!selectedImage && data.product?.media?.length > 0) {
			selectedImage =
				data.product.media.find((m: any) => m.is_primary)?.url || data.product.media[0]?.url || '';
		}
	});

	// Derived state
	let currentUrl = $derived(typeof window !== 'undefined' ? window.location.href : '');
	let shareText = $derived(data.product.short_description || data.product.name);
	let finalPrice = $derived.by(() => {
		if (!data.product.discounts || data.product.discounts.length === 0) {
			return selectedVariant?.price || data.product.base_price || 0;
		}
		let price = selectedVariant?.price || data.product.base_price || 0;
		for (const discount of data.product.discounts) {
			if (discount.discount_type === 'percentage') {
				price = price * (1 - discount.discount_value / 100);
			} else {
				price = price - discount.discount_value;
			}
		}
		return Math.max(0, price);
	});

	let stock = $derived.by(() => {
		// Intentar obtener stock de la variante seleccionada
		const variantStock = selectedVariant?.stock_quantity;
		if (typeof variantStock === 'number' && variantStock >= 0) {
			return variantStock;
		}

		// Si no, obtener del producto
		const productStock = data.product?.stock_quantity;
		if (typeof productStock === 'number' && productStock >= 0) {
			return productStock;
		}

		// Por defecto retornar 0
		return 0;
	});

	let whatsappUrl = $derived(
		`https://wa.me/?text=${encodeURIComponent(`${shareText} ${currentUrl}`)}`
	);

	let facebookUrl = $derived(
		`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}&quote=${encodeURIComponent(shareText)}`
	);

	function selectImage(url: string) {
		selectedImage = url;
	}

	async function addToCart() {
		if (stock === 0) return;
		cart.addItem({
			product: data.product,
			variant: selectedVariant || undefined,
			quantity,
			media: data.product.media
		});
		addedToCart = true;
		setTimeout(() => (addedToCart = false), 2000);
	}

	async function copyLink() {
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard) {
				await navigator.clipboard.writeText(currentUrl);
			}
			shareMessage = 'Enlace copiado';
		} catch (e) {
			shareMessage = 'No se pudo copiar';
		} finally {
			setTimeout(() => (shareMessage = ''), 2000);
		}
	}

	async function openInstagramShare() {
		await copyLink();
		if (typeof window !== 'undefined') {
			window.open('https://www.instagram.com/', '_blank', 'noopener');
		}
	}
</script>

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
								<!-- Left: Product Images and Share -->
								<div>
									{#if selectedImage}
										<div class="relative mb-4 bg-white rounded-lg shadow-lg overflow-hidden">
											<img src={selectedImage} alt={data.product.name} class="w-full h-96 object-contain" />
											<!-- Share overlay -->
											<div class="absolute bottom-3 right-3 flex items-center gap-2">
												<a href={whatsappUrl} target="_blank" rel="noopener" title="Compartir por WhatsApp" aria-label="Compartir por WhatsApp"
													class="h-10 w-10 inline-flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-md ring-2 ring-white/90 hover:brightness-95">
													<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5 fill-current" aria-hidden="true"><path d="M20.52 3.48A11.8 11.8 0 0 0 12.04 0C5.44 0 .1 5.34.1 11.93c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.65a11.9 11.9 0 0 0 5.77 1.48h.01c6.6 0 11.95-5.34 11.95-11.93 0-3.18-1.24-6.18-3.48-8.42zM12.05 21.3h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.72.98.99-3.63-.22-.37a9.34 9.34 0 0 1-1.43-4.87c0-5.16 4.2-9.35 9.37-9.35 2.5 0 4.85.97 6.62 2.73a9.3 9.3 0 0 1 2.74 6.6c0 5.16-4.2 9.42-9.21 9.42zm5.29-6.86c-.29-.14-1.72-.84-1.99-.93-.27-.1-.47-.14-.67.14-.19.27-.77.93-.95 1.1-.18.18-.35.2-.64.07-.29-.14-1.24-.46-2.36-1.46-.87-.76-1.45-1.69-1.63-1.98-.17-.29-.02-.45.13-.59.13-.13.29-.34.43-.51.14-.18.19-.3.29-.49.1-.19.05-.37-.03-.51-.07-.14-.67-1.61-.92-2.19-.24-.58-.49-.5-.67-.5-.17 0-.37-.01-.56-.01-.2 0-.52.07-.79.34-.27.27-1.04 1-1.04 2.44 0 1.44 1.07 2.83 1.22 3.02.15.19 2.11 3.22 5.11 4.5.72.31 1.29.49 1.73.63.73.23 1.39.19 1.91.12.58-.09 1.78-.73 2.03-1.44.25-.71.25-1.31.17-1.42-.08-.11-.27-.18-.56-.33z"/></svg>
												</a>
												<a href={facebookUrl} target="_blank" rel="noopener" title="Compartir en Facebook" aria-label="Compartir en Facebook"
													class="h-10 w-10 inline-flex items-center justify-center rounded-full bg-[#1877F2] text-white shadow-md ring-2 ring-white/90 hover:brightness-95">
													<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5 fill-current" aria-hidden="true"><path d="M22.675 0h-21.35C.596 0 0 .596 0 1.325v21.35C0 23.404.596 24 1.325 24h11.495v-9.294H9.69v-3.622h3.13V8.413c0-3.1 1.892-4.788 4.659-4.788 1.326 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.764v2.313h3.59l-.467 3.622h-3.123V24h6.127C23.404 24 24 23.404 24 22.675V1.325C24 .596 23.404 0 22.675 0z"/></svg>
												</a>
												<button onclick={openInstagramShare} title="Compartir en Instagram" aria-label="Compartir en Instagram"
													class="h-10 w-10 inline-flex items-center justify-center rounded-full text-white shadow-md ring-2 ring-white/90 hover:brightness-95 bg-[linear-gradient(45deg,#f58529,#d6249f,#285AEB)]">
													<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
														<defs>
															<linearGradient id="igGradient" x1="0%" y1="0%" x2="100%" y2="100%">
																<stop offset="0%" stop-color="#f58529"/>
																<stop offset="50%" stop-color="#d6249f"/>
																<stop offset="100%" stop-color="#285AEB"/>
															</linearGradient>
														</defs>
														<rect fill="none" stroke="currentColor" stroke-width="2" x="4" y="4" width="16" height="16" rx="5"/>
														<circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
														<circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
													</svg>
												</button>
											</div>
										</div>
									{:else}
										<div class="mb-4 bg-gray-200 rounded-lg h-96 flex items-center justify-center shadow-lg">
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


									{#if shareMessage}
										<p class="mt-2 text-sm text-green-600">{shareMessage}</p>
									{/if}
								</div>

								<!-- Right: Product Info -->
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
					<p class="block text-sm font-semibold mb-2">Variante:</p>
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
			<p class="block text-sm font-semibold mb-2">Cantidad:</p>
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

		<!-- Actions -->
		<div class="flex flex-col sm:flex-row gap-3">
			<button
				onclick={addToCart}
				disabled={stock === 0}
				class="w-full bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				{addedToCart ? '✓ Agregado al Carrito' : '🛒 Agregar al Carrito'}
			</button>
		</div>

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