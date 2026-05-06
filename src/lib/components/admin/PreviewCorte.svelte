<script lang="ts">
	import type { LayoutPiece, UnplacedPiece } from '$lib/types/nesting';

	type Props = {
		sheet: { width: number; height: number };
		pieces: LayoutPiece[];
		efficiency: number;
		unplaced: UnplacedPiece[];
	};

	let { sheet, pieces, efficiency, unplaced }: Props = $props();

	let containerEl: HTMLDivElement | undefined = $state();
	let tooltip = $state<{
		px: number;
		py: number;
		title: string;
		lines: string[];
	} | null>(null);

	function areaM2(w: number, h: number) {
		return ((w * h) / 1_000_000).toFixed(4);
	}

	function showTip(ev: MouseEvent, p: LayoutPiece) {
		if (!containerEl) return;
		const cr = containerEl.getBoundingClientRect();
		const title = p.label || `${p.w}×${p.h} mm`;
		const lines = [
			`${p.w}×${p.h} mm`,
			`Área: ${areaM2(p.w, p.h)} m²`,
			p.kind === 'mandatory' ? 'Tipo: obligatoria' : 'Tipo: stock',
			p.variant_id ? `Variante: ${p.variant_id}` : '',
			`ID: ${p.rid}`
		].filter(Boolean);
		tooltip = {
			px: ev.clientX - cr.left + 8,
			py: ev.clientY - cr.top + 8,
			title,
			lines
		};
	}

	function moveTip(ev: MouseEvent) {
		if (!tooltip || !containerEl) return;
		const cr = containerEl.getBoundingClientRect();
		tooltip = { ...tooltip, px: ev.clientX - cr.left + 8, py: ev.clientY - cr.top + 8 };
	}

	function hideTip() {
		tooltip = null;
	}

	const fillMandatory = 'rgba(249,115,22,0.28)';
	const strokeMandatory = '#ea580c';
	const fillStock = 'rgba(59,130,246,0.18)';
	const strokeStock = '#1d4ed8';

	const minLabelSide = $derived(Math.max(sheet.width, sheet.height) * 0.04);
	const strokeW = $derived(Math.max(1, Math.max(sheet.width, sheet.height) * 0.0015));
	const fontSize = $derived(Math.max(10, Math.max(sheet.width, sheet.height) * 0.018));
	const unplacedMandatory = $derived(unplaced.filter((u) => u.kind === 'mandatory'));
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
		<div>
			<h3 class="text-lg font-semibold text-gray-900">Vista previa del acomodo</h3>
			<p class="text-sm text-gray-600">
				Lámina {sheet.width}×{sheet.height} mm — aprovechamiento
				<span class="font-mono font-semibold text-blue-700">{efficiency.toFixed(1)}%</span>
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-4 text-sm">
			<span class="flex items-center gap-2">
				<span class="inline-block h-3 w-5 rounded border-2" style:border-color={strokeMandatory} style:background={fillMandatory}></span>
				Obligatorias
			</span>
			<span class="flex items-center gap-2">
				<span class="inline-block h-3 w-5 rounded border-2" style:border-color={strokeStock} style:background={fillStock}></span>
				Stock / relleno
			</span>
		</div>
	</div>

	<div class="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
		<div
			class="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
			style:width="{Math.min(100, efficiency)}%"
		></div>
	</div>

	<div
		role="region"
		aria-label="Área de diagrama de nesting"
		class="relative w-full overflow-auto rounded border border-gray-300 bg-gray-50 p-2"
		bind:this={containerEl}
		onmouseleave={hideTip}
	>
		<svg
			role="img"
			aria-label="Diagrama de cortes en la lámina"
			class="mx-auto block max-h-[70vh] max-w-full"
			style="aspect-ratio: {sheet.width} / {sheet.height};"
			viewBox="0 0 {sheet.width} {sheet.height}"
			preserveAspectRatio="xMidYMid meet"
			onmousemove={moveTip}
		>
			<rect x="0" y="0" width={sheet.width} height={sheet.height} fill="#f3f4f6" stroke="#9ca3af" stroke-width="2" />

			{#each pieces as p (p.rid)}
				<g>
					<!-- svelte-ignore a11y_no_static_element_interactions (tooltip al pasar el mouse) -->
					<rect
						x={p.x}
						y={p.y}
						width={p.w}
						height={p.h}
						fill={p.kind === 'mandatory' ? fillMandatory : fillStock}
						stroke={p.kind === 'mandatory' ? strokeMandatory : strokeStock}
						stroke-width={strokeW}
						onmouseenter={(e) => showTip(e, p)}
					/>
					{#if p.w >= minLabelSide && p.h >= minLabelSide}
						<text
							x={p.x + p.w / 2}
							y={p.y + p.h / 2}
							text-anchor="middle"
							dominant-baseline="middle"
							fill={p.kind === 'mandatory' ? '#9a3412' : '#1e3a8a'}
							font-size={fontSize}
							font-weight="600"
							pointer-events="none"
						>
							{Math.round(p.w)}×{Math.round(p.h)}
						</text>
					{/if}
				</g>
			{/each}
		</svg>

		{#if tooltip}
			<div
				class="pointer-events-none absolute z-20 max-w-xs rounded border border-gray-300 bg-white/95 px-2 py-1.5 text-xs shadow-lg"
				style:left="{tooltip.px}px"
				style:top="{tooltip.py}px"
			>
				<div class="font-semibold text-gray-900">{tooltip.title}</div>
				{#each tooltip.lines as line}
					<div class="text-gray-700">{line}</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if unplacedMandatory.length > 0}
		<div class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
			<p class="font-semibold">Piezas obligatorias sin acomodar ({unplacedMandatory.length})</p>
			<ul class="mt-1 list-inside list-disc">
				{#each unplacedMandatory as u}
					<li>{u.label} — {u.width}×{u.height} mm ({u.kind})</li>
				{/each}
			</ul>
		</div>
	{/if}

	<p class="mt-3 text-xs text-gray-500">
		En <strong>LightBurn</strong>, al importar el DXF activa <strong>Delete Duplicates</strong> en optimización para evitar doble corte en líneas
		comunes.
	</p>
</div>
