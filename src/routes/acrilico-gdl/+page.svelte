<script lang="ts">
	import { onMount } from 'svelte';
	import { cart } from '$lib/stores/cart';
	import { formatPrice, getDisplayPrice, getDisplayStock } from '$lib/utils';
	import { getImageKitUrl } from '$lib/storage';
	import {
		DEFAULT_ACRYLIC_PRICING,
		type AcrylicPricingConfig
	} from '$lib/acrylicPricing';
	import AcrylicLocalOrderModal from '$lib/components/acrylic/AcrylicLocalOrderModal.svelte';
	import {
		ACRILICO_GDL_SITE_URL,
		ACRILICO_GDL_SOURCE,
		GDL_WAREHOUSE_LABEL,
		ZMG_FREE_SHIPPING_MIN,
		buildGdlCartWhatsAppMessage,
		buildLandingGeneralWhatsAppMessage,
		openAcrilicoGdlWhatsApp,
		persistAcrilicoGdlCampaign
	} from '$lib/acrilicoGdl';
	import type { CartItem } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const IMAGEKIT_TRANSFORM = 'tr=w-600,h-600,fo-auto,q-80';

	let acrylicConfig = $state<AcrylicPricingConfig>(structuredClone(DEFAULT_ACRYLIC_PRICING));
	let selectedProduct = $state<any>(null);
	let modalOpen = $state(false);
	let gdlCartItems = $state<CartItem[]>([]);
	let gdlCartCount = $derived(gdlCartItems.reduce((sum, item) => sum + item.quantity, 0));

	$effect(() => {
		const unsub = cart.subscribe((items) => {
			gdlCartItems = items.filter((item) => item.source === ACRILICO_GDL_SOURCE);
		});
		return unsub;
	});

	function getProductImageSrc(product: any) {
		const media = product.media || product.product_media || [];
		if (!media.length) return null;
		const primary = media.find((m: any) => m.is_primary) ?? media[0];
		const baseUrl = primary?.url;
		if (!baseUrl) return null;
		const ikUrl = getImageKitUrl(baseUrl);
		if (!ikUrl.includes('ik.imagekit.io')) return ikUrl;
		if (ikUrl.includes('?tr=')) return ikUrl;
		return `${ikUrl}?${IMAGEKIT_TRANSFORM}`;
	}

	function openProduct(product: any) {
		selectedProduct = product;
		modalOpen = true;
	}

	function sendGeneralWhatsApp() {
		if (gdlCartItems.length > 0) {
			openAcrilicoGdlWhatsApp(buildGdlCartWhatsAppMessage(gdlCartItems), 'acrilico_gdl_carrito');
			return;
		}
		openAcrilicoGdlWhatsApp(buildLandingGeneralWhatsAppMessage(), 'acrilico_gdl_hero');
	}

	onMount(() => {
		persistAcrilicoGdlCampaign(new URLSearchParams(window.location.search));
		void fetch('/api/acrylic-pricing')
			.then((r) => r.json())
			.then((res) => {
				if (res?.config) acrylicConfig = res.config;
			})
			.catch(() => {});
	});
</script>

<svelte:head>
	<title>Acrílico en Guadalajara y Zapopan | Guerra Láser</title>
	<meta
		name="description"
		content="Venta de láminas y placas de acrílico en Guadalajara y Zapopan. Precios de bodega, recolección inmediata o entrega local en la ZMG. Envío gratis desde $5,000."
	/>
	<link rel="canonical" href={ACRILICO_GDL_SITE_URL} />
</svelte:head>

<div class="bg-slate-900 text-white">
	<div class="container mx-auto px-4 py-12 md:py-16">
		<p
			class="inline-flex items-center rounded-full bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-1.5 mb-5"
		>
			Precios directos de bodega | Recolección inmediata o entrega local en la ZMG
		</p>
		<h1 class="text-3xl md:text-5xl font-bold max-w-4xl leading-tight">
			Venta de Láminas y Placas de Acrílico en Guadalajara y Zapopan
		</h1>
		<p class="mt-4 text-lg text-slate-200 max-w-2xl">
			Mismos precios de tienda. Aparta por WhatsApp o paga en línea: recoge en bodega o recibe en
			la zona metropolitana.
		</p>
		<div class="mt-8 flex flex-wrap gap-3">
			<button
				type="button"
				onclick={sendGeneralWhatsApp}
				class="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#25D366] text-white font-semibold hover:brightness-95"
			>
				Pedir por WhatsApp
			</button>
			<a
				href="#catalogo"
				class="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100"
			>
				Ver láminas y precios
			</a>
		</div>
	</div>
</div>

<div class="container mx-auto px-4 py-8 {gdlCartCount > 0 ? 'pb-28' : ''}">
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4 -mt-6 relative z-10">
		<div class="bg-white rounded-lg shadow-md p-5 border border-gray-100">
			<p class="font-semibold text-gray-900">Recoger en bodega</p>
			<p class="text-sm text-gray-600 mt-1">{GDL_WAREHOUSE_LABEL}</p>
		</div>
		<div class="bg-white rounded-lg shadow-md p-5 border border-gray-100">
			<p class="font-semibold text-gray-900">Entrega local en la ZMG</p>
			<p class="text-sm text-gray-600 mt-1">
				Guadalajara, Zapopan, Tlaquepaque, Tonalá, Tlajomulco y municipios vecinos.
			</p>
		</div>
		<div class="bg-white rounded-lg shadow-md p-5 border border-gray-100">
			<p class="font-semibold text-gray-900">Envío gratis desde {formatPrice(ZMG_FREE_SHIPPING_MIN)}</p>
			<p class="text-sm text-gray-600 mt-1">En compras de acrílico con entrega en zona metropolitana.</p>
		</div>
	</div>

	<section id="catalogo" class="mt-12">
		<h2 class="text-2xl font-bold mb-2">Láminas y placas disponibles</h2>
		<p class="text-gray-600 mb-8">Elige color, grosor y tamaño. Precios iguales a la tienda.</p>

		{#if data.loadError}
			<p class="text-red-600 mb-4">No se pudieron cargar los productos. Intenta de nuevo.</p>
		{/if}

		{#if data.products.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{#each data.products as product}
					{@const displayPrice = getDisplayPrice(product)}
					{@const displayStock = getDisplayStock(product)}
					{@const imageSrc = getProductImageSrc(product)}
					<button
						type="button"
						onclick={() => openProduct(product)}
						class="text-left bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition"
					>
						{#if imageSrc}
							<img src={imageSrc} alt={product.name} class="w-full h-48 object-cover" />
						{:else}
							<div class="w-full h-48 bg-gray-200 flex items-center justify-center">
								<span class="text-gray-400">Sin imagen</span>
							</div>
						{/if}
						<div class="p-4">
							<h3 class="text-lg font-bold mb-2">{product.name}</h3>
							{#if product.short_description}
								<p class="text-gray-600 text-sm mb-3 line-clamp-2 whitespace-pre-line">
									{product.short_description}
								</p>
							{/if}
							<div class="flex items-center justify-between mb-3">
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
							<p class="text-sm font-semibold text-blue-700">Apartar y recoger en bodega</p>
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<div class="text-center py-12 bg-gray-50 rounded-lg">
				<p class="text-xl text-gray-600">No hay láminas de acrílico publicadas por ahora.</p>
			</div>
		{/if}
	</section>
</div>

<AcrylicLocalOrderModal
	open={modalOpen}
	product={selectedProduct}
	config={acrylicConfig}
	onclose={() => {
		modalOpen = false;
		selectedProduct = null;
	}}
/>

{#if gdlCartCount > 0}
	<div class="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
		<div class="container mx-auto flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-gray-700">
				<strong>{gdlCartCount}</strong>
				{gdlCartCount === 1 ? 'pieza' : 'piezas'} de acrílico en el carrito
			</p>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={sendGeneralWhatsApp}
					class="px-4 py-2 rounded-lg bg-[#25D366] text-white text-sm font-semibold hover:brightness-95"
				>
					Pedir por WhatsApp
				</button>
				<a
					href="#catalogo"
					class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
				>
					Seguir agregando
				</a>
				<a
					href="/checkout"
					class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
				>
					Ir a pagar
				</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
