<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import PreviewCorte from '$lib/components/admin/PreviewCorte.svelte';
	import type { LayoutPiece, NestApiResult, UnplacedPiece } from '$lib/types/nesting';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let sheetW = $state(1220);
	let sheetH = $state(2440);

	type MandRow = { id: string; width: number; height: number; quantity: number; label: string };
	function newMandRow(w = 400, h = 400, q = 1): MandRow {
		return { id: crypto.randomUUID(), width: w, height: h, quantity: q, label: '' };
	}
	let mandatoryRows = $state<MandRow[]>([newMandRow()]);

	type StockSel = { use: boolean; maxQty: number };
	let stockSel = $state<Record<string, StockSel>>({});

	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let lastLayout = $state<LayoutPiece[]>([]);
	let lastUnplaced = $state<UnplacedPiece[]>([]);
	let lastEfficiency = $state(0);
	let lastSheet = $state({ width: 1220, height: 2440 });
	let lastWasteAreaMm2 = $state(0);
	let lastWastePercent = $state(0);
	let lastVoidRegions = $state<Array<{ x: number; y: number; w: number; h: number; area_mm2: number }>>([]);
	let lastAllMandatoryPlaced = $state(true);

	$effect(() => {
		const opts = data.stockOptions;
		const next = { ...stockSel };
		let changed = false;
		for (const s of opts) {
			if (next[s.id] === undefined) {
				next[s.id] = { use: true, maxQty: 50 };
				changed = true;
			}
		}
		if (changed) stockSel = next;
	});

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			goto('/login');
			return;
		}
	});

	function addMandatoryRow() {
		mandatoryRows = [...mandatoryRows, newMandRow(100, 100, 1)];
	}

	function removeMandatoryRow(i: number) {
		mandatoryRows = mandatoryRows.filter((_, idx) => idx !== i);
		if (mandatoryRows.length === 0) {
			mandatoryRows = [newMandRow(100, 100, 1)];
		}
	}

	async function calcular() {
		errorMsg = null;
		loading = true;
		lastDxfB64 = null;
		lastPltB64 = null;
		lastWasteAreaMm2 = 0;
		lastWastePercent = 0;
		lastVoidRegions = [];
		lastAllMandatoryPlaced = true;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session?.access_token) {
				errorMsg = 'Sesión no válida. Vuelve a iniciar sesión.';
				return;
			}

			const mandatory = mandatoryRows
				.filter((r) => r.width > 0 && r.height > 0 && r.quantity > 0)
				.map((r) => ({
					width: r.width,
					height: r.height,
					quantity: Math.min(500, r.quantity),
					label: r.label.trim() || undefined
				}));

			const stock_options = data.stockOptions
				.filter((s) => stockSel[s.id]?.use)
				.map((s) => ({
					width: s.widthMm,
					height: s.heightMm,
					quantity: Math.max(1, Math.min(500, stockSel[s.id]?.maxQty ?? 50)),
					label: s.label,
					variant_id: s.id
				}));

			const res = await fetch('/api/nesting', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`
				},
				body: JSON.stringify({
					sheet_width: sheetW,
					sheet_height: sheetH,
					mandatory,
					stock_options
				})
			});

			const json = (await res.json()) as NestApiResult & { detail?: string };
			if (!res.ok || !json.success) {
				errorMsg = json.error || json.detail || `Error ${res.status}`;
				return;
			}

			lastLayout = json.layout ?? [];
			lastUnplaced = json.unplaced ?? [];
			lastEfficiency = json.efficiency ?? 0;
			lastSheet = json.sheet ?? { width: sheetW, height: sheetH };
			lastDxfB64 = json.dxf_base64 ?? null;
			lastPltB64 = json.plt_base64 ?? null;
			lastWasteAreaMm2 = json.waste_area_mm2 ?? 0;
			lastWastePercent = json.waste_percent ?? 0;
			lastVoidRegions = json.void_regions ?? [];
			lastAllMandatoryPlaced = json.all_mandatory_placed ?? true;
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error de red';
		} finally {
			loading = false;
		}
	}

	function descargarDxf() {
		if (!lastDxfB64) return;
		const bin = atob(lastDxfB64);
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		const blob = new Blob([bytes], { type: 'application/dxf' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		a.download = `corte_guerra_laser_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.dxf`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function descargarPlt() {
		if (!lastPltB64) return;
		const bin = atob(lastPltB64);
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		const blob = new Blob([bytes], { type: 'application/plt' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		a.download = `corte_guerra_laser_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.plt`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Nesting Láser — Admin</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-6">
	<h1 class="mb-2 text-2xl font-bold text-gray-900">Nesting Láser</h1>
	<p class="mb-6 text-gray-600">
		Primero se colocan todas las piezas obligatorias (varias heurísticas para encajar layouts como 4 verticales + 1 horizontal). Solo
		después se rellenan los huecos con stock estándar. Genera DXF y PLT con líneas pegadas (kerf 0).
	</p>

	{#if data.loadError}
		<div class="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
			No se pudo cargar todo el stock: {data.loadError}
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<div class="space-y-6">
			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="mb-3 text-lg font-semibold">Lámina</h2>
				<div class="flex flex-wrap gap-4">
					<label class="block text-sm">
						<span class="text-gray-600">Ancho (mm)</span>
						<input type="number" bind:value={sheetW} min="1" class="mt-1 block w-32 rounded border px-2 py-1" />
					</label>
					<label class="block text-sm">
						<span class="text-gray-600">Alto (mm)</span>
						<input type="number" bind:value={sheetH} min="1" class="mt-1 block w-32 rounded border px-2 py-1" />
					</label>
				</div>
			</section>

			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-lg font-semibold">Piezas obligatorias</h2>
					<button type="button" class="text-sm text-blue-600 hover:underline" onclick={addMandatoryRow}>+ Añadir fila</button>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full min-w-[320px] text-sm">
						<thead>
							<tr class="border-b text-left text-gray-600">
								<th class="py-2 pr-2">Ancho mm</th>
								<th class="py-2 pr-2">Alto mm</th>
								<th class="py-2 pr-2">Cant.</th>
								<th class="py-2 pr-2">Etiqueta</th>
								<th class="py-2"></th>
							</tr>
						</thead>
						<tbody>
							{#each mandatoryRows as row, i (row.id)}
								<tr class="border-b border-gray-100">
									<td class="py-2 pr-2">
										<input type="number" step="100" bind:value={row.width} min="1" class="w-20 rounded border px-2 py-1" />
									</td>
									<td class="py-2 pr-2">
										<input type="number" step="100" bind:value={row.height} min="1" class="w-20 rounded border px-2 py-1" />
									</td>
									<td class="py-2 pr-2">
										<input type="number" bind:value={row.quantity} min="1" class="w-16 rounded border px-2 py-1" />
									</td>
									<td class="py-2 pr-2">
										<input type="text" bind:value={row.label} placeholder="opcional" class="w-full min-w-[100px] rounded border px-2 py-1" />
									</td>
									<td class="py-2">
										<button type="button" class="text-red-600 hover:underline" onclick={() => removeMandatoryRow(i)}>Quitar</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="mb-2 text-lg font-semibold">Stock por tamaños estándar</h2>
				<p class="mb-3 text-sm text-gray-600">
					Se muestran solo tamaños únicos (sin separar por color): 20x30, 40x40, 60x40, 90x60, 120x60, 120x90 y 122x122 cm.
				</p>
				{#if data.stockOptions.length === 0}
					<p class="text-sm text-gray-500">No hay variantes con tamaño parseable. Revisa <code>attributes.tamano</code> en variantes.</p>
				{:else}
					<ul class="max-h-72 space-y-2 overflow-y-auto text-sm">
						{#each data.stockOptions as s}
							<li class="flex flex-wrap items-center gap-3 rounded border border-gray-100 bg-gray-50 px-3 py-2">
								<label class="flex items-center gap-2">
									<input
										type="checkbox"
										checked={stockSel[s.id]?.use ?? true}
										onchange={(e) => {
											const c = e.currentTarget.checked;
											stockSel = { ...stockSel, [s.id]: { use: c, maxQty: stockSel[s.id]?.maxQty ?? 50 } };
										}}
									/>
									<span class="font-medium text-gray-800">{s.label}</span>
									<span class="text-gray-500">({Math.round(s.widthMm)}×{Math.round(s.heightMm)} mm)</span>
									{#if s.stock != null}
										<span class="text-gray-400">stock BD: {s.stock}</span>
									{/if}
								</label>
								<label class="ml-auto flex items-center gap-1 text-gray-600">
									Máx.
									<input
										type="number"
										min="1"
										max="500"
										value={stockSel[s.id]?.maxQty ?? 50}
										disabled={!stockSel[s.id]?.use}
										class="w-16 rounded border px-2 py-1 disabled:opacity-50"
										onchange={(e) => {
											const v = parseInt(e.currentTarget.value, 10) || 1;
											stockSel = {
												...stockSel,
												[s.id]: { use: stockSel[s.id]?.use ?? true, maxQty: Math.min(500, Math.max(1, v)) }
											};
										}}
									/>
								</label>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			{#if errorMsg}
				<div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errorMsg}</div>
			{/if}

			<div class="flex flex-wrap gap-3">
				<button
					type="button"
					class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					disabled={loading}
					onclick={calcular}
				>
					{loading ? 'Calculando…' : 'Calcular acomodo'}
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

		<div>
			{#if lastLayout.length > 0}
				<PreviewCorte
					sheet={lastSheet}
					pieces={lastLayout}
					efficiency={lastEfficiency}
					unplaced={lastUnplaced}
					wasteAreaMm2={lastWasteAreaMm2}
					wastePercent={lastWastePercent}
					voidRegions={lastVoidRegions}
					allMandatoryPlaced={lastAllMandatoryPlaced}
				/>
			{:else}
				<div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
					Calcula un acomodo para ver el diagrama y habilitar la descarga DXF.
				</div>
			{/if}
		</div>
	</div>
</div>
