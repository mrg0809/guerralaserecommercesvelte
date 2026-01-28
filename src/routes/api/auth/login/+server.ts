import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email, password } = await request.json();

		// Autenticar usuario normal
		const { data, error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (signInError) {
			return error(400, { error: signInError.message });
		}

		if (!data.user || !data.session) {
			return error(400, { error: 'Error en la autenticación' });
		}

		// Obtener roles y permisos del usuario
		const { data: rolesData, error: rolesError } = await supabase
			.rpc('get_user_roles_and_permissions', {
				user_uuid: data.user.id
			});

		if (rolesError) {
			console.error('Error obteniendo roles:', rolesError);
		}

		// Crear un token personalizado con roles (opcional - esto requeriría backend personalizado)
		// Por ahora, retornamos la sesión normal con los datos adicionales
		return json({
			user: data.user,
			session: data.session,
			roles: rolesData?.roles || [],
			permissions: rolesData?.permissions || []
		});
	} catch (err) {
		console.error('Error en login:', err);
		return error(500, { error: 'Error interno del servidor' });
	}
};
