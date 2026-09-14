import {
	customPrice,
	sizeLabel,
	sizePrice,
	validateCustomDimensions,
	type AcrylicPricingConfig
} from '$lib/acrylicPricing';

export const ACRYLIC_SPEC_KEY = 'tipo_producto';
export const ACRYLIC_SPEC_VALUE = 'acrilico';

export const ACRYLIC_COLOR_SWATCHES: Record<string, string> = {
	verde: '#22c55e',
	rosa: '#ec4899',
	naranja: '#f97316',
	azul: '#3b82f6',
	rojo: '#ef4444',
	amarillo: '#facc15',
	negro: '#111827',
	blanco: '#ffffff',
	gris: '#9ca3af',
	morado: '#a855f7',
	violeta: '#8b5cf6',
	transparente: 'transparent'
};

export type AcrylicColorOption = {
	name: string;
	hex: string;
	imageUrl: string;
};

export function normalizeValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

export function getVariantAttributes(variant: any): Record<string, any> {
	if (variant?.attributes && typeof variant.attributes === 'object') {
		return variant.attributes as Record<string, any>;
	}
	return {};
}

export function getVariantAttribute(variant: any, key: string): string {
	return normalizeValue(getVariantAttributes(variant)?.[key]);
}

export function isSheetVariant(variant: any): boolean {
	const attrs = getVariantAttributes(variant);
	if (attrs.is_sheet === true) return true;
	const tamano = normalizeValue(attrs.tamano);
	return !tamano;
}

export function getColorSwatch(colorName: string, colorHex: string): string {
	if (colorHex) return colorHex;
	return ACRYLIC_COLOR_SWATCHES[colorName.toLowerCase()] || '';
}

export function parseNumericValue(value: string): number | null {
	const match = value.match(/\d+(?:[\.,]\d+)?/);
	if (!match) return null;
	return Number(match[0].replace(',', '.'));
}

export function sortByNumeric(values: string[]): string[] {
	return [...values].sort((a, b) => {
		const na = parseNumericValue(a);
		const nb = parseNumericValue(b);
		if (na !== null && nb !== null) return na - nb;
		if (na !== null) return -1;
		if (nb !== null) return 1;
		return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
	});
}

export function isVariantAvailable(variant: any): boolean {
	if (variant?.is_active === false) return false;
	if (variant?.stock_quantity === 0) return false;
	return true;
}

/** En acrílico el stock de lámina es manual: se listan láminas activas aunque stock sea 0. */
export function isAcrylicSheetListable(variant: any): boolean {
	if (variant?.is_active === false) return false;
	return isSheetVariant(variant);
}

export function isAcrylicProduct(specifications: any[] | null | undefined): boolean {
	return (specifications || []).some(
		(spec: any) =>
			spec?.specification_key?.toLowerCase?.() === ACRYLIC_SPEC_KEY &&
			spec?.specification_value?.toLowerCase?.() === ACRYLIC_SPEC_VALUE
	);
}

export function getSheetVariants(variants: any[] | null | undefined): any[] {
	const list = variants || [];
	const sheets = list.filter(isAcrylicSheetListable);
	if (sheets.length > 0) return sheets;
	return list.filter((v: any) => v?.is_active !== false && getVariantAttribute(v, 'color'));
}

export function getAcrylicColorOptions(sheetVariants: any[]): AcrylicColorOption[] {
	const colors = new Map<string, AcrylicColorOption>();
	for (const variant of sheetVariants) {
		const colorName = getVariantAttribute(variant, 'color');
		if (!colorName) continue;
		const colorHex = getVariantAttribute(variant, 'color_hex');
		const imageUrl = getVariantAttribute(variant, 'image_url');
		if (!colors.has(colorName)) {
			colors.set(colorName, { name: colorName, hex: colorHex, imageUrl });
		} else if (!colors.get(colorName)!.imageUrl && imageUrl) {
			colors.get(colorName)!.imageUrl = imageUrl;
		}
	}
	return Array.from(colors.values());
}

export function getGrosorOptions(sheetVariants: any[], selectedColor: string): string[] {
	const variants = selectedColor
		? sheetVariants.filter((variant) => getVariantAttribute(variant, 'color') === selectedColor)
		: sheetVariants;
	const values = new Set<string>();
	for (const variant of variants) {
		const grosor = getVariantAttribute(variant, 'grosor');
		if (grosor) values.add(grosor);
	}
	return sortByNumeric([...values]);
}

export function findMatchingSheet(
	sheetVariants: any[],
	selectedColor: string,
	selectedGrosor: string
): any | null {
	return (
		sheetVariants.find((variant: any) => {
			const matchesColor = selectedColor ? getVariantAttribute(variant, 'color') === selectedColor : true;
			const matchesGrosor = selectedGrosor
				? getVariantAttribute(variant, 'grosor') === selectedGrosor
				: true;
			return matchesColor && matchesGrosor;
		}) || null
	);
}

export function acrylicUnitPrice(params: {
	sheetPrice: number;
	customMode: boolean;
	customWidth: number;
	customHeight: number;
	customDimError: string | null;
	cutSize: { width: number; height: number; factor: number } | null;
	config: AcrylicPricingConfig;
}): number {
	const sheetPrice = Number(params.sheetPrice) || 0;
	if (params.customMode) {
		if (params.customDimError) return 0;
		return customPrice(sheetPrice, Number(params.customWidth), Number(params.customHeight), params.config);
	}
	const size = params.cutSize;
	if (!size) return sheetPrice;
	return sizePrice(sheetPrice, size.width, size.height, size.factor, params.config);
}

export function acrylicCutLabel(params: {
	customMode: boolean;
	customWidth: number;
	customHeight: number;
	cutSize: { width: number; height: number } | null;
}): string {
	if (params.customMode) return `Especial ${sizeLabel(Number(params.customWidth), Number(params.customHeight))}`;
	const size = params.cutSize;
	if (!size) return '';
	return sizeLabel(size.width, size.height);
}

export function acrylicCustomDimError(
	customMode: boolean,
	customWidth: number,
	customHeight: number,
	config: AcrylicPricingConfig
): string | null {
	if (!customMode) return null;
	return validateCustomDimensions(Number(customWidth), Number(customHeight), config);
}
