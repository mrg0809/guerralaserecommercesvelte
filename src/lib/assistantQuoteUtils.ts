import type { QuoteDraft } from '$lib/types/assistant';

function parsePrice(value: unknown): number {
	if (value === null || value === undefined || value === '') return 0;
	const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
	return Number.isFinite(n) ? n : 0;
}

export function calculateQuoteTotals(draft: QuoteDraft) {
	const subtotal = draft.lines.reduce(
		(sum, l) =>
			sum +
			parsePrice(l.quantity) *
				parsePrice(l.unit_price) *
				(1 - parsePrice(l.discount_percent) / 100),
		0
	);
	const shipping = parsePrice(draft.shipping_amount);
	const installation = parsePrice(draft.installation_amount);
	return { subtotal, shipping, installation, total: subtotal + shipping + installation };
}

export function emptyQuoteDraft(): QuoteDraft {
	return { lines: [], validity_days: 7 };
}
