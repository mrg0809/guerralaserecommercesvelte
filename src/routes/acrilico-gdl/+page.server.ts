import type { PageServerLoad } from './$types';
import { supabaseServer } from '$lib/supabaseServer';
import { ACRYLIC_SPEC_KEY, ACRYLIC_SPEC_VALUE } from '$lib/acrylicProduct';

export const load: PageServerLoad = async () => {
	const { data: specs, error: specErr } = await supabaseServer
		.from('product_specifications')
		.select('product_id')
		.eq('specification_key', ACRYLIC_SPEC_KEY)
		.eq('specification_value', ACRYLIC_SPEC_VALUE);

	if (specErr) {
		console.error('[acrilico-gdl] specs', specErr);
		return { products: [] as any[], loadError: specErr.message };
	}

	const productIds = [...new Set((specs ?? []).map((s) => s.product_id).filter(Boolean))];
	if (productIds.length === 0) {
		return { products: [] as any[] };
	}

	const { data: products, error: prodErr } = await supabaseServer
		.from('products')
		.select(
			'id, name, slug, base_price, stock_quantity, short_description, category_id, product_media(*), product_variants(*)'
		)
		.in('id', productIds)
		.eq('is_active', true)
		.order('name');

	if (prodErr) {
		console.error('[acrilico-gdl] products', prodErr);
		return { products: [] as any[], loadError: prodErr.message };
	}

	return {
		products: (products || []).map((p: any) => ({
			...p,
			media: p.product_media || [],
			product_variants: (p.product_variants || []).filter((v: any) => v.is_active !== false)
		}))
	};
};
