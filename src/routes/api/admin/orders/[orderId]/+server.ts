import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export const GET: RequestHandler = async ({ request, params }) => {
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
			return json({ success: false, error: 'No tienes permisos para ver pedidos' }, { status: 403 });
		}

		const orderId = params.orderId;
		if (!orderId) {
			return json({ success: false, error: 'orderId requerido' }, { status: 400 });
		}

		const { data, error } = await (supabaseAdmin as any)
			.from('orders')
			.select('*, order_items(*)')
			.eq('id', orderId)
			.eq('payment_status', 'paid')
			.single();

		if (error || !data) {
			return json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });
		}

		return json({ success: true, order: data });
	} catch (error: any) {
		console.error('[ADMIN ORDER DETAIL]', error);
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};
