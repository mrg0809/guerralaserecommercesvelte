import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

/**
 * Conteos de pedidos pagados (service role) tras validar JWT de admin/superadmin.
 * Misma visibilidad que GET /api/admin/orders; evita RLS del cliente en el dashboard.
 */
export const GET: RequestHandler = async ({ request }) => {
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
			return json({ success: false, error: 'No tienes permisos para ver estadísticas de pedidos' }, { status: 403 });
		}

		const paid = () => (supabaseAdmin as any).from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'paid');

		const [totalRes, pendingRes, processingRes, completedRes, cancelledRes] = await Promise.all([
			paid(),
			paid().eq('status', 'pending'),
			paid().eq('status', 'processing'),
			paid().eq('status', 'completed'),
			paid().eq('status', 'cancelled')
		]);

		const err =
			totalRes.error ||
			pendingRes.error ||
			processingRes.error ||
			completedRes.error ||
			cancelledRes.error;
		if (err) {
			console.error('[ADMIN ORDERS STATS]', err);
			return json({ success: false, error: err.message }, { status: 500 });
		}

		return json({
			success: true,
			totalPaid: totalRes.count ?? 0,
			pending: pendingRes.count ?? 0,
			processing: processingRes.count ?? 0,
			completed: completedRes.count ?? 0,
			cancelled: cancelledRes.count ?? 0
		});
	} catch (error: any) {
		console.error('[ADMIN ORDERS STATS]', error);
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};
