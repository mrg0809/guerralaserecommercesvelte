<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import type { VectorizeApiResult } from '$lib/types/vectorize';

	type PresetId = 'tarjeta' | 'termo' | 'custom';

	const PRESETS: Record<Exclude<PresetId, 'custom'>, { width: number; height: number; label: string }> = {
		tarjeta: { width: 90, height: 50, label: 'Tarjeta de presentación (90×50 mm)' },
		termo: { width: 60, height: 60, label: 'Termo / grabado circular (~60×60 mm)' }
	};

	let preset = $state<PresetId>('tarjeta');
	let targetW = $state(90);
	let targetH = $state(50);
	let threshold = $state(127);
	let invert = $state(false);
	let minAreaMm2 = $state(0.5);
	let simplifyMm = $state(0.05);
	let useExternalOnly = $state(true);
	let useAdaptiveThreshold = $state(false);
	let lastThresholdMode = $state<string | null>(null);

	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let maskPreviewUrl = $state<string | null>(null);
	let pathsPreviewUrl = $state<string | null>(null);

	let previewLoading = $state(false);
	let exportLoading = $state(false);
	let errorMsg = $state<string | null>(null);
	let previewStale = $state(true);

	let lastDxfB64 = $state<string | null>(null);
	let lastPltB64 = $state<string | null>(null);
	let lastContourCount = $state(0);
	let lastContoursRaw = $state(0);
	let lastContoursKept = $state(0);
	let lastBbox = $state<{ width: number; height: number } | null>(null);
	let lastWarnings = $state<string[]>([]);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (preset === 'tarjeta') {
			targetW = PRESETS.tarjeta.width;
			targetH = PRESETS.tarjeta.height;
		} else if (preset === 'termo') {
			targetW = PRESETS.termo.width;
			targetH = PRESETS.termo.height;
		}
	});

	$effect(() => {
		threshold;
		invert;
		minAreaMm2;
		simplifyMm;
		useExternalOnly;
		useAdaptiveThreshold;
		targetW;
		targetH;
		if (selectedFile) {
			previewStale = true;
			schedulePreview();
		}
	});

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			goto('/login');
		}
	});

	function pngDataUrl(b64: string): string {
		return `data:image/png;base64,${b64}`;
	}

	function onPresetChange(id: PresetId) {
		preset = id;
	}

	function applyLogoDetalladoPreset() {
		useAdaptiveThreshold = true;
		minAreaMm2 = 8;
		simplifyMm = 0.05;
		threshold = 127;
		useExternalOnly = true;
	}

	function onThresholdInput() {
		useAdaptiveThreshold = false;
	}

	function onFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		selectedFile = file ?? null;
		previewUrl = file ? URL.createObjectURL(file) : null;
		maskPreviewUrl = null;
		pathsPreviewUrl = null;
		lastDxfB64 = null;
		lastPltB64 = null;
		previewStale = true;
		if (file) schedulePreview();
	}

	function schedulePreview() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			void actualizarVistaPrevia();
		}, 450);
	}

	async function callTrace(previewOnly: boolean): Promise<VectorizeApiResult | null> {
		if (!selectedFile) return null;
		if (targetW <= 0 || targetH <= 0) {
			errorMsg = 'El área de grabado debe ser mayor que 0.';
			return null;
		}

		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session?.access_token) {
			errorMsg = 'Sesión no válida. Vuelve a iniciar sesión.';
			return null;
		}

		const form = new FormData();
		form.append('file', selectedFile);
		form.append('target_width_mm', String(targetW));
		form.append('target_height_mm', String(targetH));
		form.append('threshold', String(threshold));
		form.append('invert', invert ? 'true' : 'false');
		form.append('min_area_mm2', String(minAreaMm2));
		form.append('simplify_epsilon_mm', String(simplifyMm));
		form.append('use_external_only', useExternalOnly ? 'true' : 'false');
		form.append('use_adaptive_threshold', useAdaptiveThreshold ? 'true' : 'false');
		form.append('preview_only', previewOnly ? 'true' : 'false');
		if (!previewOnly) {
			form.append('output', 'both');
		}

		const res = await fetch('/api/vectorize', {
			method: 'POST',
			headers: { Authorization: `Bearer ${session.access_token}` },
			body: form
		});

		const json = (await res.json()) as VectorizeApiResult;
		if (!res.ok || !json.success) {
			errorMsg = json.error || json.detail || `Error ${res.status}`;
			return null;
		}
		return json;
	}

	async function actualizarVistaPrevia() {
		if (!selectedFile) return;
		errorMsg = null;
		previewLoading = true;
		try {
			const json = await callTrace(true);
			if (!json) return;

			if (json.preview_mask_base64) {
				maskPreviewUrl = pngDataUrl(json.preview_mask_base64);
			}
			if (json.preview_paths_base64) {
				pathsPreviewUrl = pngDataUrl(json.preview_paths_base64);
			}
			lastContourCount = json.contour_count ?? 0;
			lastContoursRaw = json.contours_raw ?? 0;
			lastContoursKept = json.contours_kept ?? 0;
			lastBbox = json.bbox_mm ?? null;
			lastWarnings = json.warnings ?? [];
			lastThresholdMode = json.threshold_mode ?? null;
			previewStale = false;
			lastDxfB64 = null;
			lastPltB64 = null;
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error de red';
		} finally {
			previewLoading = false;
		}
	}

	async function generarArchivos() {
		if (!selectedFile) {
			errorMsg = 'Selecciona una imagen primero.';
			return;
		}
		if (previewStale) {
			await actualizarVistaPrevia();
			if (lastContourCount === 0) return;
		}

		errorMsg = null;
		exportLoading = true;
		try {
			const json = await callTrace(false);
			if (!json) return;

			lastDxfB64 = json.dxf_base64 ?? null;
			lastPltB64 = json.plt_base64 ?? null;
			if (json.preview_mask_base64) maskPreviewUrl = pngDataUrl(json.preview_mask_base64);
			if (json.preview_paths_base64) pathsPreviewUrl = pngDataUrl(json.preview_paths_base64);
			lastContourCount = json.contour_count ?? lastContourCount;
			lastContoursRaw = json.contours_raw ?? lastContoursRaw;
			lastContoursKept = json.contours_kept ?? lastContoursKept;
			lastBbox = json.bbox_mm ?? lastBbox;
			lastWarnings = json.warnings ?? lastWarnings;
			lastThresholdMode = json.threshold_mode ?? lastThresholdMode;
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error de red';
		} finally {
			exportLoading = false;
		}
	}

	function downloadBase64(b64: string, ext: 'dxf' | 'plt') {
		const bin = atob(b64);
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		const mime = ext === 'dxf' ? 'application/dxf' : 'application/plt';
		const blob = new Blob([bytes], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		a.download = `grabado_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function descargarDxf() {
		if (lastDxfB64) downloadBase64(lastDxfB64, 'dxf');
	}

	function descargarPlt() {
		if (lastPltB64) downloadBase64(lastPltB64, 'plt');
	}
</script>

<svelte:head>
	<title>Imagen a DXF/PLT — Admin</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-6">
	<h1 class="mb-2 text-2xl font-bold text-gray-900">Imagen → DXF / PLT</h1>
	<p class="mb-6 text-gray-600">
		El láser solo graba o no graba (sin intensidades). Ajusta el umbral hasta que la vista previa muestre
		<strong>líneas negras = trayectoria de grabado</strong>. Cuando se vea bien, genera y descarga los archivos.
	</p>

	<div class="space-y-6">
		<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-lg font-semibold">Imagen</h2>
			<input
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
				class="block w-full text-sm text-gray-600"
				onchange={onFileSelect}
			/>
		</section>

		<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-lg font-semibold">Área de grabado</h2>
			<div class="mb-4 flex flex-wrap gap-2">
				{#each Object.entries(PRESETS) as [id, p]}
					<button
						type="button"
						class="rounded-lg border px-3 py-2 text-sm {preset === id
							? 'border-blue-600 bg-blue-50 text-blue-800'
							: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
						onclick={() => onPresetChange(id as PresetId)}
					>
						{p.label}
					</button>
				{/each}
				<button
					type="button"
					class="rounded-lg border px-3 py-2 text-sm {preset === 'custom'
						? 'border-blue-600 bg-blue-50 text-blue-800'
						: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
					onclick={() => onPresetChange('custom')}
				>
					Personalizado
				</button>
			</div>
			<div class="flex flex-wrap gap-4">
				<label class="block text-sm">
					<span class="text-gray-600">Ancho (mm)</span>
					<input
						type="number"
						bind:value={targetW}
						min="1"
						step="0.1"
						class="mt-1 block w-28 rounded border px-2 py-1"
						oninput={() => (preset = 'custom')}
					/>
				</label>
				<label class="block text-sm">
					<span class="text-gray-600">Alto (mm)</span>
					<input
						type="number"
						bind:value={targetH}
						min="1"
						step="0.1"
						class="mt-1 block w-28 rounded border px-2 py-1"
						oninput={() => (preset = 'custom')}
					/>
				</label>
			</div>
		</section>

		<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-lg font-semibold">Umbral y limpieza</h2>
				<button
					type="button"
					class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
					onclick={applyLogoDetalladoPreset}
				>
					Preset logo con relieve
				</button>
			</div>
			<div class="space-y-4">
				<label class="block text-sm">
					<span class="text-gray-600">
						{#if useAdaptiveThreshold}
							Umbral automático por zonas (adaptativo)
						{:else}
							Umbral de luminosidad ({threshold})
						{/if}
					</span>
					<input
						type="range"
						bind:value={threshold}
						min="0"
						max="255"
						disabled={useAdaptiveThreshold}
						class="mt-2 w-full disabled:opacity-40"
						oninput={onThresholdInput}
					/>
				</label>
				<p class="text-xs text-gray-500">
					Logo plano B/N: mueve el umbral. Logo con relieve 3D: usa el preset «Logo con relieve» (umbral adaptativo).
				</p>
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={invert} />
					<span>Invertir qué zonas se graban</span>
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={useExternalOnly} />
					<span>Solo contornos externos (menos ruido; desactiva para huecos O, A)</span>
				</label>
				<div class="flex flex-wrap gap-4">
					<label class="block text-sm">
						<span class="text-gray-600">Área mínima (mm²)</span>
						<input
							type="number"
							bind:value={minAreaMm2}
							min="0"
							step="0.1"
							class="mt-1 block w-28 rounded border px-2 py-1"
						/>
					</label>
					<label class="block text-sm">
						<span class="text-gray-600">Simplificar trazos (mm)</span>
						<input
							type="number"
							bind:value={simplifyMm}
							min="0"
							step="0.1"
							class="mt-1 block w-28 rounded border px-2 py-1"
						/>
					</label>
				</div>
			</div>
		</section>

		{#if selectedFile}
			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-lg font-semibold">Vista previa del grabado</h2>
					<button
						type="button"
						class="rounded-lg border border-blue-600 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
						disabled={previewLoading || !selectedFile}
						onclick={actualizarVistaPrevia}
					>
						{previewLoading ? 'Calculando…' : previewStale ? 'Actualizar vista previa' : 'Recalcular'}
					</button>
				</div>
				<p class="mb-4 text-sm text-gray-500">
					La vista previa se actualiza sola al mover los controles. <strong>Máscara</strong>: zonas
					detectadas. <strong>Trazos</strong>: líneas que irán al láser (tras filtro y simplificación).
				</p>

				<div class="grid gap-4 sm:grid-cols-3">
					<div>
						<p class="mb-2 text-center text-xs font-medium text-gray-600">Original</p>
						<div class="flex min-h-[160px] items-center justify-center rounded border bg-gray-50 p-2">
							{#if previewUrl}
								<img src={previewUrl} alt="Original" class="max-h-48 max-w-full object-contain" />
							{/if}
						</div>
					</div>
					<div>
						<p class="mb-2 text-center text-xs font-medium text-gray-600">Máscara (zonas)</p>
						<div class="flex min-h-[160px] items-center justify-center rounded border bg-gray-50 p-2">
							{#if previewLoading}
								<span class="text-sm text-gray-400">…</span>
							{:else if maskPreviewUrl}
								<img src={maskPreviewUrl} alt="Máscara" class="max-h-48 max-w-full object-contain" />
							{:else}
								<span class="text-sm text-gray-400">Sin vista previa</span>
							{/if}
						</div>
					</div>
					<div>
						<p class="mb-2 text-center text-xs font-medium text-gray-600">Trazos (láser)</p>
						<div class="flex min-h-[160px] items-center justify-center rounded border bg-gray-50 p-2">
							{#if previewLoading}
								<span class="text-sm text-gray-400">…</span>
							{:else if pathsPreviewUrl}
								<img src={pathsPreviewUrl} alt="Trazos" class="max-h-48 max-w-full object-contain" />
							{:else}
								<span class="text-sm text-gray-400">Sin vista previa</span>
							{/if}
						</div>
					</div>
				</div>

				{#if !previewLoading && lastContoursRaw > 0}
					<p class="mt-3 text-sm text-gray-600">
						Modo: {lastThresholdMode === 'adaptive' ? 'umbral adaptativo' : 'umbral fijo'} —
						Detectados: {lastContoursRaw} — tras filtro: {lastContoursKept} — en archivo: {lastContourCount}
						trazo(s)
						{#if lastBbox}
							— tamaño ~{lastBbox.width}×{lastBbox.height} mm
						{/if}
					</p>
				{/if}
			</section>
		{/if}

		{#if errorMsg}
			<div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errorMsg}</div>
		{/if}

		{#if lastWarnings.length > 0}
			<div class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
				<ul class="list-inside list-disc">
					{#each lastWarnings as w}
						<li>{w}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="flex flex-wrap gap-3">
			<button
				type="button"
				class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				disabled={exportLoading || previewLoading || !selectedFile || lastContourCount === 0}
				onclick={generarArchivos}
			>
				{exportLoading ? 'Generando archivos…' : 'Generar DXF y PLT'}
			</button>
			<button
				type="button"
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
				disabled={!lastDxfB64}
				onclick={descargarDxf}
			>
				Descargar DXF
			</button>
			<button
				type="button"
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
				disabled={!lastPltB64}
				onclick={descargarPlt}
			>
				Descargar PLT (RDWorks)
			</button>
		</div>
		{#if selectedFile && lastContourCount === 0 && !previewLoading}
			<p class="text-sm text-gray-500">Ajusta el umbral o el preset hasta ver trazos en la vista previa.</p>
		{/if}
	</div>
</div>
