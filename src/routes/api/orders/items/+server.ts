import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseServer } from '$lib/supabaseServer';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { orderId, items } = await request.json();

		if (!orderId || !Array.isArray(items) || items.length === 0) {
			return json({ error: 'Invalid payload' }, { status: 400 });
		}

		const rows = items.map((item: any) => ({
			order_id: orderId,
			product_id: item.product_id,
			variant_id: item.variant_id || null,
			product_name: item.product_name,
			variant_name: item.variant_name || null,
			quantity: item.quantity,
			unit_price: item.unit_price,
			total_price: item.total_price
		}));

		const { error } = await supabaseServer.from('order_items').insert(rows as any);
		if (error) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ success: true });
	} catch (error: any) {
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
};
