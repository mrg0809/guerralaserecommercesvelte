<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import {
		DEFAULT_ACRYLIC_PRICING,
		sheetAreaCm2,
		sizePrice,
		type AcrylicPricingConfig,
		type AcrylicSizeConfig
	} from '$lib/acrylicPricing';

	let loading = $state(true);
	let saving = $state(false);
	let config = $state<AcrylicPricingConfig>(structuredClone(DEFAULT_ACRYLIC_PRICING));
	let message = $state('');
	let errorMsg = $state('');
	let previewSheetPrice = $state(5000);

	async function getToken() {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		return session?.access_token || null;
	}

	async function load() {
		loading = true;
		errorMsg = '';
		try {
			const token = await getToken();
			if (!token) {
				errorMsg = 'No autorizado';
				return;
			}
			const res = await fetch('/api/admin/settings/acrylic-pricing', {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo cargar');
			config = data.config;
		} catch (e: any) {
			errorMsg = e?.message || 'Error al cargar';
		} finally {
			loading = false;
		}
	}

	function addSize() {
		const id = `nuevo-${Date.now()}`;
		config = {
			...config,
			sizes: [...config.sizes, { id, width: 60, height: 40, factor: 1.3, enabled: true }]
		};
	}

	function removeSize(index: number) {
		config = { ...config, sizes: config.sizes.filter((_, i) => i !== index) };
	}

	function addRule() {
		config = {
			...config,
			custom: {
				...config.custom,
				factor_rules: [...config.custom.factor_rules, { min_area_cm2: 0, factor: 2 }]
			}
		};
	}

	function removeRule(index: number) {
		config = {
			...config,
			custom: {
				...config.custom,
				factor_rules: config.custom.factor_rules.filter((_, i) => i !== index)
			}
		};
	}

	function previewPrice(size: AcrylicSizeConfig) {
		return sizePrice(previewSheetPrice, size.width, size.height, size.factor, config);
	}

	async function save() {
		saving = true;
		message = '';
		errorMsg = '';
		try {
			const token = await getToken();
			if (!token) throw new Error('No autorizado');

			// Normalizar ids de tamaños
			config = {
				...config,
				sizes: config.sizes.map((s) => ({
					...s,
					id: `${s.width}x${s.height}`,
					width: Number(s.width),
					height: Number(s.height),
					factor: Number(s.factor)
				})),
				custom: {
					...config.custom,
					factor_rules: [...config.custom.factor_rules]
						.map((r) => ({
							min_area_cm2: Number(r.min_area_cm2),
							factor: Number(r.factor)
						}))
						.sort((a, b) => b.min_area_cm2 - a.min_area_cm2)
				}
			};

			const res = await fetch('/api/admin/settings/acrylic-pricing', {
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ config })
			});
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.error || 'Error al guardar');
			config = data.config;
			message = 'Configuración de acrílico guardada';
		} catch (e: any) {
			errorMsg = e?.message || 'Error al guardar';
		} finally {
			saving = false;
		}
	}

	onMount(load);
</script>

<div class="p-6 max-w-5xl mx-auto">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-gray-900">Acrílico: tamaños y factores</h1>
		<p class="text-gray-600 mt-1">
			Configuración global. En productos solo das de alta láminas 122×244 (color + grosor). Los
			cortes y el tamaño personalizado usan estos factores.
		</p>
	</div>

	{#if loading}
		<div class="bg-white rounded-lg shadow p-8 text-center text-gray-600">Cargando...</div>
	{:else}
		{#if errorMsg}
			<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
				{errorMsg}
			</div>
		{/if}
		{#if message}
			<div class="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700 text-sm">
				{message}
			</div>
		{/if}

		<div class="bg-white rounded-lg shadow border p-5 mb-6">
			<h2 class="font-semibold text-gray-900 mb-2">Lámina base</h2>
			<p class="text-sm text-gray-600">
				{config.sheet_width_cm} × {config.sheet_height_cm} cm — área
				<strong>{sheetAreaCm2(config).toLocaleString('es-MX')}</strong> cm²
			</p>
			<div class="mt-3 max-w-xs">
				<label class="block text-sm font-medium text-gray-700 mb-1" for="preview-price"
					>Precio ejemplo lámina (preview)</label
				>
				<input
					id="preview-price"
					type="number"
					min="0"
					bind:value={previewSheetPrice}
					class="w-full border rounded-lg px-3 py-2"
				/>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow border p-5 mb-6">
			<div class="flex items-center justify-between mb-3">
				<h2 class="font-semibold text-gray-900">Tamaños de venta</h2>
				<button
					type="button"
					class="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50"
					onclick={addSize}>+ Agregar</button
				>
			</div>
			<div class="overflow-auto">
				<table class="w-full text-sm">
					<thead class="bg-gray-50 text-left">
						<tr>
							<th class="px-2 py-2">Ancho</th>
							<th class="px-2 py-2">Alto</th>
							<th class="px-2 py-2">Factor</th>
							<th class="px-2 py-2">Activo</th>
							<th class="px-2 py-2">Preview $</th>
							<th class="px-2 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each config.sizes as size, idx}
							<tr class="border-t">
								<td class="px-2 py-2">
									<input type="number" class="w-20 border rounded px-2 py-1" bind:value={size.width} />
								</td>
								<td class="px-2 py-2">
									<input type="number" class="w-20 border rounded px-2 py-1" bind:value={size.height} />
								</td>
								<td class="px-2 py-2">
									<input
										type="number"
										step="0.01"
										class="w-24 border rounded px-2 py-1"
										bind:value={size.factor}
									/>
								</td>
								<td class="px-2 py-2">
									<input type="checkbox" bind:checked={size.enabled} />
								</td>
								<td class="px-2 py-2 font-mono text-xs">${previewPrice(size).toLocaleString('es-MX')}</td>
								<td class="px-2 py-2">
									<button type="button" class="text-red-600 text-xs" onclick={() => removeSize(idx)}
										>Quitar</button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-xs text-gray-500 mt-2">
				Precio corte = ROUND(precio_lámina × (ancho×alto / área_lámina) × factor)
			</p>
		</div>

		<div class="bg-white rounded-lg shadow border p-5 mb-6">
			<div class="flex items-center justify-between mb-3">
				<h2 class="font-semibold text-gray-900">Corte personalizado</h2>
				<label class="inline-flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={config.custom.enabled} />
					Habilitado
				</label>
			</div>

			<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
				<div>
					<label class="block text-xs text-gray-600 mb-1">Ancho mín</label>
					<input type="number" class="w-full border rounded px-2 py-1" bind:value={config.custom.min_width_cm} />
				</div>
				<div>
					<label class="block text-xs text-gray-600 mb-1">Ancho máx</label>
					<input type="number" class="w-full border rounded px-2 py-1" bind:value={config.custom.max_width_cm} />
				</div>
				<div>
					<label class="block text-xs text-gray-600 mb-1">Alto mín</label>
					<input type="number" class="w-full border rounded px-2 py-1" bind:value={config.custom.min_height_cm} />
				</div>
				<div>
					<label class="block text-xs text-gray-600 mb-1">Alto máx</label>
					<input type="number" class="w-full border rounded px-2 py-1" bind:value={config.custom.max_height_cm} />
				</div>
			</div>

			<div class="flex items-center justify-between mb-2">
				<h3 class="text-sm font-medium text-gray-800">Reglas de factor por área (cm²)</h3>
				<button type="button" class="text-sm px-3 py-1 rounded border" onclick={addRule}>+ Regla</button>
			</div>
			<div class="space-y-2">
				{#each config.custom.factor_rules as rule, idx}
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-sm text-gray-600">Si área ≥</span>
						<input type="number" class="w-28 border rounded px-2 py-1" bind:value={rule.min_area_cm2} />
						<span class="text-sm text-gray-600">factor</span>
						<input type="number" step="0.01" class="w-24 border rounded px-2 py-1" bind:value={rule.factor} />
						<button type="button" class="text-red-600 text-xs" onclick={() => removeRule(idx)}>Quitar</button>
					</div>
				{/each}
			</div>
			<p class="text-xs text-gray-500 mt-2">
				Se aplica la regla con el umbral más alto que cumpla el área del corte.
			</p>
		</div>

		<button
			type="button"
			class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
			disabled={saving}
			onclick={save}
		>
			{saving ? 'Guardando...' : 'Guardar'}
		</button>
	{/if}
</div>
