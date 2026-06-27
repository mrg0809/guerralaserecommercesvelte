import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import { searchCatalogProducts } from '$lib/server/ai/productCatalogSearch';

export const GET: RequestHandler = async ({ request, url }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) return json({ products: [] });

	try {
		const products = await searchCatalogProducts(authResult.admin, q, 10);
		return json({ products });
	} catch (e) {
		const err = e instanceof Error ? e.message : 'Error al buscar productos';
		return json({ error: err }, { status: 500 });
	}
};
