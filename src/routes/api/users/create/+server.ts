import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/private';
import { PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Endpoint del servidor para crear usuarios
 * Requiere permisos de superadmin
 */
export const POST: RequestHandler = async ({ request }) => {
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

		// Verificar que sea superadmin
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
			return json({ success: false, error: 'Solo superadmins pueden crear usuarios' }, { status: 403 });
		}

		try {
			const { email, password, metadata } = await request.json();

			if (!email || !password) {
				return json({ success: false, error: 'Email y contraseña son requeridos' }, { status: 400 });
			}

			// Crear usuario
			const { data, error } = await supabaseAdmin.auth.admin.createUser({
				email,
				password,
				email_confirm: true, // Auto-confirmar email
				user_metadata: metadata || {}
			});

			if (error) {
				return json({ success: false, error: error.message }, { status: 400 });
			}

			return json({ success: true, userId: data.user.id, user: data.user });
		} catch (error: any) {
			console.error('Error creando usuario:', error);
			return json({ success: false, error: error.message || 'Error desconocido' }, { status: 500 });
		}
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error de autenticación' }, { status: 401 });
	}
};
