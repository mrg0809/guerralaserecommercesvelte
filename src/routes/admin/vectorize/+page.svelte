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
	let simplifyMm = $state(0.3);
	let useExternalOnly = $state(true);

	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);

	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let lastDxfB64 = $state<string | null>(null);
	let lastPltB64 = $state<string | null>(null);
	let lastContourCount = $state(0);
	let lastBbox = $state<{ width: number; height: number } | null>(null);
	let lastWarnings = $state<string[]>([]);

	$effect(() => {
		if (preset === 'tarjeta') {
			targetW = PRESETS.tarjeta.width;
			targetH = PRESETS.tarjeta.height;
		} else if (preset === 'termo') {
			targetW = PRESETS.termo.width;
			targetH = PRESETS.termo.height;
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

	function onPresetChange(id: PresetId) {
		preset = id;
	}

	function onFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		selectedFile = file ?? null;
		previewUrl = file ? URL.createObjectURL(file) : null;
		lastDxfB64 = null;
		lastPltB64 = null;
	}

	async function generar() {
		errorMsg = null;
		lastWarnings = [];
		if (!selectedFile) {
			errorMsg = 'Selecciona una imagen primero.';
			return;
		}
		if (targetW <= 0 || targetH <= 0) {
			errorMsg = 'El área de grabado debe ser mayor que 0.';
			return;
		}

		loading = true;
		lastDxfB64 = null;
		lastPltB64 = null;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session?.access_token) {
				errorMsg = 'Sesión no válida. Vuelve a iniciar sesión.';
				return;
			}

			const form = new FormData();
			form.append('file', selectedFile);
			form.append('target_width_mm', String(targetW));
			form.append('target_height_mm', String(targetH));
			form.append('threshold', String(threshold));
			form.append('invert', invert ? 'true' : 'false');
			form.append('min_area_mm2', String(minAreaMm2));
			form.append('simplify_epsilon_mm', String(simplifyMm));
			form.append('output', 'both');
			form.append('use_external_only', useExternalOnly ? 'true' : 'false');

			const res = await fetch('/api/vectorize', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${session.access_token}`
				},
				body: form
			});

			const json = (await res.json()) as VectorizeApiResult;
			if (!res.ok || !json.success) {
				errorMsg = json.error || json.detail || `Error ${res.status}`;
				return;
			}

			lastDxfB64 = json.dxf_base64 ?? null;
			lastPltB64 = json.plt_base64 ?? null;
			lastContourCount = json.contour_count ?? 0;
			lastBbox = json.bbox_mm ?? null;
			lastWarnings = json.warnings ?? [];
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error de red';
		} finally {
			loading = false;
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

<div class="container mx-auto max-w-4xl px-4 py-6">
	<h1 class="mb-2 text-2xl font-bold text-gray-900">Imagen → DXF / PLT</h1>
	<p class="mb-6 text-gray-600">
		Convierte un logo o diseño raster en vectores para grabado láser (termos, tarjetas). Ajusta el umbral como en Inkscape
		«Trace Bitmap». Importa el DXF o PLT en RDWorks / LightBurn.
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
			{#if previewUrl}
				<div class="mt-4 flex justify-center rounded border border-gray-100 bg-gray-50 p-4">
					<img src={previewUrl} alt="Vista previa" class="max-h-64 max-w-full object-contain" />
				</div>
			{/if}
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
			<h2 class="mb-3 text-lg font-semibold">Umbral y limpieza</h2>
			<div class="space-y-4">
				<label class="block text-sm">
					<span class="text-gray-600">Umbral de luminosidad ({threshold})</span>
					<input type="range" bind:value={threshold} min="0" max="255" class="mt-2 w-full" />
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={invert} />
					<span>Invertir (grabar zonas claras en lugar de oscuras)</span>
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={useExternalOnly} />
					<span>Solo contornos externos (menos ruido; desactiva para huecos en letras O, A)</span>
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
						<span class="text-gray-600">Simplificar (mm)</span>
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

		{#if lastContourCount > 0}
			<div class="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
				{lastContourCount} contorno(s)
				{#if lastBbox}
					— bbox dibujo: {lastBbox.width}×{lastBbox.height} mm
				{/if}
			</div>
		{/if}

		<div class="flex flex-wrap gap-3">
			<button
				type="button"
				class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				disabled={loading || !selectedFile}
				onclick={generar}
			>
				{loading ? 'Procesando…' : 'Generar DXF y PLT'}
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
	</div>
</div>
