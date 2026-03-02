import type { PageLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	console.log('🔍 Buscando producto con slug:', params.slug);
	
	const { data: productData, error: err } = await supabase
		.from('products')
		.select('*, product_media(*), product_variants(*), categories(*), product_specifications(*)')
		.eq('slug', params.slug)
		.single();

	console.log('📊 Resultado de búsqueda:', { found: !!productData, error: err?.message });
	
	if (err) {
		console.error('❌ Error en consulta:', err);
		// Si no encuentra nada, intenta buscar todos los productos para debug
		const { data: allProducts } = await supabase
			.from('products')
			.select('id, name, slug')
			.limit(5);
		console.log('📝 Primeros 5 productos en la BD:', allProducts);
	}

	if (!productData) {
		throw error(404, `Producto no encontrado. Slug buscado: ${params.slug}`);
	}

	// Verificar que el producto está activo
	if (!productData.is_active) {
		throw error(404, 'Producto no disponible');
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

	// Get bundles for this product
	const { data: bundles } = await supabase
		.from('product_bundles')
		.select(`
			*,
			bundle_items (
				*,
				products (*),
				product_variants (*)
			)
		`)
		.eq('product_id', productData.id)
		.eq('is_active', true)
		.order('display_order');

	// Calculate bundle savings and total value
	const bundlesWithCalculations = (bundles || []).map((bundle: any) => {
		const items = bundle.bundle_items || [];
		const totalValue = items.reduce((sum: number, item: any) => {
			const itemPrice = item.product_variants?.price || item.products?.base_price || 0;
			return sum + itemPrice * item.quantity;
		}, 0);
		const savings = totalValue - bundle.bundle_price;
		const savingsPercentage = totalValue > 0 ? (savings / totalValue) * 100 : 0;

		return {
			...bundle,
			items: bundle.bundle_items,
			totalValue,
			savings,
			savingsPercentage
		};
	});

	// Sort variants by price (lowest first)
	const sortedVariants = (productData.product_variants || []).sort(
		(a: any, b: any) => (a.price || 0) - (b.price || 0)
	);

	return {
		product: {
			...productData,
			media: productData.product_media,
			variants: sortedVariants,
			bundles: bundlesWithCalculations,
			category: productData.categories,
			discounts: activeDiscounts || [],
			specifications: productData.product_specifications
		}
	};
};
