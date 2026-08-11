export const ACRYLIC_PRICING_SETTINGS_KEY = 'acrylic_pricing_config';

export type AcrylicSizeConfig = {
	id: string;
	width: number;
	height: number;
	factor: number;
	enabled: boolean;
};

export type AcrylicCustomFactorRule = {
	min_area_cm2: number;
	factor: number;
};

export type AcrylicPricingConfig = {
	sheet_width_cm: number;
	sheet_height_cm: number;
	sizes: AcrylicSizeConfig[];
	custom: {
		enabled: boolean;
		factor_rules: AcrylicCustomFactorRule[];
		min_width_cm: number;
		max_width_cm: number;
		min_height_cm: number;
		max_height_cm: number;
	};
};

export const DEFAULT_ACRYLIC_PRICING: AcrylicPricingConfig = {
	sheet_width_cm: 122,
	sheet_height_cm: 244,
	sizes: [
		{ id: '122x122', width: 122, height: 122, factor: 1.15, enabled: true },
		{ id: '120x90', width: 120, height: 90, factor: 1.3, enabled: true },
		{ id: '120x60', width: 120, height: 60, factor: 1.3, enabled: true },
		{ id: '90x60', width: 90, height: 60, factor: 1.3, enabled: true },
		{ id: '60x40', width: 60, height: 40, factor: 1.5, enabled: true },
		{ id: '40x40', width: 40, height: 40, factor: 1.5, enabled: true },
		{ id: '20x30', width: 20, height: 30, factor: 2, enabled: true }
	],
	custom: {
		enabled: true,
		factor_rules: [
			{ min_area_cm2: 14000, factor: 1.25 },
			{ min_area_cm2: 4000, factor: 1.5 },
			{ min_area_cm2: 0, factor: 2 }
		],
		min_width_cm: 1,
		max_width_cm: 122,
		min_height_cm: 1,
		max_height_cm: 244
	}
};

export function sheetAreaCm2(config: AcrylicPricingConfig = DEFAULT_ACRYLIC_PRICING): number {
	return config.sheet_width_cm * config.sheet_height_cm;
}

export function cutAreaCm2(width: number, height: number): number {
	return Math.max(0, width) * Math.max(0, height);
}

export function sizePrice(
	sheetPrice: number,
	width: number,
	height: number,
	factor: number,
	config: AcrylicPricingConfig = DEFAULT_ACRYLIC_PRICING
): number {
	const area = sheetAreaCm2(config);
	if (area <= 0 || sheetPrice < 0) return 0;
	const ratio = cutAreaCm2(width, height) / area;
	return Math.round(sheetPrice * ratio * factor);
}

/** Reglas ordenadas de mayor a menor umbral; primera que cumpla area >= min. */
export function customFactor(
	areaCm2: number,
	rules: AcrylicCustomFactorRule[] = DEFAULT_ACRYLIC_PRICING.custom.factor_rules
): number {
	const sorted = [...rules].sort((a, b) => b.min_area_cm2 - a.min_area_cm2);
	for (const rule of sorted) {
		if (areaCm2 >= rule.min_area_cm2) return rule.factor;
	}
	return sorted[sorted.length - 1]?.factor ?? 2;
}

export function customPrice(
	sheetPrice: number,
	width: number,
	height: number,
	config: AcrylicPricingConfig = DEFAULT_ACRYLIC_PRICING
): number {
	const area = cutAreaCm2(width, height);
	const sheet = sheetAreaCm2(config);
	if (sheet <= 0 || sheetPrice < 0) return 0;
	const factor = customFactor(area, config.custom.factor_rules);
	return Math.round(area * (sheetPrice / sheet) * factor);
}

export function sizeLabel(width: number, height: number): string {
	return `${width}x${height} cm`;
}

export function validateCustomDimensions(
	width: number,
	height: number,
	config: AcrylicPricingConfig = DEFAULT_ACRYLIC_PRICING
): string | null {
	const { min_width_cm, max_width_cm, min_height_cm, max_height_cm } = config.custom;
	if (!Number.isFinite(width) || !Number.isFinite(height)) return 'Medidas inválidas';
	if (width < min_width_cm || width > max_width_cm) {
		return `Ancho debe estar entre ${min_width_cm} y ${max_width_cm} cm`;
	}
	if (height < min_height_cm || height > max_height_cm) {
		return `Alto debe estar entre ${min_height_cm} y ${max_height_cm} cm`;
	}
	return null;
}

export function parseAcrylicPricing(raw: unknown): AcrylicPricingConfig {
	const base = structuredClone(DEFAULT_ACRYLIC_PRICING);
	if (!raw) return base;

	let parsed: any = raw;
	if (typeof raw === 'string') {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return base;
		}
	}
	if (!parsed || typeof parsed !== 'object') return base;

	const sheet_width_cm = Number(parsed.sheet_width_cm) || base.sheet_width_cm;
	const sheet_height_cm = Number(parsed.sheet_height_cm) || base.sheet_height_cm;

	const sizes: AcrylicSizeConfig[] = Array.isArray(parsed.sizes)
		? parsed.sizes
				.map((s: any) => ({
					id: String(s?.id || `${s?.width}x${s?.height}`),
					width: Number(s?.width) || 0,
					height: Number(s?.height) || 0,
					factor: Number(s?.factor) || 1,
					enabled: s?.enabled !== false
				}))
				.filter((s: AcrylicSizeConfig) => s.width > 0 && s.height > 0)
		: base.sizes;

	const rulesRaw = parsed.custom?.factor_rules;
	const factor_rules: AcrylicCustomFactorRule[] = Array.isArray(rulesRaw)
		? rulesRaw
				.map((r: any) => ({
					min_area_cm2: Number(r?.min_area_cm2) || 0,
					factor: Number(r?.factor) || 1
				}))
				.sort((a: AcrylicCustomFactorRule, b: AcrylicCustomFactorRule) => b.min_area_cm2 - a.min_area_cm2)
		: base.custom.factor_rules;

	return {
		sheet_width_cm,
		sheet_height_cm,
		sizes: sizes.length ? sizes : base.sizes,
		custom: {
			enabled: parsed.custom?.enabled !== false,
			factor_rules: factor_rules.length ? factor_rules : base.custom.factor_rules,
			min_width_cm: Number(parsed.custom?.min_width_cm) || base.custom.min_width_cm,
			max_width_cm: Number(parsed.custom?.max_width_cm) || base.custom.max_width_cm,
			min_height_cm: Number(parsed.custom?.min_height_cm) || base.custom.min_height_cm,
			max_height_cm: Number(parsed.custom?.max_height_cm) || base.custom.max_height_cm
		}
	};
}

export function serializeAcrylicPricing(config: AcrylicPricingConfig): string {
	return JSON.stringify(config);
}

export function validateAcrylicPricing(config: AcrylicPricingConfig): string | null {
	if (config.sheet_width_cm <= 0 || config.sheet_height_cm <= 0) {
		return 'Dimensiones de lámina inválidas';
	}
	if (!config.sizes.length) return 'Agrega al menos un tamaño de venta';
	for (const s of config.sizes) {
		if (s.width <= 0 || s.height <= 0) return `Tamaño inválido: ${s.id}`;
		if (s.factor <= 0) return `Factor inválido en ${s.id}`;
	}
	if (config.custom.enabled) {
		if (!config.custom.factor_rules.length) return 'Agrega al menos una regla de factor personalizado';
		for (const r of config.custom.factor_rules) {
			if (r.factor <= 0) return 'Factor personalizado inválido';
			if (r.min_area_cm2 < 0) return 'Umbral de área inválido';
		}
	}
	return null;
}

export function isFullSheetSize(width: number, height: number, config = DEFAULT_ACRYLIC_PRICING): boolean {
	const a = Math.min(width, height);
	const b = Math.max(width, height);
	const sa = Math.min(config.sheet_width_cm, config.sheet_height_cm);
	const sb = Math.max(config.sheet_width_cm, config.sheet_height_cm);
	// También aceptar 120x240 como hoja legacy
	if (a === sa && b === sb) return true;
	if (a === 120 && b === 240) return true;
	return false;
}

export function parseSizeFromLabel(tamano: string): { width: number; height: number } | null {
	const m = String(tamano || '')
		.replace(/cm/gi, '')
		.trim()
		.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
	if (!m) return null;
	const width = Number(m[1].replace(',', '.'));
	const height = Number(m[2].replace(',', '.'));
	if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
	return { width, height };
}

export function normalizeGrosor(value: string): string {
	const v = String(value || '').trim().toLowerCase();
	if (!v) return '';
	const m = v.match(/(\d+(?:[.,]\d+)?)\s*m{0,2}/i);
	if (m) {
		const n = m[1].replace(',', '.');
		return `${n}mm`;
	}
	return v;
}
