import type { PageServerLoad } from './$types';
import { supabaseServer } from '$lib/supabaseServer';

type Attrs = Record<string, unknown>;

function getAttributes(attrs: unknown): Attrs {
	if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return {};
	return attrs as Attrs;
}

/** Extrae ancho/alto en mm desde attributes.tamano (ej. "60x90 cm", "1220x2440 mm"). */
function parseTamanoToMm(tamanoRaw: unknown): { widthMm: number; heightMm: number } | null {
	if (tamanoRaw == null) return null;
	const raw = String(tamanoRaw).trim();
	if (!raw) return null;
	const m = raw.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
	if (!m) return null;
	let w = parseFloat(m[1]);
	let h = parseFloat(m[2]);
	const lower = raw.toLowerCase();
	if (lower.includes('mm')) {
		// ya en mm
	} else if (lower.includes('cm')) {
		w *= 10;
		h *= 10;
	} else if (w <= 500 && h <= 500) {
		// típico lámina en cm (60, 90, 120, 240…)
		w *= 10;
		h *= 10;
	}
	// si no hay unidad y son valores grandes (p. ej. 1220), se interpretan como mm
	if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
	return { widthMm: w, heightMm: h };
}

export type StockOptionRow = {
	id: string;
	label: string;
	widthMm: number;
	heightMm: number;
	stock: number;
};

const ALLOWED_SIZES_CM = [
	{ w: 122, h: 122 },
	{ w: 120, h: 90 },
	{ w: 120, h: 60 },
	{ w: 90, h: 60 },
	{ w: 60, h: 40 },
	{ w: 40, h: 40 },
	{ w: 20, h: 30 }
];

function sizeKeyMm(widthMm: number, heightMm: number): string {
	const a = Math.round(widthMm);
	const b = Math.round(heightMm);
	return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

const ALLOWED_BY_KEY = new Map(
	ALLOWED_SIZES_CM.map((s) => {
		const w = s.w * 10;
		const h = s.h * 10;
		return [sizeKeyMm(w, h), { widthMm: w, heightMm: h, label: `${s.w}x${s.h}` }] as const;
	})
);

export const load: PageServerLoad = async () => {
	const { data: specs, error: specErr } = await supabaseServer
		.from('product_specifications')
		.select('product_id')
		.eq('specification_key', 'tipo_producto')
		.eq('specification_value', 'acrilico');

	if (specErr) {
		console.error('[nesting load] specs', specErr);
		return { stockOptions: [] as StockOptionRow[], loadError: specErr.message };
	}

	const productIds = [...new Set((specs ?? []).map((s) => s.product_id))];
	if (productIds.length === 0) {
		return { stockOptions: [] as StockOptionRow[] };
	}

	const { data: variants, error: varErr } = await supabaseServer
		.from('product_variants')
		.select('id, name, stock_quantity, attributes, product_id, products(name)')
		.in('product_id', productIds)
		.eq('is_active', true);

	if (varErr) {
		console.error('[nesting load] variants', varErr);
		return { stockOptions: [] as StockOptionRow[], loadError: varErr.message };
	}

	const stockBySize = new Map<string, StockOptionRow>();

	for (const row of variants ?? []) {
		const attrs = getAttributes(row.attributes);
		const dims = parseTamanoToMm(attrs.tamano);
		if (!dims) continue;
		const key = sizeKeyMm(dims.widthMm, dims.heightMm);
		const allowed = ALLOWED_BY_KEY.get(key);
		if (!allowed) continue;

		const current = stockBySize.get(key);
		if (!current) {
			stockBySize.set(key, {
				id: `size-${allowed.label.replace('x', 'x')}`,
				label: allowed.label,
				widthMm: allowed.widthMm,
				heightMm: allowed.heightMm,
				stock: Math.max(0, row.stock_quantity ?? 0)
			});
		} else {
			current.stock += Math.max(0, row.stock_quantity ?? 0);
		}
	}

	const stockOptions: StockOptionRow[] = ALLOWED_SIZES_CM.map((s) => {
		const widthMm = s.w * 10;
		const heightMm = s.h * 10;
		const key = sizeKeyMm(widthMm, heightMm);
		const existing = stockBySize.get(key);
		return {
			id: existing?.id ?? `size-${s.w}x${s.h}`,
			label: `${s.w}x${s.h}`,
			widthMm,
			heightMm,
			stock: existing?.stock ?? 0
		};
	});

	return { stockOptions };
};
