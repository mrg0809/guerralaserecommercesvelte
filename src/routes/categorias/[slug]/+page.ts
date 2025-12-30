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

	// Obtener categorías activas para calcular descendientes del padre seleccionado
	const { data: allCategories } = await supabase
		.from('categories')
		.select('id,parent_id,is_active,name,slug')
		.eq('is_active', true);

	// Recolectar IDs de todas las categorías descendientes (incluyendo la actual)
	const ids: string[] = [category.id];
	if (allCategories && allCategories.length > 0) {
		const childrenByParent = new Map<string, string[]>();
		for (const c of allCategories) {
			if (c.parent_id) {
				const arr = childrenByParent.get(c.parent_id) || [];
				arr.push(c.id);
				childrenByParent.set(c.parent_id, arr);
			}
		}

		const stack: string[] = [...(childrenByParent.get(category.id) || [])];
		while (stack.length) {
			const current = stack.pop()!;
			if (!ids.includes(current)) ids.push(current);
			const kids = childrenByParent.get(current) || [];
			for (const kid of kids) {
				if (!ids.includes(kid)) stack.push(kid);
			}
		}
	}


	// Consulta por categorías usando IN para cubrir la categoría y sus descendientes
	const { data: products } = await supabase
		.from('products')
		.select('*, product_media(*), product_variants(*)')
		.in('category_id', ids)
		.eq('is_active', true)
		.order('created_at', { ascending: false });

	const descendantCategories = (allCategories || [])
		.filter((c) => ids.includes(c.id) && c.id !== category.id)
		.map(({ id, name, slug }) => ({ id, name, slug }));

	return {
		category,
		descendantCategories,
		products: products?.map((p: any) => ({ ...p, media: p.product_media })) || []
	};
};
