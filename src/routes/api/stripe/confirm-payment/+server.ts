/**
 * API Endpoint: Confirm Stripe Payment
 * POST /api/stripe/confirm-payment
 * 
 * Confirms a payment and updates order status
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { supabase } from '$lib/supabaseClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
	apiVersion: '2024-12-18.acacia'
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { paymentIntentId, orderId } = body;

		if (!paymentIntentId || !orderId) {
			return json(
				{ error: 'Payment Intent ID and Order ID are required' },
				{ status: 400 }
			);
		}

		// Retrieve payment intent to check status
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

		if (paymentIntent.status === 'succeeded') {
			// Update order status to paid
			const { error: updateError } = await supabase
				.from('orders')
				.update({
					payment_status: 'paid',
					payment_id: paymentIntent.id,
					payment_method: paymentIntent.payment_method as string,
					status: 'processing'
				})
				.eq('id', orderId);

			if (updateError) {
				console.error('Error updating order:', updateError);
				return json({ error: 'Failed to update order' }, { status: 500 });
			}

			return json({
				success: true,
				status: paymentIntent.status,
				orderId
			});
		}

		return json({
			success: false,
			status: paymentIntent.status,
			message: 'Payment not completed'
		});

	} catch (error: any) {
		console.error('Error confirming payment:', error);
		return json(
			{ error: error.message || 'Failed to confirm payment' },
			{ status: 500 }
		);
	}
};
