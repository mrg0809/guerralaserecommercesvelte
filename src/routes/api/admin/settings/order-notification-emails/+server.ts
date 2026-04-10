import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { ORDER_NOTIFICATION_EMAILS_SETTINGS_KEY } from '$lib/server/orderNotificationRecipients';

const MAX_LENGTH = 2000;

async function getAdminClientAndUser(request: Request) {
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		return { error: json({ success: false, error: 'No autorizado' }, { status: 401 }) };
	}

	const token = authHeader.replace('Bearer ', '');
	const supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	const {
		data: { user },
		error: authError
	} = await supabaseClient.auth.getUser(token);

	if (authError || !user) {
		return { error: json({ success: false, error: 'No autorizado' }, { status: 401 }) };
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
		return {
			error: json(
				{ success: false, error: 'No tienes permisos para gestionar esta configuración' },
				{ status: 403 }
			)
		};
	}

	return { supabaseAdmin, user };
}

export const GET: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const { data, error } = await (auth.supabaseAdmin as any)
			.from('admin_settings')
			.select('setting_value')
			.eq('setting_key', ORDER_NOTIFICATION_EMAILS_SETTINGS_KEY)
			.maybeSingle();

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({
			success: true,
			emails: (data?.setting_value || '').trim()
		});
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const payload = await request.json();
		const rawEmails = String(payload?.emails || '').trim();

		if (rawEmails.length > MAX_LENGTH) {
			return json(
				{ success: false, error: `La configuración excede el límite de ${MAX_LENGTH} caracteres` },
				{ status: 400 }
			);
		}

		const { error } = await (auth.supabaseAdmin as any).from('admin_settings').upsert(
			{
				setting_key: ORDER_NOTIFICATION_EMAILS_SETTINGS_KEY,
				setting_value: rawEmails,
				updated_by: auth.user.id
			},
			{
				onConflict: 'setting_key'
			}
		);

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};
