import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Endpoint del servidor para listar usuarios con sus roles
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
			return json({ success: false, error: 'No tienes permisos para ver usuarios' }, { status: 403 });
		}

		// Obtener usuarios
		const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

		if (usersError) {
			return json({ success: false, error: usersError.message }, { status: 400 });
		}

		// Obtener roles de cada usuario
		const usersWithRoles = await Promise.all(
			(users.users || []).map(async (user) => {
				// Obtener roles del usuario desde la base de datos
				const { data: userRolesData } = await supabaseAdmin
					.from('user_roles')
					.select(
						`
						roles (
							name,
							display_name
						)
					`
					)
					.eq('user_id', user.id)
					.eq('is_active', true);

				const userRolesList =
					userRolesData?.map((ur: any) => (ur.roles as { name: string; display_name: string }).name) || [];

				return {
					id: user.id,
					email: user.email || '',
					created_at: user.created_at,
					last_sign_in_at: user.last_sign_in_at,
					roles: userRolesList,
					raw_user_meta_data: user.user_metadata
				};
			})
		);

		return json({ success: true, users: usersWithRoles });
	} catch (error: any) {
		console.error('Error listando usuarios:', error);
		return json({ success: false, error: error.message || 'Error desconocido' }, { status: 500 });
	}
};