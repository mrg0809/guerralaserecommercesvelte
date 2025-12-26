import { supabase } from './supabaseClient';
import type { ProductSpecification } from './types';

/**
 * Get all specifications for a product
 */
export async function getProductSpecifications(productId: string): Promise<ProductSpecification[]> {
	const { data, error } = await supabase
		.from('product_specifications')
		.select('*')
		.eq('product_id', productId)
		.order('specification_key');

	if (error) {
		console.error('Error fetching specifications:', error);
		return [];
	}

	return data || [];
}

/**
 * Get specifications grouped by key (for filtering)
 */
export async function getSpecificationsByKey(
	key: string
): Promise<{ value: string; count: number }[]> {
	const { data, error } = await supabase
		.from('product_specifications')
		.select('specification_value')
		.eq('specification_key', key);

	if (error) {
		console.error('Error fetching specifications by key:', error);
		return [];
	}

	// Group and count
	const grouped = (data || []).reduce(
		(acc, item) => {
			const existing = acc.find((x) => x.value === item.specification_value);
			if (existing) {
				existing.count++;
			} else {
				acc.push({ value: item.specification_value, count: 1 });
			}
			return acc;
		},
		[] as { value: string; count: number }[]
	);

	return grouped.sort((a, b) => b.count - a.count);
}

/**
 * Search products by specifications
 */
export async function searchBySpecifications(filters: Record<string, string[]>): Promise<string[]> {
	let query = supabase.from('product_specifications').select('product_id');

	let firstFilter = true;
	for (const [key, values] of Object.entries(filters)) {
		if (values.length > 0) {
			if (firstFilter) {
				query = query.eq('specification_key', key).in('specification_value', values);
				firstFilter = false;
			} else {
				// For multiple keys, we need to do a more complex query
				// This is a simplified version - you might need to adjust based on your needs
				const { data } = await query;
				query = supabase
					.from('product_specifications')
					.select('product_id')
					.eq('specification_key', key)
					.in('specification_value', values);
			}
		}
	}

	const { data, error } = await query;

	if (error) {
		console.error('Error searching by specifications:', error);
		return [];
	}

	// Get unique product IDs
	const productIds = Array.from(new Set((data || []).map((item: any) => item.product_id)));
	return productIds;
}

/**
 * Add specification to product (requires authentication)
 */
export async function addProductSpecification(
	productId: string,
	specification: Omit<ProductSpecification, 'id' | 'created_at' | 'updated_at'>
): Promise<ProductSpecification | null> {
	const { data, error } = await supabase
		.from('product_specifications')
		.insert([
			{
				product_id: productId,
				specification_key: specification.specification_key,
				specification_value: specification.specification_value,
				data_type: specification.data_type || 'text'
			}
		])
		.select()
		.single();

	if (error) {
		console.error('Error adding specification:', error);
		return null;
	}

	return data;
}

/**
 * Update specification (requires authentication)
 */
export async function updateProductSpecification(
	specificationId: string,
	updates: Partial<ProductSpecification>
): Promise<ProductSpecification | null> {
	const { data, error } = await supabase
		.from('product_specifications')
		.update(updates)
		.eq('id', specificationId)
		.select()
		.single();

	if (error) {
		console.error('Error updating specification:', error);
		return null;
	}

	return data;
}

/**
 * Delete specification (requires authentication)
 */
export async function deleteProductSpecification(specificationId: string): Promise<boolean> {
	const { error } = await supabase
		.from('product_specifications')
		.delete()
		.eq('id', specificationId);

	if (error) {
		console.error('Error deleting specification:', error);
		return false;
	}

	return true;
}
