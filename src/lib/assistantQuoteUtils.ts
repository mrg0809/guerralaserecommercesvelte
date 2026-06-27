import type { QuoteDraft } from '$lib/types/assistant';

export function calculateQuoteTotals(draft: QuoteDraft) {
	const subtotal = draft.lines.reduce(
		(sum, l) => sum + l.quantity * l.unit_price * (1 - (l.discount_percent ?? 0) / 100),
		0
	);
	const shipping = draft.shipping_amount ?? 0;
	const installation = draft.installation_amount ?? 0;
	return { subtotal, shipping, installation, total: subtotal + shipping + installation };
}

export function emptyQuoteDraft(): QuoteDraft {
	return { lines: [], validity_days: 7 };
}
