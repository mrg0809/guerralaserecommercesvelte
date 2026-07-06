import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuotationInput, QuotationItemInput, SavedQuotation } from '$lib/types/savedQuotation';

function lineTotal(item: QuotationItemInput): number {
	const subtotal = item.quantity * item.unit_price;
	const discount = item.line_discount_percentage ?? 0;
	return subtotal - (subtotal * discount) / 100;
}

export function calculateQuotationTotals(input: QuotationInput) {
	const itemsSubtotal = input.items.reduce((sum, item) => sum + lineTotal(item), 0);
	const generalDiscountPct = input.general_discount_percentage ?? 0;
	const discountAmount = generalDiscountPct ? (itemsSubtotal * generalDiscountPct) / 100 : 0;
	const shipping = input.shipping_cost ?? 0;
	const installation = input.installation_cost ?? 0;
	const total = itemsSubtotal - discountAmount + shipping + installation;

	return {
		subtotal: itemsSubtotal,
		discount_amount: discountAmount,
		total_amount: total
	};
}

export async function generateQuotationNumber(supabase: SupabaseClient): Promise<string> {
	const { data: quotationNumber, error } = await supabase.rpc('generate_quotation_number');

	if (!error && quotationNumber) {
		return String(quotationNumber);
	}

	const year = new Date().getFullYear();
	const { data: lastQuotation } = await supabase
		.from('quotations')
		.select('quotation_number')
		.like('quotation_number', `COT-${year}-%`)
		.order('quotation_number', { ascending: false })
		.limit(1)
		.maybeSingle();

	let nextNumber = 1;
	if (lastQuotation?.quotation_number) {
		const parts = lastQuotation.quotation_number.split('-');
		const lastNumberStr = parts[parts.length - 1];
		const parsed = parseInt(lastNumberStr, 10);
		if (Number.isFinite(parsed)) nextNumber = parsed + 1;
	}

	return `COT-${year}-${String(nextNumber).padStart(4, '0')}`;
}

function buildQuotationRow(input: QuotationInput, quotationNumber: string) {
	const totals = calculateQuotationTotals(input);
	return {
		quotation_number: quotationNumber,
		source: input.source ?? 'manual',
		customer_id: input.customer_id ?? null,
		customer_name: input.customer_name,
		customer_company: input.customer_company ?? null,
		customer_rfc: input.customer_rfc ?? null,
		customer_email: input.customer_email ?? null,
		customer_phone: input.customer_phone ?? null,
		customer_address: input.customer_address ?? null,
		subtotal: totals.subtotal,
		general_discount_percentage: input.general_discount_percentage ?? 0,
		discount_amount: totals.discount_amount,
		shipping_cost: input.shipping_cost ?? 0,
		installation_cost: input.installation_cost ?? 0,
		total_amount: totals.total_amount,
		prices_exclude_iva: input.prices_exclude_iva ?? false,
		include_all_details: input.include_all_details ?? false,
		validity_days: input.validity_days ?? 15,
		payment_terms: input.payment_terms ?? 'Contado',
		notes: input.notes ?? null,
		status: input.status ?? 'draft'
	};
}

function buildItemRows(quotationId: string, items: QuotationItemInput[]) {
	return items.map((item) => ({
		quotation_id: quotationId,
		product_id: item.variant_id ? null : item.product_id ?? null,
		variant_id: item.variant_id ?? null,
		sku: item.sku ?? null,
		description: item.description,
		quantity: item.quantity,
		unit_price: item.unit_price,
		line_discount_percentage: item.line_discount_percentage ?? 0,
		total_price: lineTotal(item),
		detail_description: item.detail_description ?? null,
		image_url: item.image_url ?? null,
		include_detail: item.include_detail ?? false,
		catalog_detail: item.catalog_detail ?? null
	}));
}

export async function saveQuotation(
	supabase: SupabaseClient,
	input: QuotationInput
): Promise<SavedQuotation> {
	if (!input.items.length) {
		throw new Error('La cotización debe tener al menos un artículo');
	}
	if (!input.customer_name?.trim()) {
		throw new Error('El nombre del cliente es obligatorio');
	}

	const isUpdate = Boolean(input.id);

	if (isUpdate) {
		const { data: existing, error: fetchError } = await supabase
			.from('quotations')
			.select('id, quotation_number')
			.eq('id', input.id!)
			.single();

		if (fetchError || !existing) {
			throw new Error('Cotización no encontrada');
		}

		const row = buildQuotationRow(input, existing.quotation_number);
		const { error: updateError } = await supabase
			.from('quotations')
			.update(row)
			.eq('id', input.id!);

		if (updateError) throw new Error(updateError.message);

		const { error: deleteError } = await supabase
			.from('quotation_items')
			.delete()
			.eq('quotation_id', input.id!);

		if (deleteError) throw new Error(deleteError.message);

		const { error: itemsError } = await supabase
			.from('quotation_items')
			.insert(buildItemRows(input.id!, input.items));

		if (itemsError) throw new Error(itemsError.message);

		return (await getQuotationById(supabase, input.id!))!;
	}

	const quotationNumber = await generateQuotationNumber(supabase);
	const row = buildQuotationRow(input, quotationNumber);

	const { data: quotation, error: insertError } = await supabase
		.from('quotations')
		.insert(row)
		.select()
		.single();

	if (insertError || !quotation) {
		throw new Error(insertError?.message ?? 'Error al guardar cotización');
	}

	const { error: itemsError } = await supabase
		.from('quotation_items')
		.insert(buildItemRows(quotation.id, input.items));

	if (itemsError) {
		await supabase.from('quotations').delete().eq('id', quotation.id);
		throw new Error(itemsError.message);
	}

	return (await getQuotationById(supabase, quotation.id))!;
}

export async function getQuotationById(
	supabase: SupabaseClient,
	id: string
): Promise<SavedQuotation | null> {
	const { data: quotation, error } = await supabase
		.from('quotations')
		.select('*, quotation_items(*)')
		.eq('id', id)
		.single();

	if (error || !quotation) return null;

	const items = (quotation.quotation_items ?? []).map((item: Record<string, unknown>) => ({
		id: item.id as string,
		product_id: item.product_id as string | null,
		variant_id: item.variant_id as string | null,
		sku: (item.sku as string) ?? undefined,
		description: item.description as string,
		quantity: Number(item.quantity),
		unit_price: Number(item.unit_price),
		line_discount_percentage: Number(item.line_discount_percentage ?? 0),
		detail_description: (item.detail_description as string) ?? undefined,
		image_url: (item.image_url as string) ?? undefined,
		include_detail: Boolean(item.include_detail),
		catalog_detail: (item.catalog_detail as string) ?? undefined
	}));

	const { quotation_items: _items, ...header } = quotation;

	return {
		id: header.id,
		quotation_number: header.quotation_number,
		source: (header.source ?? 'manual') as QuotationSource,
		customer_id: header.customer_id,
		customer_name: header.customer_name,
		customer_company: header.customer_company,
		customer_rfc: header.customer_rfc,
		customer_email: header.customer_email,
		customer_phone: header.customer_phone,
		customer_address: header.customer_address,
		general_discount_percentage: Number(header.general_discount_percentage ?? 0),
		shipping_cost: Number(header.shipping_cost ?? 0),
		installation_cost: Number(header.installation_cost ?? 0),
		prices_exclude_iva: Boolean(header.prices_exclude_iva),
		include_all_details: Boolean(header.include_all_details),
		validity_days: Number(header.validity_days ?? 15),
		payment_terms: header.payment_terms ?? 'Contado',
		notes: header.notes,
		status: header.status ?? 'draft',
		subtotal: Number(header.subtotal),
		discount_amount: Number(header.discount_amount ?? 0),
		total_amount: Number(header.total_amount ?? header.subtotal),
		created_at: header.created_at,
		updated_at: header.updated_at,
		items
	};
}

export async function listQuotations(
	supabase: SupabaseClient,
	opts: { source?: string; search?: string; limit?: number } = {}
) {
	const limit = opts.limit ?? 100;
	let query = supabase
		.from('quotations')
		.select('id, quotation_number, source, customer_name, customer_company, total_amount, status, created_at, updated_at, quotation_items(count)')
		.order('created_at', { ascending: false })
		.limit(limit);

	if (opts.source && opts.source !== 'all') {
		query = query.eq('source', opts.source);
	}

	if (opts.search?.trim()) {
		const term = opts.search.trim();
		query = query.or(
			`customer_name.ilike.%${term}%,customer_company.ilike.%${term}%,quotation_number.ilike.%${term}%`
		);
	}

	const { data, error } = await query;
	if (error) throw new Error(error.message);

	return (data ?? []).map((row: Record<string, unknown>) => ({
		id: row.id as string,
		quotation_number: row.quotation_number as string,
		source: (row.source ?? 'manual') as string,
		customer_name: row.customer_name as string,
		customer_company: row.customer_company as string | null,
		total_amount: Number(row.total_amount ?? 0),
		status: row.status as string,
		created_at: row.created_at as string,
		updated_at: row.updated_at as string,
		item_count: Array.isArray(row.quotation_items)
			? (row.quotation_items[0] as { count?: number })?.count ?? 0
			: 0
	}));
}

export async function deleteQuotation(supabase: SupabaseClient, id: string) {
	const { error } = await supabase.from('quotations').delete().eq('id', id);
	if (error) throw new Error(error.message);
}
