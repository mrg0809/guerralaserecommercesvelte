import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } from '$env/static/private';
import { Resend } from 'resend';
import { getOrderNotificationRecipients } from '$lib/server/orderNotificationRecipients';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendTrackingEmail(order: any, shippingCarrier: string, shippingTrackingNumber: string) {
	if (!resend) {
		console.warn('[ADMIN SHIPPING] RESEND_API_KEY no configurada, omitiendo envío de correos');
		return;
	}

	const customerHtml = `
		<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111827;">
			<h1 style="margin:0 0 12px 0;">🚚 Tu pedido va en camino</h1>
			<p>Hola <strong>${order.customer_name}</strong>,</p>
			<p>Tu pedido <strong>${order.order_number}</strong> ya cuenta con guía de envío.</p>
			<p><strong>Paquetería:</strong> ${shippingCarrier}</p>
			<p><strong>Número de guía:</strong> ${shippingTrackingNumber}</p>
			<p>Puedes rastrear tu envío directamente en el sitio de la paquetería.</p>
			<p style="margin-top:20px;">Gracias por comprar en Guerra Láser.</p>
		</div>
	`;

	const adminHtml = `
		<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111827;">
			<h1 style="margin:0 0 12px 0;">📦 Guía registrada manualmente</h1>
			<p><strong>Pedido:</strong> ${order.order_number}</p>
			<p><strong>Cliente:</strong> ${order.customer_name} (${order.customer_email})</p>
			<p><strong>Paquetería:</strong> ${shippingCarrier}</p>
			<p><strong>Número de guía:</strong> ${shippingTrackingNumber}</p>
		</div>
	`;

	const notificationRecipients = await getOrderNotificationRecipients();

	await Promise.all([
		resend.emails.send({
			from: 'Guerra Laser <contacto@guerralaser.com>',
			to: order.customer_email,
			subject: `Tu guía de envío ${order.order_number} - Guerra Laser`,
			html: customerHtml
		}),
		resend.emails.send({
			from: 'Guerra Laser <contacto@guerralaser.com>',
			to: notificationRecipients,
			subject: `Guía capturada para pedido ${order.order_number}`,
			html: adminHtml
		})
	]);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization');
		if (!authHeader) {
			return json({ success: false, error: 'No autorizado' }, { status: 401 });
		}

		const token = authHeader.replace('Bearer ', '');
		const supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
		const {
			data: { user },
			error: authError
		} = await supabaseClient.auth.getUser(token);

		if (authError || !user) {
			return json({ success: false, error: 'No autorizado' }, { status: 401 });
		}

		const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		const { data: userRoles } = await supabaseAdmin
			.from('user_roles')
			.select('roles(name)')
			.eq('user_id', user.id)
			.eq('is_active', true);

		const roles = userRoles?.map((ur: any) => ur.roles?.name).filter(Boolean) || [];
		if (!roles.includes('admin') && !roles.includes('superadmin')) {
			return json({ success: false, error: 'No tienes permisos para actualizar pedidos' }, { status: 403 });
		}

		const { orderId, shippingCarrier, shippingTrackingNumber } = await request.json();

		if (!orderId || !shippingCarrier || !shippingTrackingNumber) {
			return json(
				{ success: false, error: 'orderId, shippingCarrier y shippingTrackingNumber son requeridos' },
				{ status: 400 }
			);
		}

		const { data: order, error: orderError } = await (supabaseAdmin as any)
			.from('orders')
			.select('id, order_number, customer_name, customer_email, payment_status')
			.eq('id', orderId)
			.single();

		if (orderError || !order) {
			return json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });
		}

		if (order.payment_status !== 'paid') {
			return json({ success: false, error: 'Solo se puede capturar guía en pedidos pagados' }, { status: 400 });
		}

		const { error: updateError } = await (supabaseAdmin as any)
			.from('orders')
			.update({
				shipping_carrier: String(shippingCarrier).trim(),
				shipping_tracking_number: String(shippingTrackingNumber).trim(),
				shipping_status: 'in_transit'
			})
			.eq('id', orderId);

		if (updateError) {
			return json({ success: false, error: updateError.message }, { status: 500 });
		}

		try {
			await sendTrackingEmail(order, String(shippingCarrier).trim(), String(shippingTrackingNumber).trim());
		} catch (emailError: any) {
			console.error('[ADMIN SHIPPING] Error enviando correo de guía:', emailError);
			return json({
				success: true,
				warning: 'Guía guardada, pero hubo un error enviando el correo'
			});
		}

		return json({ success: true });
	} catch (error: any) {
		console.error('[ADMIN SHIPPING] Error actualizando guía:', error);
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};
