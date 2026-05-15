import { json, type RequestHandler } from '@sveltejs/kit';
import { requireDeliveryAccess, requireAdmin } from '$lib/server/deliveryAuth';

export const GET: RequestHandler = async ({ request, params }) => {
	const access = await requireDeliveryAccess(request, params.id!);
	if (!access.ok) return json({ success: false, error: access.error }, { status: access.status });

	const { data, error } = await access.admin
		.from('machine_deliveries')
		.select(`*, customers(*), machine_delivery_accessories(*), machine_delivery_photos(*)`)
		.eq('id', params.id)
		.single();

	if (error || !data) {
		return json({ success: false, error: 'No encontrada' }, { status: 404 });
	}

	return json({ success: true, delivery: data });
};

export const PATCH: RequestHandler = async ({ request, params }) => {
	const access = await requireDeliveryAccess(request, params.id!);
	if (!access.ok) return json({ success: false, error: access.error }, { status: access.status });

	const body = await request.json();
	const allowedFields = [
		'assigned_technician_id',
		'machinery_type',
		'machine_model',
		'serial_number',
		'delivery_address',
		'delivery_date',
		'installation_completed',
		'left_operational',
		'training_provided',
		'training_notes',
		'technician_observations',
		'status'
	];

	const updates: Record<string, unknown> = {};
	for (const key of allowedFields) {
		if (key in body) updates[key] = body[key];
	}

	if (!access.isAdmin) {
		delete updates.assigned_technician_id;
		delete updates.machinery_type;
		delete updates.machine_model;
		delete updates.serial_number;
		delete updates.delivery_address;
		delete updates.delivery_date;
	}

	if (Object.keys(updates).length === 0) {
		return json({ success: false, error: 'Sin cambios' }, { status: 400 });
	}

	const { data, error } = await access.admin
		.from('machine_deliveries')
		.update(updates)
		.eq('id', params.id)
		.select(`*, customers(*), machine_delivery_accessories(*), machine_delivery_photos(*)`)
		.single();

	if (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}

	return json({ success: true, delivery: data });
};
