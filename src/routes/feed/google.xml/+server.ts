import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { getImageKitUrl } from '$lib/storage';

type ProductMediaRow = {
	url: string | null;
	is_primary: boolean | null;
	display_order: number | null;
};

type CategoryRow = {
	id: string;
	name: string;
	google_category_id: string | null;
	google_category_name: string | null;
	parent_id: string | null;
};

type ShippingTypeRow = {
	name: string;
	requires_quotation: boolean;
};

type ProductRow = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	short_description: string | null;
	base_price: number;
	stock_quantity: number | null;
	sku: string | null;
	category_id: string | null;
	shipping_type_id: string | null;
	shipping_types?: ShippingTypeRow | null;
	product_media?: ProductMediaRow[] | null;
	categories?: CategoryRow | null;
};

type GoogleCategory = {
	id: string;
	name: string;
};

const CURRENCY = 'MXN';
const DEFAULT_BRAND = 'Guerra Laser';
const FALLBACK_GOOGLE_CATEGORY: GoogleCategory = {
	id: '2151',
	name: 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment'
};

export const prerender = false;
export const trailingSlash = 'never';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Resuelve la categoría de Google Merchant para un producto
 * Implementa herencia jerárquica: si la categoría no tiene mapeo, busca en el padre recursivamente
 */
function resolveGoogleCategory(
	categories: CategoryRow[],
	productCategoryId: string | null
): GoogleCategory {
	if (!productCategoryId) {
		return FALLBACK_GOOGLE_CATEGORY;
	}

	// Buscar la categoría del producto
	let currentCategory = categories.find((c) => c.id === productCategoryId);
	
	// Recorrer jerarquía hacia arriba hasta encontrar mapeo
	while (currentCategory) {
		// Si esta categoría tiene mapeo de Google, usarlo
		if (currentCategory.google_category_id && currentCategory.google_category_name) {
			return {
				id: currentCategory.google_category_id,
				name: currentCategory.google_category_name
			};
		}

		// Si tiene padre, buscar en el padre
		if (currentCategory.parent_id) {
			currentCategory = categories.find((c) => c.id === currentCategory!.parent_id);
		} else {
			// No tiene padre y no tiene mapeo
			break;
		}
	}

	// No se encontró mapeo en toda la jerarquía
	return FALLBACK_GOOGLE_CATEGORY;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function buildImageList(media: ProductMediaRow[] | null | undefined): string[] {
	if (!media || media.length === 0) return [];
	const sorted = [...media].sort((a, b) => {
		const aPrimary = a.is_primary ? 1 : 0;
		const bPrimary = b.is_primary ? 1 : 0;
		if (aPrimary !== bPrimary) return bPrimary - aPrimary;
		const aOrder = a.display_order ?? 0;
		const bOrder = b.display_order ?? 0;
		return aOrder - bOrder;
	});

	return sorted
		.map((item) => item.url)
		.filter((url): url is string => Boolean(url))
		.map((url) => getImageKitUrl(url));
}

function buildItemXml(
	product: ProductRow,
	origin: string,
	googleCategory: GoogleCategory
): string {
	const id = product.sku?.trim() || product.id;
	const title = product.name;
	const description = product.description || product.short_description || product.name;
	const link = `${origin}/productos/${encodeURIComponent(product.slug)}`;

	const availability = product.stock_quantity && product.stock_quantity > 0 ? 'in stock' : 'out of stock';
	const price = `${product.base_price.toFixed(2)} ${CURRENCY}`;
	const condition = 'new';

	const brand = DEFAULT_BRAND;
	const mpn = product.sku?.trim() || null;
	const gtin = null;

	const images = buildImageList(product.product_media);
	const mainImage = images[0];
	const additionalImages = images.slice(1);

	const additionalImageXml = additionalImages
		.map((img) => `\n      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`)
		.join('');

	// Build shipping element for heavy items (requires quotation)
	const shippingType = product.shipping_types?.name;
	const requiresQuotation = product.shipping_types?.requires_quotation;
	
	let shippingXml = '';
	if (shippingType === 'heavy' || shippingType === 'delicate' || requiresQuotation) {
		shippingXml = `
      <g:shipping>
        <g:country>MX</g:country>
        <g:service>Flete especializado / A convenir</g:service>
        <g:price>0.00 ${CURRENCY}</g:price>
      </g:shipping>`;
	}

	return `    <item>
      <g:id>${escapeXml(id)}</g:id>
	<title><![CDATA[${title}]]></title>
	<description><![CDATA[${description}]]></description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${mainImage ? escapeXml(mainImage) : ''}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${escapeXml(price)}</g:price>
      <g:condition>${condition}</g:condition>
      <g:brand>${escapeXml(brand)}</g:brand>${mpn ? `\n      <g:mpn>${escapeXml(mpn)}</g:mpn>` : ''}${gtin ? `\n      <g:gtin>${escapeXml(gtin)}</g:gtin>` : ''}${additionalImageXml}${shippingXml}
	<g:google_product_category>${escapeXml(googleCategory.id)}</g:google_product_category>
    </item>`;
}

export const GET: RequestHandler = async ({ url }) => {
	// Cargar todas las categorías para resolución jerárquica
	const { data: allCategories, error: categoriesError } = await supabaseAdmin
		.from('categories')
		.select('id, name, google_category_id, google_category_name, parent_id')
		.eq('is_active', true);

	if (categoriesError) {
		console.error('Error loading categories:', categoriesError);
	}

	const categories: CategoryRow[] = allCategories || [];

	// Cargar productos con su categoría y shipping type
	const { data, error } = await supabaseAdmin
		.from('products')
		.select(
			`id, name, slug, description, short_description, base_price, stock_quantity, sku, category_id, shipping_type_id,
			 shipping_types(name, requires_quotation),
			 product_media(url, is_primary, display_order)`
		)
		.eq('is_active', true)
		.order('name');

	if (error) {
		return new Response(`<!-- Error: ${escapeXml(error.message)} -->`, {
			status: 500,
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'X-Content-Type-Options': 'nosniff',
				'Cache-Control': 'no-store'
			}
		});
	}

	const origin = url.origin;
	
	// Generar XML para cada producto con su categoría de Google resuelta
	const itemsXml = (data as ProductRow[])
		.map((product) => {
			const googleCategory = resolveGoogleCategory(categories, product.category_id);
			return buildItemXml(product, origin, googleCategory);
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
		<title><![CDATA[Guerra Láser Ecommerce]]></title>
    <link>${escapeXml(origin)}</link>
		<description><![CDATA[Feed de productos para Google Merchant Center]]></description>
${itemsXml}
  </channel>
</rss>`;

	return new Response(xml, {
		status: 200,
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'no-store'
		}
	});
};