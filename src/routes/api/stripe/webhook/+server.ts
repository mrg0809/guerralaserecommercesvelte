/**
 * API Endpoint: Stripe Webhook Handler
 * POST /api/stripe/webhook
 * 
 * Handles Stripe webhook events for payment updates
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { supabase } from '$lib/supabaseClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
	apiVersion: '2024-12-18.acacia'
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		return json({ error: 'No signature' }, { status: 400 });
	}

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (err: any) {
		console.error('Webhook signature verification failed:', err.message);
		return json({ error: 'Invalid signature' }, { status: 400 });
	}

	// Handle the event
	switch (event.type) {
		case 'payment_intent.succeeded': {
			const paymentIntent = event.data.object as Stripe.PaymentIntent;
			
			// Find order by payment intent ID
			const { data: orders, error: findError } = await supabase
				.from('orders')
				.select('id')
				.eq('stripe_payment_intent_id', paymentIntent.id)
				.limit(1);

			if (findError || !orders || orders.length === 0) {
				console.error('Order not found for payment intent:', paymentIntent.id);
				break;
			}

			const orderId = orders[0].id;

			// Update order status
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
			}
			break;
		}

		case 'payment_intent.payment_failed': {
			const paymentIntent = event.data.object as Stripe.PaymentIntent;
			
			const { data: orders } = await supabase
				.from('orders')
				.select('id')
				.eq('stripe_payment_intent_id', paymentIntent.id)
				.limit(1);

			if (orders && orders.length > 0) {
				await supabase
					.from('orders')
					.update({
						payment_status: 'failed',
						status: 'cancelled'
					})
					.eq('id', orders[0].id);
			}
			break;
		}

		default:
			console.log(`Unhandled event type: ${event.type}`);
	}

	return json({ received: true });
};
