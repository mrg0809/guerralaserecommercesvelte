import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding, normalizeProductText } from '$lib/utils/embeddings';
import { parsePrice, resolveUnitPrice } from '$lib/server/ai/quoteUtils';
import { fetchProductCatalogExtras } from '$lib/server/quotationProductEnrichment';
import type { CatalogProductHit, QuoteLine } from '$lib/types/assistant';

export type { CatalogProductHit };

function newLineId(): string {
	return crypto.randomUUID();
}

function sanitizeIlikeQuery(query: string): string {
	return query.replace(/[%_,]/g, ' ').trim();
}

function normalizeSearchQuery(query: string): string {
	return sanitizeIlikeQuery(query)
		.toLowerCase()
		.replace(/máquina|maquina|tubo|pieza|unidad de|un|una|dame|cotiza/gi, '')
		.replace(/[^a-z0-9\s]/g, '')
		.trim();
}

async function enrichCatalogHits(
	supabase: SupabaseClient,
	hits: CatalogProductHit[]
): Promise<CatalogProductHit[]> {
	const cache = new Map<string, Awaited<ReturnType<typeof fetchProductCatalogExtras>>>();

	return Promise.all(
		hits.map(async (hit) => {
			if (!hit.product_id) return hit;
			if (!cache.has(hit.product_id)) {
				cache.set(hit.product_id, await fetchProductCatalogExtras(supabase, hit.product_id));
			}
			const extras = cache.get(hit.product_id)!;
			return {
				...hit,
				image_url: extras.imageUrl || undefined,
				catalog_detail: extras.catalogDetail || undefined
			};
		})
	);
}

async function searchByText(
	supabase: SupabaseClient,
	query: string
): Promise<CatalogProductHit | null> {
	const normalizedQuery = normalizeSearchQuery(query);
	if (!normalizedQuery) return null;

	const { data: variants } = await supabase
		.from('product_variants')
		.select('id, name, sku, price, product:products!inner(id, name, base_price, is_active)')
		.eq('product.is_active', true)
		.or(`name.ilike.%${normalizedQuery}%,sku.ilike.%${normalizedQuery}%`)
		.limit(5);

	for (const v of variants ?? []) {
		const product = Array.isArray(v.product) ? v.product[0] : v.product;
		if (!product) continue;
		return {
			id: v.id,
			product_id: product.id,
			variant_id: v.id,
			description: `${product.name} - ${v.name}`,
			sku: v.sku ?? undefined,
			unit_price: parsePrice(v.price) || parsePrice(product.base_price),
			is_variant: true
		};
	}

	const { data: products } = await supabase
		.from('products')
		.select('id, name, sku, base_price')
		.eq('is_active', true)
		.or(`name.ilike.%${normalizedQuery}%,sku.ilike.%${normalizedQuery}%`)
		.limit(5);

	const product = products?.[0];
	if (!product) return null;

	return {
		id: product.id,
		product_id: product.id,
		description: product.name,
		sku: product.sku ?? undefined,
		unit_price: parsePrice(product.base_price),
		is_variant: false
	};
}

export async function searchCatalogProducts(
	supabase: SupabaseClient,
	query: string,
	limit = 8
): Promise<CatalogProductHit[]> {
	const q = sanitizeIlikeQuery(query.trim());
	if (!q) return [];

	const hits: CatalogProductHit[] = [];
	const seen = new Set<string>();

	const { data: variants } = await supabase
		.from('product_variants')
		.select('id, name, sku, price, product:products!inner(id, name, base_price, is_active)')
		.eq('product.is_active', true)
		.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
		.limit(limit);

	for (const v of variants ?? []) {
		const product = Array.isArray(v.product) ? v.product[0] : v.product;
		if (!product) continue;
		const key = `v:${v.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		hits.push({
			id: v.id,
			product_id: product.id,
			variant_id: v.id,
			description: `${product.name} - ${v.name}`,
			sku: v.sku ?? undefined,
			unit_price: parsePrice(v.price) || parsePrice(product.base_price),
			is_variant: true
		});
	}

	if (hits.length >= limit) return enrichCatalogHits(supabase, hits.slice(0, limit));

	const { data: products } = await supabase
		.from('products')
		.select('id, name, sku, base_price')
		.eq('is_active', true)
		.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
		.limit(limit);

	for (const p of products ?? []) {
		const key = `p:${p.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		hits.push({
			id: p.id,
			product_id: p.id,
			description: p.name,
			sku: p.sku ?? undefined,
			unit_price: parsePrice(p.base_price),
			is_variant: false
		});
		if (hits.length >= limit) break;
	}

	return enrichCatalogHits(supabase, hits.slice(0, limit));
}

export async function searchProductLine(
	supabase: SupabaseClient,
	productInfo: { nombre: string; cantidad: number; precio?: number; descuento?: number }
): Promise<QuoteLine> {
	const { nombre, cantidad, precio, descuento } = productInfo;

	try {
		const queryEmbedding = await generateEmbedding(normalizeProductText(nombre));

		const { data: variants } = await supabase.rpc('search_product_variants_by_embedding', {
			query_embedding: queryEmbedding,
			match_threshold: 0.55,
			match_count: 3
		});

		if (variants?.[0]) {
			const v = variants[0];
			let dbPrice = parsePrice(v.price);
			if (!dbPrice && v.id) {
				const { data: row } = await supabase
					.from('product_variants')
					.select('price, product:products(base_price)')
					.eq('id', v.id)
					.single();
				const product = Array.isArray(row?.product) ? row?.product[0] : row?.product;
				dbPrice = parsePrice(row?.price) || parsePrice(product?.base_price);
			}

			return {
				id: newLineId(),
				source: 'catalog',
				variant_id: v.id,
				product_id: v.product_id,
				description: `${v.product_name} - ${v.variant_name}`,
				quantity: cantidad || 1,
				unit_price: resolveUnitPrice(precio, dbPrice),
				discount_percent: descuento ?? 0,
				sku: v.sku ?? undefined
			};
		}

		const { data: products } = await supabase.rpc('search_products_by_embedding', {
			query_embedding: queryEmbedding,
			match_threshold: 0.55,
			match_count: 3
		});

		if (products?.[0]) {
			const p = products[0];
			let dbPrice = parsePrice(p.base_price);
			if (!dbPrice && p.id) {
				const { data: row } = await supabase
					.from('products')
					.select('base_price')
					.eq('id', p.id)
					.single();
				dbPrice = parsePrice(row?.base_price);
			}

			return {
				id: newLineId(),
				source: 'catalog',
				product_id: p.id,
				description: p.name,
				quantity: cantidad || 1,
				unit_price: resolveUnitPrice(precio, dbPrice),
				discount_percent: descuento ?? 0,
				sku: p.sku ?? undefined
			};
		}

		const textHit = await searchByText(supabase, nombre);
		if (textHit) {
			return {
				id: newLineId(),
				source: 'catalog',
				product_id: textHit.product_id,
				variant_id: textHit.variant_id,
				description: textHit.description,
				quantity: cantidad || 1,
				unit_price: resolveUnitPrice(precio, textHit.unit_price),
				discount_percent: descuento ?? 0,
				sku: textHit.sku
			};
		}
	} catch {
		const textHit = await searchByText(supabase, nombre);
		if (textHit) {
			return {
				id: newLineId(),
				source: 'catalog',
				product_id: textHit.product_id,
				variant_id: textHit.variant_id,
				description: textHit.description,
				quantity: cantidad || 1,
				unit_price: resolveUnitPrice(precio, textHit.unit_price),
				discount_percent: descuento ?? 0,
				sku: textHit.sku
			};
		}
	}

	return {
		id: newLineId(),
		source: 'manual',
		description: nombre,
		quantity: cantidad || 1,
		unit_price: resolveUnitPrice(precio, 0),
		discount_percent: descuento ?? 0
	};
}

export function catalogHitToQuoteLine(hit: CatalogProductHit, quantity = 1): QuoteLine {
	return {
		id: newLineId(),
		source: 'catalog',
		product_id: hit.product_id,
		variant_id: hit.variant_id,
		description: hit.description,
		quantity,
		unit_price: hit.unit_price,
		discount_percent: 0,
		sku: hit.sku,
		image_url: hit.image_url,
		catalog_detail: hit.catalog_detail,
		detail_description: '',
		include_detail: false
	};
}

export async function enrichQuoteLine(
	supabase: SupabaseClient,
	line: QuoteLine
): Promise<QuoteLine> {
	if (!line.product_id) return line;
	const extras = await fetchProductCatalogExtras(supabase, line.product_id);
	return {
		...line,
		image_url: extras.imageUrl || line.image_url,
		catalog_detail: extras.catalogDetail || line.catalog_detail
	};
}
