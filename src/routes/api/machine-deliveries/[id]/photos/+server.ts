import { json, type RequestHandler } from '@sveltejs/kit';
import { requireDeliveryAccess } from '$lib/server/deliveryAuth';

export const POST: RequestHandler = async ({ request, params }) => {
	const access = await requireDeliveryAccess(request, params.id!);
	if (!access.ok) return json({ success: false, error: access.error }, { status: access.status });

	const { storage_path, caption, sort_order } = await request.json();
	if (!storage_path) {
		return json({ success: false, error: 'storage_path requerido' }, { status: 400 });
	}

	const { data, error } = await access.admin
		.from('machine_delivery_photos')
		.insert({
			delivery_id: params.id,
			storage_path,
			caption: caption || null,
			sort_order: sort_order ?? 0,
			uploaded_by: access.user.id
		})
		.select()
		.single();

	if (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}

	await access.admin
		.from('machine_deliveries')
		.update({ status: 'in_progress' })
		.eq('id', params.id)
		.in('status', ['draft']);

	return json({ success: true, photo: data });
};

export const DELETE: RequestHandler = async ({ request, params, url }) => {
	const access = await requireDeliveryAccess(request, params.id!);
	if (!access.ok) return json({ success: false, error: access.error }, { status: access.status });

	const photoId = url.searchParams.get('photoId');
	if (!photoId) return json({ success: false, error: 'photoId requerido' }, { status: 400 });

	const { error } = await access.admin
		.from('machine_delivery_photos')
		.delete()
		.eq('id', photoId)
		.eq('delivery_id', params.id);

	if (error) return json({ success: false, error: error.message }, { status: 500 });
	return json({ success: true });
};
