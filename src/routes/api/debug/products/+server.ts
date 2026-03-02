import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';

/**
 * Endpoint de debug para verificar productos
 */
export const GET: RequestHandler = async () => {
	try {
		// Obtener primeros 10 productos
		const { data: products, error } = await supabase
			.from('products')
			.select('id, name, slug, is_active')
			.limit(10);

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		// Contar productos sin slug
		const { data: noSlug } = await supabase
			.from('products')
			.select('id, name')
			.or('slug.is.null,slug.eq.""');

		// Contar productos desactivados
		const { data: inactive } = await supabase
			.from('products')
			.select('id, name')
			.eq('is_active', false);

		return json({
			totalProducts: products?.length || 0,
			products: products || [],
			productsWithoutSlug: noSlug?.length || 0,
			inactiveProducts: inactive?.length || 0,
			message: 'Debug info'
		});
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
