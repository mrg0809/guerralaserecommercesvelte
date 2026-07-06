import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Permission } from '$lib/types/roles';
import { hasPermission } from '$lib/services/permissions';

export type AdminAuthResult =
	| { ok: true; userId: string; supabaseAdmin: SupabaseClient }
	| { ok: false; status: number; error: string };

export async function authenticateAdminRequest(
	request: Request,
	permission?: Permission
): Promise<AdminAuthResult> {
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		return { ok: false, status: 401, error: 'No autorizado' };
	}

	const token = authHeader.replace('Bearer ', '');
	const supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	const {
		data: { user },
		error: authError
	} = await supabaseClient.auth.getUser(token);

	if (authError || !user) {
		return { ok: false, status: 401, error: 'No autorizado' };
	}

	if (permission) {
		const allowed = await hasPermission(user.id, permission);
		if (!allowed) {
			return { ok: false, status: 403, error: 'No tienes permisos para esta acción' };
		}
	}

	const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	return { ok: true, userId: user.id, supabaseAdmin };
}
