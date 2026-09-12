<script lang="ts">
	import {
		DEFAULT_ACRYLIC_PRICING,
		customPrice,
		sizeLabel,
		sizePrice,
		validateCustomDimensions,
		type AcrylicPricingConfig
	} from '$lib/acrylicPricing';
	import type { AcrylicCut } from '$lib/types';

	type Props = {
		open?: boolean;
		sheetPrice?: number;
		title?: string;
		config?: AcrylicPricingConfig | null;
		onconfirm?: (cut: AcrylicCut) => void;
		oncancel?: () => void;
	};

	let {
		open = false,
		sheetPrice = 0,
		title = 'Elegir tamaño de corte',
		config = null,
		onconfirm,
		oncancel
	}: Props = $props();

	let loadedConfig = $state<AcrylicPricingConfig>(DEFAULT_ACRYLIC_PRICING);
	let loadingConfig = $state(false);
	let customMode = $state(false);
	let selectedSizeId = $state('');
	let customWidth = $state(60);
	let customHeight = $state(40);

	let activeConfig = $derived(config ?? loadedConfig);
	let enabledSizes = $derived(activeConfig.sizes.filter((s) => s.enabled));

	$effect(() => {
		if (!open) return;
		if (config) {
			loadedConfig = config;
			return;
		}
		if (loadingConfig) return;
		loadingConfig = true;
		void fetch('/api/acrylic-pricing')
			.then((r) => r.json())
			.then((res) => {
				if (res?.config) loadedConfig = res.config;
			})
			.catch(() => {
				loadedConfig = DEFAULT_ACRYLIC_PRICING;
			})
			.finally(() => {
				loadingConfig = false;
			});
	});

	let wasOpen = $state(false);
	$effect(() => {
		const justOpened = open && !wasOpen;
		wasOpen = open;
		if (!justOpened) return;
		customMode = false;
		customWidth = 60;
		customHeight = 40;
		const sizes = (config ?? loadedConfig).sizes.filter((s) => s.enabled);
		if (sizes.length > 0) {
			selectedSizeId = sizes[0].id;
		} else {
			selectedSizeId = '';
			if ((config ?? loadedConfig).custom.enabled) customMode = true;
		}
	});

	let selectedCutSize = $derived.by(() => {
		if (customMode) return null;
		return enabledSizes.find((s) => s.id === selectedSizeId) || enabledSizes[0] || null;
	});

	let customDimError = $derived.by(() => {
		if (!customMode) return null;
		return validateCustomDimensions(Number(customWidth), Number(customHeight), activeConfig);
	});

	let unitPrice = $derived.by(() => {
		const price = Number(sheetPrice) || 0;
		if (customMode) {
			if (customDimError) return 0;
			return customPrice(price, Number(customWidth), Number(customHeight), activeConfig);
		}
		const size = selectedCutSize;
		if (!size) return price;
		return sizePrice(price, size.width, size.height, size.factor, activeConfig);
	});

	let cutLabel = $derived.by(() => {
		if (customMode) return `Especial ${sizeLabel(Number(customWidth), Number(customHeight))}`;
		const size = selectedCutSize;
		if (!size) return '';
		return sizeLabel(size.width, size.height);
	});

	let canConfirm = $derived.by(() => {
		if (customMode) return !customDimError && Number(customWidth) > 0 && Number(customHeight) > 0;
		return !!selectedCutSize;
	});

	function chooseSize(id: string) {
		customMode = false;
		selectedSizeId = id;
	}

	function chooseCustom() {
		customMode = true;
	}

	function handleCancel() {
		oncancel?.();
	}

	function handleConfirm() {
		if (!canConfirm) return;
		const cut: AcrylicCut = customMode
			? {
					width_cm: Number(customWidth),
					height_cm: Number(customHeight),
					size_id: 'custom',
					unit_price: unitPrice,
					label: cutLabel
				}
			: {
					width_cm: selectedCutSize!.width,
					height_cm: selectedCutSize!.height,
					size_id: selectedCutSize!.id,
					unit_price: unitPrice,
					label: cutLabel
				};
		onconfirm?.(cut);
	}

	function formatMoney(n: number) {
		return new Intl.NumberFormat('es-MX', {
			style: 'currency',
			currency: 'MXN',
			maximumFractionDigits: 0
		}).format(n || 0);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="acrylic-cut-picker-title"
	>
		<div class="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-auto">
			<div class="flex items-start justify-between gap-3 mb-4">
				<div>
					<h2 id="acrylic-cut-picker-title" class="text-lg font-semibold text-gray-900">{title}</h2>
					<p class="text-sm text-gray-500 mt-1">
						Precio lámina: {formatMoney(Number(sheetPrice) || 0)}
					</p>
				</div>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600 text-xl leading-none"
					onclick={handleCancel}
					aria-label="Cerrar"
				>
					×
				</button>
			</div>

			{#if loadingConfig && !config}
				<p class="text-sm text-gray-500 py-6 text-center">Cargando tamaños…</p>
			{:else}
				<p class="text-sm font-medium text-gray-700 mb-2">Tamaño</p>
				<div class="flex flex-wrap gap-2">
					{#each enabledSizes as size (size.id)}
						<button
							type="button"
							onclick={() => chooseSize(size.id)}
							class="px-3 py-2 rounded-lg border-2 text-sm transition {!customMode &&
							selectedSizeId === size.id
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

				{#if customMode}
					<div class="mt-4 grid grid-cols-2 gap-3">
						<div>
							<label class="block text-xs text-gray-600 mb-1" for="acrylic-cut-w">Ancho (cm)</label>
							<input
								id="acrylic-cut-w"
								type="number"
								min={activeConfig.custom.min_width_cm}
								max={activeConfig.custom.max_width_cm}
								bind:value={customWidth}
								class="w-full border rounded-lg px-3 py-2"
							/>
						</div>
						<div>
							<label class="block text-xs text-gray-600 mb-1" for="acrylic-cut-h">Alto (cm)</label>
							<input
								id="acrylic-cut-h"
								type="number"
								min={activeConfig.custom.min_height_cm}
								max={activeConfig.custom.max_height_cm}
								bind:value={customHeight}
								class="w-full border rounded-lg px-3 py-2"
							/>
						</div>
					</div>
					{#if customDimError}
						<p class="text-sm text-red-600 mt-2">{customDimError}</p>
					{/if}
				{/if}

				<div class="mt-5 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
					<p class="text-sm text-gray-600">
						Corte: <span class="font-medium text-gray-900">{cutLabel || '—'}</span>
					</p>
					<p class="text-lg font-semibold text-gray-900 mt-1">{formatMoney(unitPrice)}</p>
				</div>
			{/if}

			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					class="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
					onclick={handleCancel}
				>
					Cancelar
				</button>
				<button
					type="button"
					class="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
					disabled={!canConfirm || (loadingConfig && !config)}
					onclick={handleConfirm}
				>
					Agregar
				</button>
			</div>
		</div>
	</div>
{/if}
