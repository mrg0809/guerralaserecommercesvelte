import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin, isTechnicianRole, getAuthUserFromRequest, getUserRoleNames, getSupabaseAdmin } from '$lib/server/deliveryAuth';

export const GET: RequestHandler = async ({ request, url }) => {
	const user = await getAuthUserFromRequest(request);
	if (!user) return json({ success: false, error: 'No autorizado' }, { status: 401 });

	const roles = await getUserRoleNames(user.id);
	const admin = getSupabaseAdmin();
	const isAdmin = roles.includes('admin') || roles.includes('superadmin');
	const isTech = isTechnicianRole(roles);

	if (!isAdmin && !isTech) {
		return json({ success: false, error: 'Sin permisos' }, { status: 403 });
	}

	let query = admin
		.from('machine_deliveries')
		.select(
			`*, customers(id, contact_name, company_name, email, phone),
      machine_delivery_accessories(*),
      machine_delivery_photos(*)`
		)
		.order('created_at', { ascending: false });

	if (isTech && !isAdmin) {
		query = query.eq('assigned_technician_id', user.id);
	}

	const status = url.searchParams.get('status');
	if (status && status !== 'all') {
		query = query.eq('status', status);
	}

	const { data, error } = await query;
	if (error) {
		console.error('[DELIVERIES LIST]', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}

	return json({ success: true, deliveries: data ?? [] });
};

export const POST: RequestHandler = async ({ request }) => {
	const auth = await requireAdmin(request);
	if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

	const body = await request.json();
	const {
		customer_id,
		assigned_technician_id,
		machinery_type,
		machine_model,
		serial_number,
		delivery_address,
		delivery_date,
		installation_completed,
		left_operational,
		training_provided,
		training_notes,
		accessories
	} = body;

	if (!customer_id || !machinery_type || !machine_model || !serial_number || !delivery_address) {
		return json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 });
	}

	const { data: delivery, error } = await auth.admin
		.from('machine_deliveries')
		.insert({
			customer_id,
			assigned_technician_id: assigned_technician_id || null,
			created_by: auth.user.id,
			machinery_type,
			machine_model,
			serial_number,
			delivery_address,
			delivery_date: delivery_date || new Date().toISOString().slice(0, 10),
			installation_completed: !!installation_completed,
			left_operational: !!left_operational,
			training_provided: !!training_provided,
			training_notes: training_notes || null,
			status: assigned_technician_id ? 'in_progress' : 'draft'
		})
		.select('*, customers(*)')
		.single();

	if (error || !delivery) {
		return json({ success: false, error: error?.message || 'Error al crear' }, { status: 500 });
	}

	if (Array.isArray(accessories) && accessories.length > 0) {
		const rows = accessories.map((a: Record<string, string>) => ({
			delivery_id: delivery.id,
			accessory_type: a.accessory_type,
			description: a.description || null,
			serial_number: a.serial_number || null,
			notes: a.notes || null
		}));
		await auth.admin.from('machine_delivery_accessories').insert(rows);
	}

	const { data: full } = await auth.admin
		.from('machine_deliveries')
		.select(`*, customers(*), machine_delivery_accessories(*)`)
		.eq('id', delivery.id)
		.single();

	return json({ success: true, delivery: full });
};
