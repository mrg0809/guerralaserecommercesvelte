import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const ALLOWED_STATUS = new Set(['pending', 'processing', 'completed', 'cancelled']);

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

		const { orderId, status } = await request.json();
		if (!orderId || !status || !ALLOWED_STATUS.has(status)) {
			return json({ success: false, error: 'orderId/status inválidos' }, { status: 400 });
		}

		const { data: order, error: orderError } = await (supabaseAdmin as any)
			.from('orders')
			.select('id, payment_status')
			.eq('id', orderId)
			.single();

		if (orderError || !order) {
			return json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });
		}

		if (order.payment_status !== 'paid') {
			return json({ success: false, error: 'Solo se pueden actualizar pedidos pagados' }, { status: 400 });
		}

		const { error: updateError } = await (supabaseAdmin as any)
			.from('orders')
			.update({ status })
			.eq('id', orderId);

		if (updateError) {
			return json({ success: false, error: updateError.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (error: any) {
		console.error('[ADMIN STATUS] Error actualizando pedido:', error);
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};
