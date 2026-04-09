import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

/**
 * Lista pedidos pagados (service role) tras validar JWT de admin/superadmin.
 * Evita que RLS del cliente oculte filas que sí ves en el SQL Editor.
 */
export const GET: RequestHandler = async ({ request, url }) => {
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

		const filterStatus = url.searchParams.get('status') ?? 'all';

		let query = (supabaseAdmin as any)
			.from('orders')
			.select('*, order_items(*)')
			.eq('payment_status', 'paid')
			.order('created_at', { ascending: false });

		if (filterStatus !== 'all') {
			query = query.eq('status', filterStatus);
		}

		const { data, error } = await query;

		if (error) {
			console.error('[ADMIN ORDERS LIST]', error);
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({ success: true, orders: data ?? [] });
	} catch (error: any) {
		console.error('[ADMIN ORDERS LIST]', error);
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};
