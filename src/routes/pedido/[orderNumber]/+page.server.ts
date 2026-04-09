import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseServer } from '$lib/supabaseServer';

export const load: PageServerLoad = async ({ params }) => {
	const { data: order, error: orderError } = await (supabaseServer as any)
		.from('orders')
		.select('*, order_items(*)')
		.eq('order_number', params.orderNumber)
		.single();

	if (orderError || !order) {
		throw error(404, 'Pedido no encontrado');
	}

	return { order };
};
