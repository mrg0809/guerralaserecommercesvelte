<script lang="ts">
	import { goto } from '$app/navigation';
	import { cart } from '$lib/stores/cart';
	import { formatPrice } from '$lib/utils';
	import { getImageKitUrl } from '$lib/storage';
	import {
		DEFAULT_ACRYLIC_PRICING,
		type AcrylicPricingConfig
	} from '$lib/acrylicPricing';
	import {
		acrylicCustomDimError,
		acrylicCutLabel,
		acrylicUnitPrice,
		findMatchingSheet,
		getAcrylicColorOptions,
		getColorSwatch,
		getGrosorOptions,
		getSheetVariants
	} from '$lib/acrylicProduct';
	import {
		ACRILICO_GDL_SOURCE,
		buildGdlCartWhatsAppMessage,
		mergePendingGdlLine,
		openAcrilicoGdlWhatsApp
	} from '$lib/acrilicoGdl';
	import type { AcrylicCut, CartItem } from '$lib/types';

	type ProductLike = {
		id: string;
		name: string;
		slug: string;
		base_price: number;
		stock_quantity?: number | null;
		media?: Array<{ url?: string; is_primary?: boolean | null }>;
		product_media?: Array<{ url?: string; is_primary?: boolean | null }>;
		product_variants?: any[];
		variants?: any[];
		shipping_types?: { name: string } | null;
	};

	type Props = {
		open?: boolean;
		product?: ProductLike | null;
		config?: AcrylicPricingConfig | null;
		onclose?: () => void;
	};

	let { open = false, product = null, config = null, onclose }: Props = $props();

	let quantity = $state(1);
	let selectedColor = $state('');
	let selectedGrosor = $state('');
	let selectedSizeId = $state('');
	let customMode = $state(false);
	let customWidth = $state(60);
	let customHeight = $state(40);
	let selectedVariant = $state<any>(null);
	let addedToCart = $state(false);
	let gdlCartItems = $state<CartItem[]>([]);
	let gdlCartCount = $derived(gdlCartItems.reduce((sum, item) => sum + item.quantity, 0));

	$effect(() => {
		const unsub = cart.subscribe((items) => {
			gdlCartItems = items.filter((item) => item.source === ACRILICO_GDL_SOURCE);
		});
		return unsub;
	});

	let activeConfig = $derived(config ?? DEFAULT_ACRYLIC_PRICING);
	let variants = $derived(product?.variants || product?.product_variants || []);
	let sheetVariants = $derived(getSheetVariants(variants));
	let colorOptions = $derived(getAcrylicColorOptions(sheetVariants));
	let grosorOptions = $derived(getGrosorOptions(sheetVariants, selectedColor));
	let enabledSizes = $derived(activeConfig.sizes.filter((s) => s.enabled));

	let selectedCutSize = $derived.by(() => {
		if (customMode) return null;
		return enabledSizes.find((s) => s.id === selectedSizeId) || enabledSizes[0] || null;
	});

	let customDimError = $derived(
		acrylicCustomDimError(customMode, customWidth, customHeight, activeConfig)
	);

	let unitPrice = $derived(
		acrylicUnitPrice({
			sheetPrice: Number(selectedVariant?.price) || Number(product?.base_price) || 0,
			customMode,
			customWidth,
			customHeight,
			customDimError,
			cutSize: selectedCutSize,
			config: activeConfig
		})
	);

	let cutLabel = $derived(
		acrylicCutLabel({
			customMode,
			customWidth,
			customHeight,
			cutSize: selectedCutSize
		})
	);

	let stock = $derived.by(() => {
		const variantStock = selectedVariant?.stock_quantity;
		if (typeof variantStock === 'number' && variantStock >= 0) return variantStock;
		const productStock = product?.stock_quantity;
		if (typeof productStock === 'number' && productStock >= 0) return productStock;
		return 0;
	});

	let stockLabel = $derived(stock > 0 ? `${stock} láminas en inventario` : 'Agotado');
	let canOrder = $derived(stock > 0 && !!selectedVariant && !(customMode && customDimError));

	function primaryImage(): string {
		const media = product?.media || product?.product_media || [];
		const primary = media.find((m) => m.is_primary) ?? media[0];
		const colorOption = colorOptions.find((c) => c.name === selectedColor);
		const fromColor = colorOption?.imageUrl ? getImageKitUrl(colorOption.imageUrl) : '';
		return fromColor || (primary?.url ? getImageKitUrl(primary.url) : '');
	}

	let imageSrc = $derived(primaryImage());

	$effect(() => {
		if (!open || !product) return;
		if (!selectedColor && colorOptions.length > 0) {
			selectedColor = colorOptions[0].name;
		}
		if (!selectedGrosor && grosorOptions.length > 0) {
			selectedGrosor = grosorOptions[0];
		}
		if (!customMode && !selectedSizeId && enabledSizes.length > 0) {
			selectedSizeId = enabledSizes[0].id;
		}
	});

	$effect(() => {
		if (!open) return;
		if (!selectedColor) return;
		const grosorByColor = getGrosorOptions(sheetVariants, selectedColor);
		if (grosorByColor.length > 0 && !grosorByColor.includes(selectedGrosor)) {
			selectedGrosor = grosorByColor[0];
		}
	});

	$effect(() => {
		if (!open) return;
		const matching = findMatchingSheet(sheetVariants, selectedColor, selectedGrosor);
		if (matching && selectedVariant?.id !== matching.id) {
			selectedVariant = matching;
		}
	});

	$effect(() => {
		if (stock > 0 && quantity > stock) quantity = stock;
		if (stock === 0) quantity = 1;
	});

	function resetAndClose() {
		quantity = 1;
		selectedColor = '';
		selectedGrosor = '';
		selectedSizeId = '';
		customMode = false;
		customWidth = 60;
		customHeight = 40;
		selectedVariant = null;
		addedToCart = false;
		onclose?.();
	}

	function chooseSize(sizeId: string) {
		customMode = false;
		selectedSizeId = sizeId;
		addedToCart = false;
	}

	function chooseCustom() {
		customMode = true;
		selectedSizeId = 'custom';
		addedToCart = false;
	}

	function buildCut(): AcrylicCut {
		return {
			width_cm: customMode ? Number(customWidth) : selectedCutSize?.width || 0,
			height_cm: customMode ? Number(customHeight) : selectedCutSize?.height || 0,
			size_id: customMode ? 'custom' : selectedCutSize?.id || 'custom',
			unit_price: unitPrice,
			label: cutLabel
		};
	}

	function addToCart() {
		if (!product || !canOrder) return;
		cart.addItem({
			product: product as any,
			shipping_type_name: product.shipping_types?.name,
			variant: selectedVariant || undefined,
			quantity,
			media: (product.media || product.product_media || []) as any,
			acrylicCut: buildCut(),
			source: ACRILICO_GDL_SOURCE
		});
		addedToCart = true;
	}

	function goToCheckout() {
		resetAndClose();
		void goto('/checkout');
	}

	function sendWhatsApp() {
		const pending =
			product && selectedVariant && !(customMode && customDimError)
				? ({
						product: product as CartItem['product'],
						shipping_type_name: product.shipping_types?.name,
						variant: selectedVariant || undefined,
						quantity,
						media: (product.media || product.product_media || []) as CartItem['media'],
						acrylicCut: buildCut(),
						source: ACRILICO_GDL_SOURCE
					} satisfies CartItem)
				: null;
		const items = mergePendingGdlLine(gdlCartItems, pending);
		if (items.length === 0) return;
		openAcrilicoGdlWhatsApp(buildGdlCartWhatsAppMessage(items), 'acrilico_gdl_carrito');
	}
</script>

{#if open && product}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="acrylic-gdl-modal-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.currentTarget === e.target) resetAndClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') resetAndClose();
		}}
	>
		<div class="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-auto">
			<div class="flex items-start justify-between gap-3 mb-4">
				<div>
					<h2 id="acrylic-gdl-modal-title" class="text-lg font-semibold text-gray-900">{product.name}</h2>
					<p class="text-sm text-gray-500 mt-1">Precios de bodega · Guadalajara y Zapopan</p>
				</div>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600 text-xl leading-none"
					onclick={resetAndClose}
					aria-label="Cerrar"
				>
					×
				</button>
			</div>

			{#if imageSrc}
				<img src={imageSrc} alt={product.name} class="w-full h-48 object-contain bg-gray-50 rounded-lg mb-4" />
			{/if}

			<p class="block text-sm font-semibold mb-3">Color:</p>
			{#if colorOptions.length > 0}
				<div class="flex flex-wrap gap-3 mb-4">
					{#each colorOptions as color}
						<button
							type="button"
							onclick={() => {
								selectedColor = color.name;
								addedToCart = false;
							}}
							class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition {selectedColor === color.name
								? 'border-blue-600 bg-blue-50'
								: 'border-gray-300 hover:border-blue-400'}"
						>
							<span
								class="h-5 w-5 rounded-full border border-gray-300"
								style={`background-color: ${getColorSwatch(color.name, color.hex) || '#e5e7eb'}`}
							></span>
							<span class="text-sm text-gray-700">{color.name}</span>
						</button>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500 mb-4">No hay colores disponibles.</p>
			{/if}

			{#if grosorOptions.length > 0}
				<p class="block text-sm font-semibold mb-2">Grosor:</p>
				<div class="flex flex-wrap gap-2 mb-4">
					{#each grosorOptions as grosor}
						<button
							type="button"
							onclick={() => {
								selectedGrosor = grosor;
								addedToCart = false;
							}}
							class="px-4 py-2 rounded-lg border-2 transition {selectedGrosor === grosor
								? 'border-blue-600 bg-blue-50'
								: 'border-gray-300 hover:border-blue-400'}"
						>
							{grosor}
						</button>
					{/each}
				</div>
			{/if}

			{#if enabledSizes.length > 0 || activeConfig.custom.enabled}
				<p class="block text-sm font-semibold mb-2">Tamaño:</p>
				<div class="flex flex-wrap gap-2 mb-3">
					{#each enabledSizes as size (size.id)}
						<button
							type="button"
							onclick={() => chooseSize(size.id)}
							class="px-3 py-2 rounded-lg border-2 text-sm transition {!customMode && selectedSizeId === size.id
								? 'border-blue-600 bg-blue-50'
								: 'border-gray-300 hover:border-blue-400'}"
						>
							{size.width}×{size.height}
						</button>
					{/each}
					{#if activeConfig.custom.enabled}
						<button
							type="button"
							onclick={chooseCustom}
							class="px-3 py-2 rounded-lg border-2 text-sm transition {customMode
								? 'border-blue-600 bg-blue-50'
								: 'border-gray-300 hover:border-blue-400'}"
						>
							Medida especial
						</button>
					{/if}
				</div>
			{/if}

			{#if customMode}
				<div class="grid grid-cols-2 gap-3 mb-3">
					<div>
						<label class="block text-xs text-gray-600 mb-1" for="gdl-cut-w">Ancho (cm)</label>
						<input
							id="gdl-cut-w"
							type="number"
							min={activeConfig.custom.min_width_cm}
							max={activeConfig.custom.max_width_cm}
							bind:value={customWidth}
							class="w-full border rounded-lg px-3 py-2"
						/>
					</div>
					<div>
						<label class="block text-xs text-gray-600 mb-1" for="gdl-cut-h">Alto (cm)</label>
						<input
							id="gdl-cut-h"
							type="number"
							min={activeConfig.custom.min_height_cm}
							max={activeConfig.custom.max_height_cm}
							bind:value={customHeight}
							class="w-full border rounded-lg px-3 py-2"
						/>
					</div>
				</div>
				{#if customDimError}
					<p class="text-sm text-red-600 mb-3">{customDimError}</p>
				{/if}
			{/if}

			<div class="mb-4">
				<p class="block text-sm font-semibold mb-2">Cantidad:</p>
				<div class="flex items-center gap-2">
					<button
						type="button"
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
						max={stock || 1}
						class="w-20 px-4 py-2 border border-gray-300 rounded-lg text-center"
					/>
					<button
						type="button"
						onclick={() => quantity < stock && quantity++}
						class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
						disabled={quantity >= stock}
					>
						+
					</button>
					<span class="ml-2 text-sm text-gray-600">{stockLabel}</span>
				</div>
			</div>

			<div class="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 mb-5">
				<p class="text-sm text-gray-600">
					Corte: <span class="font-medium text-gray-900">{cutLabel || '—'}</span>
				</p>
				<p class="text-lg font-semibold text-gray-900 mt-1">{formatPrice(unitPrice)}</p>
				{#if quantity > 1}
					<p class="text-sm text-gray-600">Total: {formatPrice(unitPrice * quantity)}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<button
					type="button"
					class="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
					disabled={!canOrder}
					onclick={addToCart}
				>
					{addedToCart ? '✓ Agregado al carrito' : 'Agregar al carrito'}
				</button>
				<button
					type="button"
					class="w-full px-4 py-3 rounded-lg bg-[#25D366] text-white font-semibold hover:brightness-95 disabled:opacity-50"
					disabled={!selectedVariant && gdlCartCount === 0}
					onclick={sendWhatsApp}
				>
					Pedir por WhatsApp
				</button>
				{#if addedToCart || gdlCartCount > 0}
					<p class="text-sm text-center text-green-700">
						{gdlCartCount} {gdlCartCount === 1 ? 'pieza' : 'piezas'} en el carrito. Puedes seguir agregando.
					</p>
					<button
						type="button"
						class="w-full px-4 py-2 text-sm rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold"
						onclick={goToCheckout}
					>
						Ir a pagar
					</button>
					<button
						type="button"
						class="w-full px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
						onclick={resetAndClose}
					>
						Seguir eligiendo láminas
					</button>
				{:else}
					<button
						type="button"
						class="w-full px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
						onclick={resetAndClose}
					>
						Cancelar
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
