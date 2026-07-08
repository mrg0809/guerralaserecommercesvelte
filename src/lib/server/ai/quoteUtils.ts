import type { QuoteDraft, QuoteLine } from '$lib/types/assistant';
import { normalizeExtraCostMode } from '$lib/types/quotationExtraCost';

export function parsePrice(value: unknown): number {
	if (value === null || value === undefined || value === '') return 0;
	const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
	return Number.isFinite(n) ? n : 0;
}

export function resolveUnitPrice(explicit: number | undefined, dbPrice: unknown): number {
	if (explicit !== undefined && explicit !== null) return parsePrice(explicit);
	return parsePrice(dbPrice);
}

export function normalizeQuoteLine(line: QuoteLine): QuoteLine {
	return {
		...line,
		quantity: Math.max(1, parsePrice(line.quantity)),
		unit_price: parsePrice(line.unit_price),
		discount_percent: parsePrice(line.discount_percent)
	};
}

export function normalizeQuoteDraft(draft: QuoteDraft): QuoteDraft {
	return {
		...draft,
		shipping_amount:
			draft.shipping_amount !== undefined && draft.shipping_amount !== null
				? parsePrice(draft.shipping_amount)
				: undefined,
		installation_amount:
			draft.installation_amount !== undefined && draft.installation_amount !== null
				? parsePrice(draft.installation_amount)
				: undefined,
		validity_days: draft.validity_days ?? 7,
		prices_exclude_iva: draft.prices_exclude_iva ?? false,
		shipping_mode: normalizeExtraCostMode(draft.shipping_mode, parsePrice(draft.shipping_amount)),
		installation_mode: normalizeExtraCostMode(
			draft.installation_mode,
			parsePrice(draft.installation_amount)
		),
		lines: (draft.lines ?? []).map(normalizeQuoteLine)
	};
}
