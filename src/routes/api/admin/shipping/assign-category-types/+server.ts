import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

function chunkArray<T>(arr: T[], size: number): T[][] {
	if (size <= 0) return [arr];
	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}
	return result;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization');
		if (!authHeader) {
			return json({ success: false, error: 'No autorizado' }, { status: 401 });
		}

		const token = authHeader.replace('Bearer ', '');
		const supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
		const {
			data: { user },
			error: authError
		} = await supabaseClient.auth.getUser(token);

		if (authError || !user) {
			return json({ success: false, error: 'No autorizado' }, { status: 401 });
		}

		const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		const { data: userRoles } = await supabaseAdmin
			.from('user_roles')
			.select('roles(name)')
			.eq('user_id', user.id)
			.eq('is_active', true);

		const roles = userRoles?.map((ur: any) => ur.roles?.name).filter(Boolean) || [];
		if (!roles.includes('admin') && !roles.includes('superadmin') && !roles.includes('super_admin')) {
			return json(
				{ success: false, error: 'No tienes permisos para asignar tipos de envío' },
				{ status: 403 }
			);
		}

		const { mode = 'replace', categoryId, shippingTypeIds } = await request.json();

		if (mode !== 'replace') {
			return json({ success: false, error: 'Modo no soportado. Usa mode="replace"' }, { status: 400 });
		}

		if (!categoryId || typeof categoryId !== 'string') {
			return json({ success: false, error: 'categoryId es requerido' }, { status: 400 });
		}

		if (!Array.isArray(shippingTypeIds) || shippingTypeIds.some((id) => typeof id !== 'string')) {
			return json({ success: false, error: 'shippingTypeIds debe ser un arreglo de IDs' }, { status: 400 });
		}

		const uniqueShippingTypeIds = Array.from(new Set(shippingTypeIds));
		if (uniqueShippingTypeIds.length === 0) {
			return json({ success: false, error: 'Selecciona al menos un tipo de envío' }, { status: 400 });
		}

		const { data: selectedCategory, error: selectedCategoryError } = await (supabaseAdmin as any)
			.from('categories')
			.select('id')
			.eq('id', categoryId)
			.single();

		if (selectedCategoryError || !selectedCategory) {
			return json({ success: false, error: 'Categoría no encontrada' }, { status: 404 });
		}

		const { data: shippingTypes, error: shippingTypesError } = await (supabaseAdmin as any)
			.from('shipping_types')
			.select('id')
			.in('id', uniqueShippingTypeIds);

		if (shippingTypesError) {
			return json({ success: false, error: shippingTypesError.message }, { status: 500 });
		}

		const validShippingTypeIds = (shippingTypes || []).map((row: any) => row.id);
		if (validShippingTypeIds.length !== uniqueShippingTypeIds.length) {
			return json({ success: false, error: 'Uno o más tipos de envío no son válidos' }, { status: 400 });
		}

		const { data: categories, error: categoriesError } = await (supabaseAdmin as any)
			.from('categories')
			.select('id, parent_id');

		if (categoriesError) {
			return json({ success: false, error: categoriesError.message }, { status: 500 });
		}

		const childrenByParent = new Map<string, string[]>();
		for (const category of categories || []) {
			if (!category.parent_id) continue;
			const list = childrenByParent.get(category.parent_id) || [];
			list.push(category.id);
			childrenByParent.set(category.parent_id, list);
		}

		const categoryIds = new Set<string>();
		const queue: string[] = [categoryId];
		while (queue.length > 0) {
			const current = queue.shift()!;
			if (categoryIds.has(current)) continue;
			categoryIds.add(current);
			const children = childrenByParent.get(current) || [];
			for (const childId of children) {
				queue.push(childId);
			}
		}

		const allCategoryIds = Array.from(categoryIds);

		const { data: products, error: productsError } = await (supabaseAdmin as any)
			.from('products')
			.select('id')
			.in('category_id', allCategoryIds);

		if (productsError) {
			return json({ success: false, error: productsError.message }, { status: 500 });
		}

		const productIds: string[] = (products || []).map((p: any) => p.id);

		if (productIds.length === 0) {
			return json({
				success: true,
				categoriesCount: allCategoryIds.length,
				productsCount: 0
			});
		}

		const productChunks = chunkArray(productIds, 500);

		for (const productChunk of productChunks) {
			const { error: deleteError } = await (supabaseAdmin as any)
				.from('product_shipping_types')
				.delete()
				.in('product_id', productChunk);

			if (deleteError) {
				return json({ success: false, error: deleteError.message }, { status: 500 });
			}
		}

		const relationRows = productIds.flatMap((productId) =>
			validShippingTypeIds.map((shippingTypeId: string) => ({
				product_id: productId,
				shipping_type_id: shippingTypeId
			}))
		);

		for (const relationChunk of chunkArray(relationRows, 1000)) {
			const { error: insertError } = await (supabaseAdmin as any)
				.from('product_shipping_types')
				.insert(relationChunk);

			if (insertError) {
				return json({ success: false, error: insertError.message }, { status: 500 });
			}
		}

		for (const productChunk of productChunks) {
			const { error: updateProductsError } = await (supabaseAdmin as any)
				.from('products')
				.update({ shipping_type_id: validShippingTypeIds[0] ?? null })
				.in('id', productChunk);

			if (updateProductsError) {
				return json({ success: false, error: updateProductsError.message }, { status: 500 });
			}
		}

		return json({
			success: true,
			categoriesCount: allCategoryIds.length,
			productsCount: productIds.length
		});
	} catch (error: any) {
		console.error('[ASSIGN CATEGORY SHIPPING TYPES] Error:', error);
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};
