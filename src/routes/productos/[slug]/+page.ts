import type { PageLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const { data: productData } = await supabase
		.from('products')
		.select('*, product_media(*), product_variants(*), categories(*)')
		.eq('slug', params.slug)
		.eq('is_active', true)
		.single();

	if (!productData) {
		throw error(404, 'Producto no encontrado');
	}

	// Get active discounts
	const { data: discounts } = await supabase
		.from('product_discounts')
		.select('*, discounts(*)')
		.eq('product_id', productData.id);

	const activeDiscounts = discounts
		?.filter((pd: any) => {
			const d = pd.discounts;
			if (!d || !d.is_active) return false;
			const now = new Date();
			if (d.start_date && new Date(d.start_date) > now) return false;
			if (d.end_date && new Date(d.end_date) < now) return false;
			return true;
		})
		.map((pd: any) => pd.discounts);

	// Sort variants by price (lowest first)
	const sortedVariants = (productData.product_variants || []).sort(
		(a: any, b: any) => (a.price || 0) - (b.price || 0)
	);

	return {
		product: {
			...productData,
			media: productData.product_media,
			variants: sortedVariants,
			category: productData.categories,
			discounts: activeDiscounts || []
		}
	};
};
