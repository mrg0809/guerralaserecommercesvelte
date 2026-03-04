import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseServer } from '$lib/supabaseServer';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { orderId, paymentIntentId } = await request.json();

		if (!orderId || !paymentIntentId) {
			return json({ error: 'Invalid payload' }, { status: 400 });
		}

		const { error } = await (supabaseServer as any)
			.from('orders')
			.update({ stripe_payment_intent_id: paymentIntentId })
			.eq('id', orderId);

		if (error) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ success: true });
	} catch (error: any) {
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
};
