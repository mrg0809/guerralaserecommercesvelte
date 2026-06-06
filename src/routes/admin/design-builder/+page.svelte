<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Canvas as FabricCanvas } from 'fabric';
	import { supabase } from '$lib/supabaseClient';
	import DesignCanvas from '$lib/components/admin/design-builder/DesignCanvas.svelte';
	import iconLibrary from '$lib/design-builder/icon-library.json';
	import productsConfig from '$lib/design-builder/products.json';
	import { LASER_FONTS, loadAllLaserFonts, loadLaserFont } from '$lib/design-builder/fonts';
	import {
		addIconFromLibrary,
		addQrToCanvas,
		addTextToCanvas,
		downloadDxf,
		exportNativeSvg
	} from '$lib/design-builder/fabricCanvas';
	import type { IconCategory, ProductPresetId } from '$lib/types/design-builder';

	type TabId = 'texto' | 'qr' | 'iconos';

	const presets = productsConfig.presets;

	let presetId = $state<ProductPresetId>('tarjeta_metalica');
	let widthMm = $state(86);
	let heightMm = $state(54);
	let activeTab = $state<TabId>('texto');

	let textContent = $state('Guerra Láser');
	let fontFamily = $state('Roboto');
	let fontSize = $state(24);
	let qrContent = $state('https://guerralaser.com');
	let qrSize = $state(80);
	let selectedCategory = $state(iconLibrary.categories[0]?.id ?? 'lineas');

	let fabricCanvas: FabricCanvas | null = $state(null);
	let exportLoading = $state(false);
	let errorMsg = $state<string | null>(null);

	const categories = iconLibrary.categories as IconCategory[];

	$effect(() => {
		const preset = presets.find((p) => p.id === presetId);
		if (preset && presetId !== 'custom') {
			widthMm = preset.widthMm;
			heightMm = preset.heightMm;
		}
	});

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			goto('/login');
			return;
		}
		await loadAllLaserFonts();
	});

	function onCanvasReady(canvas: FabricCanvas) {
		fabricCanvas = canvas;
	}

	async function handleAddText() {
		if (!fabricCanvas || !textContent.trim()) return;
		errorMsg = null;
		await loadLaserFont(fontFamily);
		addTextToCanvas(fabricCanvas, textContent.trim(), fontFamily, fontSize);
	}

	async function handleAddQr() {
		if (!fabricCanvas || !qrContent.trim()) return;
		errorMsg = null;
		await addQrToCanvas(fabricCanvas, qrContent.trim(), qrSize);
	}

	async function handleAddIcon(path: string) {
		if (!fabricCanvas) return;
		errorMsg = null;
		try {
			await addIconFromLibrary(fabricCanvas, path);
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'No se pudo cargar el icono';
		}
	}

	function handleDeleteSelected() {
		if (!fabricCanvas) return;
		const active = fabricCanvas.getActiveObjects();
		if (!active.length) return;
		active.forEach((obj) => fabricCanvas!.remove(obj));
		fabricCanvas.discardActiveObject();
		fabricCanvas.requestRenderAll();
	}

	function handleClearCanvas() {
		if (!fabricCanvas) return;
		fabricCanvas.clear();
		fabricCanvas.backgroundColor = '#ffffff';
		fabricCanvas.requestRenderAll();
	}

	async function handleExportDxf() {
		if (!fabricCanvas) return;
		if (widthMm <= 0 || heightMm <= 0) {
			errorMsg = 'Las dimensiones deben ser mayores que 0.';
			return;
		}

		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session?.access_token) {
			errorMsg = 'Sesión no válida. Vuelve a iniciar sesión.';
			return;
		}

		errorMsg = null;
		exportLoading = true;
		try {
			const svg = exportNativeSvg(fabricCanvas, widthMm, heightMm);
			await downloadDxf(svg, widthMm, heightMm, session.access_token);
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error al exportar DXF';
		} finally {
			exportLoading = false;
		}
	}

	const activeCategory = $derived(categories.find((c) => c.id === selectedCategory) ?? categories[0]);
</script>

<svelte:head>
	<title>Constructor de diseños | Admin</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-gray-900">Constructor de diseños</h1>
		<p class="mt-1 text-sm text-gray-600">
			Crea diseños vectoriales para tarjetas, termos y más. Exporta DXF listo para LightBurn.
		</p>
	</div>

	{#if errorMsg}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{errorMsg}
		</div>
	{/if}

	<div class="mb-4 rounded-lg border bg-white p-4">
		<div class="flex flex-wrap items-end gap-4">
			<div>
				<label for="preset" class="mb-1 block text-xs font-medium text-gray-600">Producto</label>
				<select
					id="preset"
					bind:value={presetId}
					class="rounded-md border border-gray-300 px-3 py-2 text-sm"
				>
					{#each presets as p}
						<option value={p.id}>{p.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="widthMm" class="mb-1 block text-xs font-medium text-gray-600">Ancho (mm)</label>
				<input
					id="widthMm"
					type="number"
					min="1"
					max="500"
					step="0.1"
					bind:value={widthMm}
					disabled={presetId !== 'custom'}
					class="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
				/>
			</div>
			<div>
				<label for="heightMm" class="mb-1 block text-xs font-medium text-gray-600">Alto (mm)</label>
				<input
					id="heightMm"
					type="number"
					min="1"
					max="500"
					step="0.1"
					bind:value={heightMm}
					disabled={presetId !== 'custom'}
					class="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
				/>
			</div>
			<div class="ml-auto flex gap-2">
				<button
					type="button"
					onclick={handleDeleteSelected}
					class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
				>
					Eliminar seleccionado
				</button>
				<button
					type="button"
					onclick={handleClearCanvas}
					class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
				>
					Limpiar lienzo
				</button>
				<button
					type="button"
					onclick={handleExportDxf}
					disabled={exportLoading}
					class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
				>
					{exportLoading ? 'Exportando…' : 'Exportar DXF'}
				</button>
			</div>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-[320px_1fr]">
		<aside class="rounded-lg border bg-white">
			<div class="flex border-b">
				{#each [
					{ id: 'texto' as TabId, label: 'Texto' },
					{ id: 'qr' as TabId, label: 'QR' },
					{ id: 'iconos' as TabId, label: 'Iconos' }
				] as tab}
					<button
						type="button"
						onclick={() => (activeTab = tab.id)}
						class="flex-1 px-3 py-2.5 text-sm font-medium {activeTab === tab.id
							? 'border-b-2 border-gray-900 text-gray-900'
							: 'text-gray-500 hover:text-gray-700'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<div class="p-4">
				{#if activeTab === 'texto'}
					<div class="space-y-3">
						<div>
							<label for="textContent" class="mb-1 block text-xs font-medium text-gray-600">Texto</label>
							<input
								id="textContent"
								type="text"
								bind:value={textContent}
								class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="fontFamily" class="mb-1 block text-xs font-medium text-gray-600">Fuente</label>
							<select
								id="fontFamily"
								bind:value={fontFamily}
								class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							>
								{#each LASER_FONTS as font}
									<option value={font.family}>{font.family}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="fontSize" class="mb-1 block text-xs font-medium text-gray-600">Tamaño (px)</label>
							<input
								id="fontSize"
								type="number"
								min="8"
								max="200"
								bind:value={fontSize}
								class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
						</div>
						<button
							type="button"
							onclick={handleAddText}
							class="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
						>
							Añadir texto
						</button>
					</div>
				{:else if activeTab === 'qr'}
					<div class="space-y-3">
						<div>
							<label for="qrContent" class="mb-1 block text-xs font-medium text-gray-600">URL o texto</label>
							<input
								id="qrContent"
								type="text"
								bind:value={qrContent}
								class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="qrSize" class="mb-1 block text-xs font-medium text-gray-600">Tamaño (px)</label>
							<input
								id="qrSize"
								type="number"
								min="40"
								max="300"
								bind:value={qrSize}
								class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
						</div>
						<button
							type="button"
							onclick={handleAddQr}
							class="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
						>
							Añadir QR
						</button>
					</div>
				{:else if activeTab === 'iconos'}
					<div class="space-y-3">
						<div>
							<label for="category" class="mb-1 block text-xs font-medium text-gray-600">Categoría</label>
							<select
								id="category"
								bind:value={selectedCategory}
								class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							>
								{#each categories as cat}
									<option value={cat.id}>{cat.label}</option>
								{/each}
							</select>
						</div>
						<div class="grid grid-cols-2 gap-2">
							{#each activeCategory?.icons ?? [] as icon}
								<button
									type="button"
									onclick={() => handleAddIcon(icon.path)}
									class="flex flex-col items-center gap-1 rounded-md border border-gray-200 p-2 text-xs hover:border-gray-400 hover:bg-gray-50"
									title={icon.name}
								>
									<img src={icon.path} alt={icon.name} class="h-10 w-10 object-contain" />
									<span class="truncate text-center">{icon.name}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</aside>

		<section class="rounded-lg border bg-white p-4">
			<h2 class="mb-3 text-sm font-medium text-gray-700">
				Lienzo — {widthMm}×{heightMm} mm
			</h2>
			{#key `${widthMm}-${heightMm}`}
				<DesignCanvas {widthMm} {heightMm} onReady={onCanvasReady} />
			{/key}
			<p class="mt-3 text-xs text-gray-500">
				Arrastra, escala y rota los elementos. Cada nuevo elemento se coloca en una cuadrícula para evitar
				solapamientos. El QR se exporta como trazos vectoriales (esquina superior derecha).
			</p>
		</section>
	</div>
</div>
