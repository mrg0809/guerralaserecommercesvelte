import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseServer } from '$lib/supabaseServer';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const {
			order_number,
			customer_name,
			customer_email,
			customer_phone,
			shipping_address,
			billing_address,
			subtotal,
			discount_amount,
			tax_amount,
			shipping_amount,
			shipping_carrier,
			shipping_service,
			total_amount,
			status,
			payment_status,
			notes
		} = await request.json();

		if (!order_number || !customer_name || !customer_email || !shipping_address || total_amount == null) {
			return json({ error: 'Invalid payload' }, { status: 400 });
		}

		const { data, error } = await (supabaseServer as any)
			.from('orders')
			.insert({
				order_number,
				customer_name,
				customer_email,
				customer_phone: customer_phone || null,
				shipping_address,
				billing_address: billing_address || shipping_address,
				subtotal: Number(subtotal || 0),
				discount_amount: Number(discount_amount || 0),
				tax_amount: Number(tax_amount || 0),
				shipping_amount: Number(shipping_amount || 0),
				shipping_carrier: shipping_carrier || 'custom',
				shipping_service: shipping_service || 'standard',
				total_amount: Number(total_amount),
				status: status || 'pending',
				payment_status: payment_status || 'pending',
				notes: notes || null
			})
			.select('id, order_number')
			.single();

		if (error) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ success: true, order: data });
	} catch (error: any) {
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
};
