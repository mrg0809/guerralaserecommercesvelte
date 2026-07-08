import type { QuoteDraft } from '$lib/types/assistant';
import type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';
import { normalizeExtraCostMode } from '$lib/types/quotationExtraCost';
import type { QuotationInput, QuotationSource, SavedQuotation } from '$lib/types/savedQuotation';

export type AdminQuotationItem = {
	productId: string;
	sku: string;
	description: string;
	quantity: number;
	price: number;
	discount: number;
	isVariant?: boolean;
	variantId?: string | null;
	imageUrl?: string;
	catalogDetail?: string;
	detailDescription?: string;
	includeDetail?: boolean;
};

export function quoteDraftToQuotationInput(
	draft: QuoteDraft,
	source: QuotationSource = 'ai_assistant',
	existingId?: string
): QuotationInput {
	const includeAll = draft.lines.some((l) => l.include_detail);

	return {
		id: existingId,
		source,
		customer_id: draft.client_id ?? null,
		customer_name: draft.client_name?.trim() || 'Cliente',
		items: draft.lines.map((line) => ({
			product_id: line.product_id ?? null,
			variant_id: line.variant_id ?? null,
			sku: line.sku,
			description: line.description,
			quantity: line.quantity,
			unit_price: line.unit_price,
			line_discount_percentage: line.discount_percent ?? 0,
			detail_description: line.detail_description,
			image_url: line.image_url,
			include_detail: line.include_detail,
			catalog_detail: line.catalog_detail
		})),
		shipping_cost: draft.shipping_amount ?? 0,
		installation_cost: draft.installation_amount ?? 0,
		shipping_mode: draft.shipping_mode ?? normalizeExtraCostMode(undefined, draft.shipping_amount ?? 0),
		installation_mode:
			draft.installation_mode ?? normalizeExtraCostMode(undefined, draft.installation_amount ?? 0),
		prices_exclude_iva: draft.prices_exclude_iva ?? false,
		include_all_details: includeAll,
		validity_days: draft.validity_days ?? 7,
		notes: draft.notes ?? null
	};
}

export function adminFormToQuotationInput(form: {
	id?: string | null;
	source?: QuotationSource;
	selectedCustomerId: string | null;
	customerName: string;
	customerCompany: string;
	customerRfc: string;
	customerEmail: string;
	customerPhone: string;
	customerAddress: string;
	generalDiscount: number;
	shippingCost: number;
	installationCost: number;
	shippingMode: QuotationExtraCostMode;
	installationMode: QuotationExtraCostMode;
	pricesExcludeIva: boolean;
	includeAllDetails: boolean;
	quotationValidityDays: number;
	paymentTerms: string;
	notes: string;
	items: AdminQuotationItem[];
}): QuotationInput {
	return {
		id: form.id ?? undefined,
		source: form.source ?? 'manual',
		customer_id: form.selectedCustomerId,
		customer_name: form.customerName,
		customer_company: form.customerCompany || null,
		customer_rfc: form.customerRfc || null,
		customer_email: form.customerEmail || null,
		customer_phone: form.customerPhone || null,
		customer_address: form.customerAddress || null,
		general_discount_percentage: form.generalDiscount,
		shipping_cost: form.shippingCost,
		installation_cost: form.installationCost,
		shipping_mode: form.shippingMode,
		installation_mode: form.installationMode,
		prices_exclude_iva: form.pricesExcludeIva,
		include_all_details: form.includeAllDetails,
		validity_days: form.quotationValidityDays,
		payment_terms: form.paymentTerms,
		notes: form.notes || null,
		items: form.items.map((item) => ({
			product_id: item.isVariant ? null : item.productId,
			variant_id: item.isVariant ? item.variantId : null,
			sku: item.sku,
			description: item.description,
			quantity: item.quantity,
			unit_price: item.price,
			line_discount_percentage: item.discount,
			detail_description: item.detailDescription,
			image_url: item.imageUrl,
			include_detail: item.includeDetail,
			catalog_detail: item.catalogDetail
		}))
	};
}

export function savedQuotationToAdminForm(quotation: SavedQuotation) {
	return {
		id: quotation.id,
		quotationNumber: quotation.quotation_number,
		source: quotation.source,
		selectedCustomerId: quotation.customer_id ?? null,
		customerName: quotation.customer_name,
		customerCompany: quotation.customer_company ?? '',
		customerRfc: quotation.customer_rfc ?? '',
		customerEmail: quotation.customer_email ?? '',
		customerPhone: quotation.customer_phone ?? '',
		customerAddress: quotation.customer_address ?? '',
		generalDiscount: quotation.general_discount_percentage ?? 0,
		shippingCost: quotation.shipping_cost ?? 0,
		installationCost: quotation.installation_cost ?? 0,
		shippingMode: normalizeExtraCostMode(
			quotation.shipping_mode,
			quotation.shipping_cost ?? 0
		),
		installationMode: normalizeExtraCostMode(
			quotation.installation_mode,
			quotation.installation_cost ?? 0
		),
		pricesExcludeIva: quotation.prices_exclude_iva ?? false,
		includeAllDetails: quotation.include_all_details ?? false,
		quotationValidityDays: quotation.validity_days ?? 15,
		paymentTerms: quotation.payment_terms ?? 'Contado',
		notes: quotation.notes ?? '',
		items: quotation.items.map((item) => ({
			productId: item.variant_id ? '' : (item.product_id ?? ''),
			sku: item.sku ?? '',
			description: item.description,
			quantity: item.quantity,
			price: item.unit_price,
			discount: item.line_discount_percentage ?? 0,
			isVariant: Boolean(item.variant_id),
			variantId: item.variant_id,
			imageUrl: item.image_url,
			catalogDetail: item.catalog_detail,
			detailDescription: item.detail_description,
			includeDetail: item.include_detail
		}))
	};
}

export function quotationToQuoteDraft(quotation: SavedQuotation): QuoteDraft {
	return {
		client_name: quotation.customer_name,
		client_id: quotation.customer_id ?? undefined,
		shipping_amount: quotation.shipping_cost,
		installation_amount: quotation.installation_cost,
		shipping_mode: normalizeExtraCostMode(
			quotation.shipping_mode,
			quotation.shipping_cost ?? 0
		),
		installation_mode: normalizeExtraCostMode(
			quotation.installation_mode,
			quotation.installation_cost ?? 0
		),
		notes: quotation.notes ?? undefined,
		validity_days: quotation.validity_days,
		prices_exclude_iva: quotation.prices_exclude_iva,
		lines: quotation.items.map((item) => ({
			id: item.id ?? crypto.randomUUID(),
			source: item.product_id || item.variant_id ? 'catalog' : 'manual',
			product_id: item.product_id ?? undefined,
			variant_id: item.variant_id ?? undefined,
			description: item.description,
			quantity: item.quantity,
			unit_price: item.unit_price,
			discount_percent: item.line_discount_percentage,
			sku: item.sku,
			image_url: item.image_url,
			catalog_detail: item.catalog_detail,
			detail_description: item.detail_description,
			include_detail: item.include_detail
		}))
	};
}
