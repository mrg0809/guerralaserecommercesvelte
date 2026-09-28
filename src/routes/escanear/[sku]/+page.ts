import type { PageLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { error } from '@sveltejs/kit';

function asRecord(value: unknown): Record<string, unknown> | null {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
}

function asObjectRow(value: unknown): Record<string, unknown> | null {
	if (Array.isArray(value)) {
		return asRecord(value[0]);
	}
	return asRecord(value);
}

export const load: PageLoad = async ({ params }) => {
	const sku = decodeURIComponent(params.sku || '').trim();
	if (!sku) {
		throw error(404, 'SKU inválido');
	}

	const variantSelect =
		'id, name, sku, price, stock_quantity, attributes, is_active, product_id, products(id, name, slug, sku, base_price, stock_quantity, short_description, description, is_active, product_media(*), product_specifications(*))';

	let { data: variantRows, error: variantError } = await supabase
		.from('product_variants')
		.select(variantSelect)
		.eq('sku', sku)
		.limit(1);

	if (variantError) {
		console.error('Error buscando variante por SKU:', variantError);
	}

	if (!variantRows?.length) {
		const retry = await supabase
			.from('product_variants')
			.select(variantSelect)
			.ilike('sku', sku)
			.limit(1);
		variantRows = retry.data;
	}

	const variant = variantRows?.[0] as Record<string, unknown> | undefined;
	const parent = variant ? asObjectRow(variant.products) : null;

	if (variant && parent) {
		return {
			sku,
			kind: 'variant' as const,
			variantId: String(variant.id),
			productId: String(parent.id),
			name: `${String(parent.name ?? '')} — ${String(variant.name ?? '')}`,
			productName: String(parent.name ?? ''),
			variantName: String(variant.name ?? ''),
			slug: String(parent.slug ?? ''),
			price: Number(variant.price ?? parent.base_price ?? 0),
			stock_quantity: Number(variant.stock_quantity ?? 0),
			short_description: (parent.short_description as string | null) ?? null,
			description: (parent.description as string | null) ?? null,
			attributes: asRecord(variant.attributes),
			media: (parent.product_media as unknown[]) ?? [],
			specifications: (parent.product_specifications as unknown[]) ?? [],
			is_active: Boolean(parent.is_active) && variant.is_active !== false
		};
	}

	const productSelect =
		'id, name, slug, sku, base_price, stock_quantity, short_description, description, is_active, product_media(*), product_specifications(*)';

	let { data: productRows, error: productError } = await supabase
		.from('products')
		.select(productSelect)
		.eq('sku', sku)
		.limit(1);

	if (productError) {
		console.error('Error buscando producto por SKU:', productError);
	}

	if (!productRows?.length) {
		const retry = await supabase.from('products').select(productSelect).ilike('sku', sku).limit(1);
		productRows = retry.data;
	}

	const product = productRows?.[0] as Record<string, unknown> | undefined;
	if (!product) {
		throw error(404, `No se encontró un artículo con SKU ${sku}`);
	}

	return {
		sku,
		kind: 'product' as const,
		variantId: null as string | null,
		productId: String(product.id),
		name: String(product.name ?? ''),
		productName: String(product.name ?? ''),
		variantName: null as string | null,
		slug: String(product.slug ?? ''),
		price: Number(product.base_price ?? 0),
		stock_quantity: Number(product.stock_quantity ?? 0),
		short_description: (product.short_description as string | null) ?? null,
		description: (product.description as string | null) ?? null,
		attributes: null as Record<string, unknown> | null,
		media: (product.product_media as unknown[]) ?? [],
		specifications: (product.product_specifications as unknown[]) ?? [],
		is_active: Boolean(product.is_active)
	};
};
