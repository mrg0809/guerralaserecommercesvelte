import type { RequestHandler } from './$types';
import { supabaseServer } from '$lib/supabaseServer';

const SITE_URL = 'https://guerralaser.com';

const staticEntries = [
	{ loc: `${SITE_URL}/`, priority: 1.0 },
	{ loc: `${SITE_URL}/categorias/maquinaria`, priority: 0.9 },
	{ loc: `${SITE_URL}/categorias/refacciones`, priority: 0.9 },
	{ loc: `${SITE_URL}/categorias/chillers-compresores-extractores`, priority: 0.9 },
	{ loc: `${SITE_URL}/categorias/tubos-laser`, priority: 0.9 },
	{ loc: `${SITE_URL}/privacidad`, priority: 0.8 },
	{ loc: `${SITE_URL}/politica-envios`, priority: 0.8 },
	{ loc: `${SITE_URL}/politica-devoluciones`, priority: 0.8 },
	{ loc: `${SITE_URL}/terminos`, priority: 0.8 }
];

function xmlUrl({ loc, lastmod, priority }: { loc: string; lastmod?: string; priority: number }) {
	return `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <priority>${priority.toFixed(1)}</priority>\n  </url>`;
}

export const GET: RequestHandler = async () => {
	const { data: products } = await supabaseServer
		.from('products')
		.select('slug, updated_at')
		.eq('is_active', true);

	const productEntries = (products || [])
		.filter((p) => p.slug)
		.map((p) => ({
			loc: `${SITE_URL}/productos/${p.slug}`,
			lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
			priority: 0.7
		}));

	const allEntries = [...staticEntries, ...productEntries];

	const urlsXml = allEntries.map(xmlUrl).join('\n');
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`;

	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': 'application/xml'
		}
	});
};
