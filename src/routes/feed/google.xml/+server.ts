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

type ProductRow = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	short_description: string | null;
	base_price: number;
	stock_quantity: number | null;
	sku: string | null;
	product_media?: ProductMediaRow[] | null;
};

const CURRENCY = 'MXN';
const DEFAULT_BRAND = 'Guerra Laser';
const DEFAULT_GOOGLE_PRODUCT_CATEGORY = 'Hardware & Industrial';

export const prerender = false;
export const trailingSlash = 'never';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

function buildItemXml(product: ProductRow, origin: string): string {
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

	return `    <item>
      <g:id>${escapeXml(id)}</g:id>
	<title><![CDATA[${title}]]></title>
	<description><![CDATA[${description}]]></description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${mainImage ? escapeXml(mainImage) : ''}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${escapeXml(price)}</g:price>
      <g:condition>${condition}</g:condition>
      <g:brand>${escapeXml(brand)}</g:brand>${mpn ? `\n      <g:mpn>${escapeXml(mpn)}</g:mpn>` : ''}${gtin ? `\n      <g:gtin>${escapeXml(gtin)}</g:gtin>` : ''}${additionalImageXml}
	<g:google_product_category><![CDATA[${DEFAULT_GOOGLE_PRODUCT_CATEGORY}]]></g:google_product_category>
    </item>`;
}

export const GET: RequestHandler = async ({ url }) => {
	const { data, error } = await supabaseAdmin
		.from('products')
		.select(
			`id, name, slug, description, short_description, base_price, stock_quantity, sku,
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
	const itemsXml = (data as ProductRow[]).map((product) => buildItemXml(product, origin)).join('\n');

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