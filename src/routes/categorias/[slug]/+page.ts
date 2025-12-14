import type { PageLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const { data: category } = await supabase
		.from('categories')
		.select('*')
		.eq('slug', params.slug)
		.eq('is_active', true)
		.single();

	if (!category) {
		throw error(404, 'Categoría no encontrada');
	}

	const { data: products } = await supabase
		.from('products')
		.select('*, product_media(*)')
		.eq('category_id', category.id)
		.eq('is_active', true)
		.order('created_at', { ascending: false });

	return {
		category,
		products: products?.map((p: any) => ({ ...p, media: p.product_media })) || []
	};
};
