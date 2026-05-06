import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization');
		if (!authHeader) {
			return json({ success: false, error: 'No autorizado' }, { status: 401 });
		}

		const token = authHeader.replace(/^Bearer\s+/i, '');
		const supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
		const {
			data: { user },
			error: authError
		} = await supabaseClient.auth.getUser(token);

		if (authError || !user) {
			return json({ success: false, error: 'No autorizado' }, { status: 401 });
		}

		const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: { autoRefreshToken: false, persistSession: false }
		});

		const { data: userRoles } = await supabaseAdmin
			.from('user_roles')
			.select('roles(name)')
			.eq('user_id', user.id)
			.eq('is_active', true);

		const roles = userRoles?.map((ur: { roles?: { name?: string } | { name?: string }[] }) => {
			const r = ur.roles;
			if (Array.isArray(r)) return r[0]?.name;
			return r?.name;
		}).filter(Boolean) || [];
		if (!roles.includes('admin') && !roles.includes('superadmin')) {
			return json({ success: false, error: 'Sin permisos para nesting' }, { status: 403 });
		}

		const baseUrl = (env.NESTING_API_URL || '').replace(/\/$/, '');
		const apiToken = (env.NESTING_API_TOKEN || '').trim();
		if (!baseUrl || !apiToken) {
			return json(
				{
					success: false,
					error: 'Servicio de nesting no configurado (NESTING_API_URL / NESTING_API_TOKEN)'
				},
				{ status: 503 }
			);
		}

		const body = await request.json();

		const res = await fetch(`${baseUrl}/nest`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Nesting-Token': apiToken
			},
			body: JSON.stringify(body)
		});

		const text = await res.text();
		let payload: unknown;
		try {
			payload = JSON.parse(text) as unknown;
		} catch {
			return json(
				{ success: false, error: 'Respuesta inválida del servicio de nesting', raw: text.slice(0, 200) },
				{ status: 502 }
			);
		}

		if (!res.ok) {
			const p = payload as { detail?: string | unknown[] };
			let errMsg = `Error del servicio (${res.status})`;
			if (typeof p.detail === 'string') errMsg = p.detail;
			else if (Array.isArray(p.detail)) errMsg = p.detail.map((d) => JSON.stringify(d)).join('; ');
			return json(
				{
					success: false,
					error: errMsg,
					payload
				},
				{ status: res.status >= 400 && res.status < 600 ? res.status : 502 }
			);
		}

		return json({ success: true, ...(payload as Record<string, unknown>) });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Error interno';
		console.error('[API NESTING]', e);
		return json({ success: false, error: message }, { status: 500 });
	}
};
