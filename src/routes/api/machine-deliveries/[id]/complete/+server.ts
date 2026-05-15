import { json, type RequestHandler } from '@sveltejs/kit';
import { requireDeliveryAccess, getDeliveryPhotoPublicUrl } from '$lib/server/deliveryAuth';
import { generateDeliveryReceiptPdf, pdfToBase64 } from '$lib/server/deliveryReceiptPdf';
import { sendDeliveryReceiptEmail } from '$lib/server/sendDeliveryReceiptEmail';
import type { MachineDelivery } from '$lib/types/machineDelivery';

function base64ToBuffer(dataUrl: string): Buffer {
	const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
	return Buffer.from(base64, 'base64');
}

export const POST: RequestHandler = async ({ request, params, url }) => {
	const access = await requireDeliveryAccess(request, params.id!);
	if (!access.ok) return json({ success: false, error: access.error }, { status: access.status });

	const delivery = access.delivery as MachineDelivery & {
		customers: MachineDelivery['customers'];
	};
	if (delivery.status === 'emailed') {
		return json({ success: false, error: 'Esta entrega ya fue cerrada' }, { status: 400 });
	}

	const body = await request.json();
	const {
		customer_signature,
		customer_observations,
		technician_observations,
		installation_completed,
		left_operational,
		training_provided,
		training_notes
	} = body;

	if (!customer_signature) {
		return json({ success: false, error: 'La firma del cliente es obligatoria' }, { status: 400 });
	}

	const updatePayload: Record<string, unknown> = {
		customer_observations: customer_observations || null,
		technician_observations: technician_observations ?? delivery.technician_observations,
		installation_completed: installation_completed ?? delivery.installation_completed,
		left_operational: left_operational ?? delivery.left_operational,
		training_provided: training_provided ?? delivery.training_provided,
		training_notes: training_notes ?? delivery.training_notes,
		status: 'signed',
		signed_at: new Date().toISOString()
	};

	const sigPath = `signatures/${params.id}/customer-${Date.now()}.png`;
	const sigBuffer = base64ToBuffer(customer_signature);
	const { error: sigErr } = await access.admin.storage
		.from('delivery-photos')
		.upload(sigPath, sigBuffer, { contentType: 'image/png', upsert: true });

	if (sigErr) {
		return json({ success: false, error: 'Error al guardar firma: ' + sigErr.message }, { status: 500 });
	}
	updatePayload.customer_signature_path = sigPath;

	await access.admin.from('machine_deliveries').update(updatePayload).eq('id', params.id);

	const { data: full } = await access.admin
		.from('machine_deliveries')
		.select(`*, customers(*), machine_delivery_accessories(*), machine_delivery_photos(*)`)
		.eq('id', params.id)
		.single();

	if (!full) {
		return json({ success: false, error: 'Entrega no encontrada' }, { status: 404 });
	}

	const photoDataUrls: string[] = [];
	for (const photo of full.machine_delivery_photos || []) {
		const url = getDeliveryPhotoPublicUrl(photo.storage_path);
		try {
			const res = await fetch(url);
			if (res.ok) {
				const buf = await res.arrayBuffer();
				const b64 = Buffer.from(buf).toString('base64');
				const ct = res.headers.get('content-type') || 'image/jpeg';
				photoDataUrls.push(`data:${ct};base64,${b64}`);
			}
		} catch {
			/* skip */
		}
	}

	const siteOrigin = url.origin;
	const pdfBytes = await generateDeliveryReceiptPdf({
		delivery: full as MachineDelivery,
		accessories: full.machine_delivery_accessories || [],
		customerSignatureDataUrl: customer_signature,
		photoDataUrls,
		siteOrigin
	});

	const pdfPath = `pdfs/${params.id}/acta-${full.delivery_number}.pdf`;
	const { error: pdfErr } = await access.admin.storage
		.from('delivery-photos')
		.upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

	if (pdfErr) {
		return json({ success: false, error: 'Error al guardar PDF: ' + pdfErr.message }, { status: 500 });
	}

	await access.admin
		.from('machine_deliveries')
		.update({ pdf_storage_path: pdfPath })
		.eq('id', params.id);

	const customer = full.customers;
	const pdfBase64 = pdfToBase64(pdfBytes);
	let emailSent = false;
	let emailError: string | null = null;

	if (customer?.email) {
		try {
			await sendDeliveryReceiptEmail({
				customerEmail: customer.email,
				customerName: customer.contact_name,
				deliveryNumber: full.delivery_number,
				pdfBase64
			});
			emailSent = true;
			await access.admin
				.from('machine_deliveries')
				.update({ status: 'emailed', emailed_at: new Date().toISOString() })
				.eq('id', params.id);
		} catch (e: unknown) {
			emailError = e instanceof Error ? e.message : 'Error al enviar correo';
		}
	}

	return json({
		success: true,
		emailSent,
		emailError,
		pdfPath,
		deliveryNumber: full.delivery_number
	});
};
