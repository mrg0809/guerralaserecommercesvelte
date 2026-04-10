/**
 * API Endpoint: Stripe Webhook Handler
 * POST /api/stripe/webhook
 * 
 * Handles Stripe webhook events for payment updates
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { supabaseServer } from '$lib/supabaseServer';
import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import { getOrderNotificationRecipients } from '$lib/server/orderNotificationRecipients';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
	apiVersion: '2024-04-10'
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendOrderPaidEmails(order: any, items: any[]) {
	if (!resend) {
		console.warn('[STRIPE WEBHOOK] RESEND_API_KEY no configurada, omitiendo envío de correos');
		return;
	}

	const itemsHtml = items
		.map(
			(item) =>
				`<tr>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ''}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
					<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(item.total_price).toFixed(2)} MXN</td>
				</tr>`
		)
		.join('');

	const customerHtml = `
		<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111827;">
			<h1 style="margin:0 0 12px 0;">✅ Pago confirmado</h1>
			<p>Hola <strong>${order.customer_name}</strong>, gracias por tu compra en Guerra Láser.</p>
			<p><strong>Pedido:</strong> ${order.order_number}</p>
			<table style="width:100%;border-collapse:collapse;margin:16px 0;">
				<thead>
					<tr style="background:#f3f4f6;">
						<th style="padding:8px;text-align:left;">Producto</th>
						<th style="padding:8px;text-align:center;">Cant.</th>
						<th style="padding:8px;text-align:right;">Importe</th>
					</tr>
				</thead>
				<tbody>${itemsHtml}</tbody>
			</table>
			<p><strong>Envío:</strong> ${order.shipping_service || 'Por definir'} (${order.shipping_carrier || 'custom'})</p>
			<p><strong>Total pagado:</strong> $${Number(order.total_amount).toFixed(2)} MXN</p>
			<p>Te contactaremos con actualizaciones de tu envío.</p>
		</div>
	`;

	const adminHtml = `
		<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111827;">
			<h1 style="margin:0 0 12px 0;">🛒 Nuevo pedido pagado</h1>
			<p><strong>Pedido:</strong> ${order.order_number}</p>
			<p><strong>Cliente:</strong> ${order.customer_name} (${order.customer_email})</p>
			<p><strong>Teléfono:</strong> ${order.customer_phone || '-'}</p>
			<p><strong>Total:</strong> $${Number(order.total_amount).toFixed(2)} MXN</p>
			<p><strong>Envío:</strong> ${order.shipping_service || 'Por definir'} (${order.shipping_carrier || 'custom'})</p>
			<table style="width:100%;border-collapse:collapse;margin:16px 0;">
				<thead>
					<tr style="background:#f3f4f6;">
						<th style="padding:8px;text-align:left;">Producto</th>
						<th style="padding:8px;text-align:center;">Cant.</th>
						<th style="padding:8px;text-align:right;">Importe</th>
					</tr>
				</thead>
				<tbody>${itemsHtml}</tbody>
			</table>
		</div>
	`;

	const notificationRecipients = await getOrderNotificationRecipients();

	await Promise.all([
		resend.emails.send({
			from: 'Guerra Laser <contacto@guerralaser.com>',
			to: order.customer_email,
			subject: `Pedido ${order.order_number} confirmado - Guerra Laser`,
			html: customerHtml
		}),
		resend.emails.send({
			from: 'Guerra Laser <contacto@guerralaser.com>',
			to: notificationRecipients,
			subject: `Nuevo pedido pagado ${order.order_number}`,
			html: adminHtml
		})
	]);
}

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
				const { data: orders, error: findError } = await (supabaseServer as any)
				.from('orders')
					.select('id, order_number, customer_name, customer_email, customer_phone, total_amount, shipping_carrier, shipping_service, payment_status')
				.eq('stripe_payment_intent_id', paymentIntent.id)
				.limit(1);

			if (findError || !orders || orders.length === 0) {
				console.error('Order not found for payment intent:', paymentIntent.id);
				break;
			}

				const order = orders[0];
				const orderId = order.id;

				if (order.payment_status === 'paid') {
					console.log('[STRIPE WEBHOOK] Order already paid, skipping duplicate processing:', orderId);
					break;
				}

			// Update order status
				const { error: updateError } = await (supabaseServer as any)
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
					break;
			}

				// Load order items and send notifications
				try {
					const { data: orderItems } = await (supabaseServer as any)
						.from('order_items')
						.select('product_name, variant_name, quantity, total_price')
						.eq('order_id', orderId);

					await sendOrderPaidEmails(
						{
							...order,
							payment_status: 'paid'
						},
						orderItems || []
					);
				} catch (emailError) {
					console.error('[STRIPE WEBHOOK] Error sending confirmation emails:', emailError);
				}
			break;
		}

		case 'payment_intent.payment_failed': {
			const paymentIntent = event.data.object as Stripe.PaymentIntent;
			
				const { data: orders } = await (supabaseServer as any)
				.from('orders')
				.select('id')
				.eq('stripe_payment_intent_id', paymentIntent.id)
				.limit(1);

			if (orders && orders.length > 0) {
					await (supabaseServer as any)
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
