/**
 * API Endpoint: Get shipping options for cart
 * POST /api/shipping/quote
 * 
 * Returns available shipping options based on product shipping_type_id
 * No external API calls - just database lookups
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShippingOptionsForCart } from '$lib/services/shippingService';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { cartItems } = body;

		console.log('[SHIPPING OPTIONS] Request received:', {
			cartItemsCount: cartItems?.length
		});

		if (!cartItems || cartItems.length === 0) {
			return json({ error: 'Cart is empty' }, { status: 400 });
		}

		// Get shipping options based on products in cart
		const shippingOptions = await getShippingOptionsForCart(cartItems);

		console.log('[SHIPPING OPTIONS] Options found:', shippingOptions.length);

		return json({
			success: true,
			options: shippingOptions.map(option => ({
				id: option.id,
				name: option.name,
				description: option.description,
				carrier: option.carrier,
				service: option.service,
				price: option.base_price,
				estimatedDays: option.estimated_days
			}))
		});

	} catch (error: any) {
		console.error('[SHIPPING OPTIONS] ❌ Error:', error);
		return json(
			{ 
				error: error.message || 'Failed to get shipping options',
				debug: {
					message: error.message,
					stack: error.stack
				}
			},
			{ status: 500 }
		);
	}
};
