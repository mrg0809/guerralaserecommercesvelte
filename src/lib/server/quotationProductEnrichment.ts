import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCatalogDetail, getPrimaryProductImageUrl } from '$lib/utils/productMedia';

export type ProductCatalogExtras = {
	imageUrl: string;
	catalogDetail: string;
};

export async function fetchProductCatalogExtras(
	supabase: SupabaseClient,
	productId: string
): Promise<ProductCatalogExtras> {
	const { data } = await supabase
		.from('products')
		.select('short_description, description, product_media(url, is_primary, display_order)')
		.eq('id', productId)
		.single();

	return {
		imageUrl: getPrimaryProductImageUrl(data?.product_media),
		catalogDetail: buildCatalogDetail(data ?? {})
	};
}

export async function fetchProductIdForVariant(
	supabase: SupabaseClient,
	variantId: string
): Promise<string | null> {
	const { data } = await supabase
		.from('product_variants')
		.select('product_id')
		.eq('id', variantId)
		.single();

	return data?.product_id ?? null;
}
