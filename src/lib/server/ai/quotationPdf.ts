import type { QuoteDraft } from '$lib/types/assistant';
import { buildQuotationPdf, type QuotationPdfOptions } from '$lib/server/quotationPdfBuilder';
import { normalizeQuoteDraft, parsePrice } from '$lib/server/ai/quoteUtils';

export async function createQuotationPdf(draft: QuoteDraft) {
	const quote = normalizeQuoteDraft(draft);
	return buildQuotationPdf(quoteDraftToPdfOptions(quote));
}

export function quoteDraftToPdfOptions(draft: QuoteDraft): QuotationPdfOptions {
	const quote = normalizeQuoteDraft(draft);
	return {
		customerName: quote.client_name,
		validityDays: quote.validity_days ?? 7,
		notes: quote.notes,
		shippingCost: parsePrice(quote.shipping_amount),
		installationCost: parsePrice(quote.installation_amount),
		fullCustomerBlock: false,
		pricesExcludeIva: quote.prices_exclude_iva ?? false,
		items: quote.lines.map((line) => ({
			sku: line.sku,
			description: line.description,
			quantity: parsePrice(line.quantity),
			price: parsePrice(line.unit_price),
			discount: parsePrice(line.discount_percent),
			imageUrl: line.image_url,
			includeDetail: line.include_detail,
			detailDescription: line.detail_description
		}))
	};
}

export async function quotationPdfBase64(draft: QuoteDraft): Promise<{ base64: string; filename: string }> {
	const quote = normalizeQuoteDraft(draft);
	const doc = await createQuotationPdf(quote);
	const clientSlug = (quote.client_name || 'cliente').replace(/\s+/g, '-').slice(0, 30);
	const filename = `cotizacion-${clientSlug}-${Date.now()}.pdf`;
	return { base64: doc.output('datauristring'), filename };
}
