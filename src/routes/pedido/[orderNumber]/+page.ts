import type { PageLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const { data: order } = await supabase
		.from('orders')
		.select('*, order_items(*)')
		.eq('order_number', params.orderNumber)
		.single();

	if (!order) {
		throw error(404, 'Pedido no encontrado');
	}

	return { order };
};
