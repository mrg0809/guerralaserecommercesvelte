import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin, getDeliveryPhotoPublicUrl } from '$lib/server/deliveryAuth';
import { generateDeliveryReceiptPdf, pdfToBase64 } from '$lib/server/deliveryReceiptPdf';
import { sendDeliveryReceiptEmail } from '$lib/server/sendDeliveryReceiptEmail';
import type { MachineDelivery } from '$lib/types/machineDelivery';

export const POST: RequestHandler = async ({ request, params, url }) => {
	const auth = await requireAdmin(request);
	if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

	const { data: full, error } = await auth.admin
		.from('machine_deliveries')
		.select(`*, customers(*), machine_delivery_accessories(*), machine_delivery_photos(*)`)
		.eq('id', params.id)
		.single();

	if (error || !full) {
		return json({ success: false, error: 'Entrega no encontrada' }, { status: 404 });
	}

	if (!full.customers?.email) {
		return json({ success: false, error: 'El cliente no tiene email' }, { status: 400 });
	}

	let customerSignatureDataUrl: string | null = null;
	if (full.customer_signature_path) {
		const sigUrl = getDeliveryPhotoPublicUrl(full.customer_signature_path);
		try {
			const res = await fetch(sigUrl);
			if (res.ok) {
				const buf = await res.arrayBuffer();
				customerSignatureDataUrl = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
			}
		} catch {
			/* skip */
		}
	}

	const photoDataUrls: string[] = [];
	for (const photo of full.machine_delivery_photos || []) {
		try {
			const res = await fetch(getDeliveryPhotoPublicUrl(photo.storage_path));
			if (res.ok) {
				const buf = await res.arrayBuffer();
				const ct = res.headers.get('content-type') || 'image/jpeg';
				photoDataUrls.push(`data:${ct};base64,${Buffer.from(buf).toString('base64')}`);
			}
		} catch {
			/* skip */
		}
	}

	const pdfBytes = await generateDeliveryReceiptPdf({
		delivery: full as MachineDelivery,
		accessories: full.machine_delivery_accessories || [],
		customerSignatureDataUrl,
		photoDataUrls,
		siteOrigin: url.origin
	});

	const pdfBase64 = pdfToBase64(pdfBytes);

	try {
		await sendDeliveryReceiptEmail({
			customerEmail: full.customers.email,
			customerName: full.customers.contact_name,
			deliveryNumber: full.delivery_number,
			pdfBase64
		});
		await auth.admin
			.from('machine_deliveries')
			.update({ status: 'emailed', emailed_at: new Date().toISOString() })
			.eq('id', params.id);

		return json({ success: true });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Error al enviar';
		return json({ success: false, error: msg }, { status: 500 });
	}
};
