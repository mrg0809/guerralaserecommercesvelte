export type QuotationExtraCostMode = 'cost' | 'included' | 'na';

export const QUOTATION_EXTRA_COST_MODE_LABELS: Record<QuotationExtraCostMode, string> = {
	na: 'N/A (no aplica)',
	included: 'Incluido',
	cost: 'Costo adicional'
};

export function normalizeExtraCostMode(
	mode: QuotationExtraCostMode | string | null | undefined,
	amount: number
): QuotationExtraCostMode {
	if (mode === 'cost' || mode === 'included' || mode === 'na') return mode;
	return amount > 0 ? 'cost' : 'na';
}

export function extraCostBillableAmount(
	mode: QuotationExtraCostMode | string | null | undefined,
	amount: number
): number {
	return normalizeExtraCostMode(mode, amount) === 'cost' ? amount : 0;
}

export function formatQuotationExtraCost(
	amount: number,
	mode: QuotationExtraCostMode | string | null | undefined = 'na'
): string {
	const normalized = normalizeExtraCostMode(mode, amount);
	if (normalized === 'included') return 'Incluido';
	if (normalized === 'cost') return `$${amount.toFixed(2)}`;
	return 'N/A';
}
