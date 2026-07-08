import type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';

export type QuotationSource = 'manual' | 'ai_assistant' | 'ai_chat';

export interface QuotationItemInput {
	id?: string;
	product_id?: string | null;
	variant_id?: string | null;
	sku?: string;
	description: string;
	quantity: number;
	unit_price: number;
	line_discount_percentage?: number;
	detail_description?: string;
	image_url?: string;
	include_detail?: boolean;
	catalog_detail?: string;
}

export interface QuotationInput {
	id?: string;
	source?: QuotationSource;
	customer_id?: string | null;
	customer_name: string;
	customer_company?: string | null;
	customer_rfc?: string | null;
	customer_email?: string | null;
	customer_phone?: string | null;
	customer_address?: string | null;
	general_discount_percentage?: number;
	shipping_cost?: number;
	installation_cost?: number;
	shipping_mode?: QuotationExtraCostMode;
	installation_mode?: QuotationExtraCostMode;
	prices_exclude_iva?: boolean;
	include_all_details?: boolean;
	validity_days?: number;
	payment_terms?: string;
	notes?: string | null;
	status?: string;
	items: QuotationItemInput[];
}

export interface QuotationListRow {
	id: string;
	quotation_number: string;
	source: QuotationSource | string;
	customer_name: string;
	customer_company: string | null;
	total_amount: number;
	status: string;
	created_at: string;
	updated_at: string;
	item_count?: number;
}

export interface SavedQuotation extends QuotationInput {
	id: string;
	quotation_number: string;
	subtotal: number;
	discount_amount: number;
	total_amount: number;
	created_at: string;
	updated_at: string;
}

export const QUOTATION_SOURCE_LABELS: Record<QuotationSource, string> = {
	manual: 'Manual',
	ai_assistant: 'Asistente IA',
	ai_chat: 'Chat IA'
};
