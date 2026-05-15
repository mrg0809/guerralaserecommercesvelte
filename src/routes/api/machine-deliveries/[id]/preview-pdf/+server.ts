import { json, type RequestHandler } from '@sveltejs/kit';
import { requireDeliveryAccess, getDeliveryPhotoPublicUrl } from '$lib/server/deliveryAuth';
import { generateDeliveryReceiptPdf, pdfToBase64 } from '$lib/server/deliveryReceiptPdf';
import type { MachineDelivery } from '$lib/types/machineDelivery';

export const POST: RequestHandler = async ({ request, params, url }) => {
	const access = await requireDeliveryAccess(request, params.id!);
	if (!access.ok) return json({ success: false, error: access.error }, { status: access.status });

	const body = await request.json().catch(() => ({}));
	const { customer_signature } = body as { customer_signature?: string };

	const { data: full } = await access.admin
		.from('machine_deliveries')
		.select(`*, customers(*), machine_delivery_accessories(*), machine_delivery_photos(*)`)
		.eq('id', params.id)
		.single();

	if (!full) return json({ success: false, error: 'No encontrada' }, { status: 404 });

	let sigDataUrl = customer_signature || null;
	if (!sigDataUrl && full.customer_signature_path) {
		try {
			const res = await fetch(getDeliveryPhotoPublicUrl(full.customer_signature_path));
			if (res.ok) {
				const buf = await res.arrayBuffer();
				sigDataUrl = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
			}
		} catch {
			/* skip */
		}
	}

	const pdfBytes = await generateDeliveryReceiptPdf({
		delivery: { ...full, ...body } as MachineDelivery,
		accessories: full.machine_delivery_accessories || [],
		customerSignatureDataUrl: sigDataUrl,
		photoDataUrls: [],
		siteOrigin: url.origin
	});

	return json({ success: true, pdfBase64: pdfToBase64(pdfBytes) });
};
