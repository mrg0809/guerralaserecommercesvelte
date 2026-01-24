import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Endpoint para obtener todos los roles disponibles
 * Requiere permisos de admin o superadmin
 */
export const GET: RequestHandler = async ({ request }) => {
	try {
		// Verificar autenticación del usuario
		const authHeader = request.headers.get('authorization');
		if (!authHeader) {
			return json({ success: false, error: 'No autorizado' }, { status: 401 });
		}

		// Verificar permisos usando Supabase
		const supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
		const token = authHeader.replace('Bearer ', '');
		const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

		if (authError || !user) {
			return json({ success: false, error: 'No autorizado' }, { status: 401 });
		}

		// Verificar que tenga permisos de admin
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
			return json({ success: false, error: 'No tienes permisos para ver roles' }, { status: 403 });
		}

		// Obtener roles usando el cliente admin (evita RLS)
		const { data: rolesData, error } = await supabaseAdmin
			.from('roles')
			.select('id, name, display_name')
			.eq('is_active', true)
			.order('name');

		if (error) {
			console.error('Error obteniendo roles:', error);
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({ success: true, roles: rolesData || [] });
	} catch (error: any) {
		console.error('Error en endpoint de roles:', error);
		return json({ success: false, error: error.message || 'Error desconocido' }, { status: 500 });
	}
};
