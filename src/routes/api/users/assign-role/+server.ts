import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { UserRole } from '$lib/types/roles';

/**
 * Endpoint para asignar un rol a un usuario
 * Requiere permisos de superadmin
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, roleName } = await request.json();

		if (!userId || !roleName) {
			return json({ success: false, error: 'userId y roleName son requeridos' }, { status: 400 });
		}

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

		// Verificar que tenga permisos de superadmin
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
		if (!roles.includes('superadmin')) {
			return json({ success: false, error: 'No tienes permisos para asignar roles' }, { status: 403 });
		}

		// Obtener el role_id
		const { data: roleData, error: roleError } = await supabaseAdmin
			.from('roles')
			.select('id')
			.eq('name', roleName)
			.eq('is_active', true)
			.single();

		if (roleError || !roleData) {
			return json({ success: false, error: 'Rol no encontrado' }, { status: 404 });
		}

		// Verificar si el usuario ya tiene este rol
		const { data: existingRole } = await supabaseAdmin
			.from('user_roles')
			.select('id')
			.eq('user_id', userId)
			.eq('role_id', roleData.id)
			.eq('is_active', true)
			.single();

		if (existingRole) {
			return json({ success: false, error: 'El usuario ya tiene este rol' }, { status: 400 });
		}

		// Asignar el rol
		const { error } = await supabaseAdmin.from('user_roles').insert({
			user_id: userId,
			role_id: roleData.id,
			assigned_by: user.id,
			is_active: true
		});

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({ success: true, message: 'Rol asignado exitosamente' });
	} catch (error: any) {
		console.error('Error asignando rol:', error);
		return json({ success: false, error: error.message || 'Error desconocido' }, { status: 500 });
	}
};
