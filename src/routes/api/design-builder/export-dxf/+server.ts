import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';

async function verifyAdmin(authHeader: string | null) {
	if (!authHeader) {
		return { error: json({ success: false, error: 'No autorizado' }, { status: 401 }) };
	}

	const token = authHeader.replace(/^Bearer\s+/i, '');
	const supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	const {
		data: { user },
		error: authError
	} = await supabaseClient.auth.getUser(token);

	if (authError || !user) {
		return { error: json({ success: false, error: 'No autorizado' }, { status: 401 }) };
	}

	const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	const { data: userRoles } = await supabaseAdmin
		.from('user_roles')
		.select('roles(name)')
		.eq('user_id', user.id)
		.eq('is_active', true);

	const roles =
		userRoles?.map((ur: { roles?: { name?: string } | { name?: string }[] }) => {
			const r = ur.roles;
			if (Array.isArray(r)) return r[0]?.name;
			return r?.name;
		}).filter(Boolean) || [];

	if (!roles.includes('admin') && !roles.includes('superadmin')) {
		return { error: json({ success: false, error: 'Sin permisos para el constructor de diseños' }, { status: 403 }) };
	}

	return { token };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const auth = await verifyAdmin(request.headers.get('authorization'));
		if ('error' in auth && auth.error) return auth.error;

		const baseUrl = (env.NESTING_API_URL || '').replace(/\/$/, '');
		const apiToken = (env.NESTING_API_TOKEN || '').trim();
		if (!baseUrl || !apiToken) {
			return json(
				{
					success: false,
					error: 'Servicio de láser no configurado (NESTING_API_URL / NESTING_API_TOKEN)'
				},
				{ status: 503 }
			);
		}

		const body = await request.json();

		const res = await fetch(`${baseUrl}/api/v1/vector/export-dxf`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Nesting-Token': apiToken
			},
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			let errMsg = `Error del servicio (${res.status})`;
			try {
				const p = JSON.parse(text) as { detail?: string | unknown[] };
				if (typeof p.detail === 'string') errMsg = p.detail;
				else if (Array.isArray(p.detail)) errMsg = p.detail.map((d) => JSON.stringify(d)).join('; ');
			} catch {
				if (text) errMsg = text.slice(0, 300);
			}
			return json({ success: false, error: errMsg }, { status: res.status >= 400 && res.status < 600 ? res.status : 502 });
		}

		const blob = await res.blob();
		const filename =
			res.headers.get('content-disposition')?.match(/filename="?([^";\n]+)"?/)?.[1] ??
			'diseno_guerra_laser.dxf';

		return new Response(blob, {
			status: 200,
			headers: {
				'Content-Type': 'application/dxf',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Error interno';
		console.error('[API DESIGN-BUILDER]', e);
		return json({ success: false, error: message }, { status: 500 });
	}
};
