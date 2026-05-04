import jsPDF from 'jspdf';

/** Pedido 4×6 pulgadas (ancho × alto), típico de etiquetas térmicas. */
const LABEL_W_MM = 101.6;
const LABEL_H_MM = 152.4;
const MARGIN = 5;
const CONTENT_W = LABEL_W_MM - MARGIN * 2;

export type ShippingLabelOrderInput = {
	order_number: string;
	customer_name: string;
	customer_email: string;
	customer_phone?: string | null;
	shipping_address?: Record<string, unknown> | null;
	shipping_carrier?: string | null;
	shipping_service?: string | null;
	shipping_tracking_number?: string | null;
};

async function imageUrlToDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const blob = await res.blob();
		const mime = blob.type || '';
		const format: 'PNG' | 'JPEG' = mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : 'PNG';
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error('read'));
			reader.readAsDataURL(blob);
		});
		return { dataUrl, format };
	} catch {
		return null;
	}
}

function addressMainLines(addr: Record<string, unknown>): string[] {
	const lines: string[] = [];
	if (addr.street) lines.push(String(addr.street));
	const cityParts = [addr.city, addr.state].filter(Boolean);
	if (cityParts.length) lines.push(cityParts.join(', '));
	if (addr.zip_code) lines.push(`CP: ${String(addr.zip_code)}`);
	if (addr.country) lines.push(String(addr.country));
	return lines;
}

function addressDetailLines(addr: Record<string, unknown>): string[] {
	const keys = [
		'address_line2',
		'address_line_2',
		'neighborhood',
		'colonia',
		'references',
		'reference',
		'interior',
		'exterior',
		'between_streets',
		'entre_calles',
		'notes_address',
		'additional_info'
	];
	const out: string[] = [];
	for (const k of keys) {
		const v = addr[k];
		if (v === undefined || v === null) continue;
		const s = String(v).trim();
		if (s) out.push(s);
	}
	return out;
}

function shippingMethodLabel(order: ShippingLabelOrderInput): string {
	const carrier = order.shipping_carrier?.trim();
	const service = order.shipping_service?.trim();
	if (carrier && service) return `${carrier} — ${service}`;
	if (carrier) return carrier;
	if (service) return service;
	return 'No especificado';
}

/**
 * Genera y descarga un PDF 4×6 con logo y datos de envío para almacén.
 */
export async function downloadShippingLabelPdf(
	order: ShippingLabelOrderInput,
	logoUrl = '/logorectangular.png'
): Promise<void> {
	const doc = new jsPDF({
		unit: 'mm',
		format: [LABEL_W_MM, LABEL_H_MM],
		orientation: 'portrait'
	});

	let y = MARGIN;

	const logo = await imageUrlToDataUrl(logoUrl);
	if (logo) {
		const logoW = CONTENT_W;
		const logoH = 16;
		try {
			doc.addImage(logo.dataUrl, logo.format, MARGIN, y, logoW, logoH, undefined, 'FAST');
			y += logoH + 3;
		} catch {
			doc.setFontSize(12);
			doc.setFont('helvetica', 'bold');
			doc.text('Guerra Láser', MARGIN, y + 4);
			y += 8;
		}
	} else {
		doc.setFontSize(12);
		doc.setFont('helvetica', 'bold');
		doc.text('Guerra Láser', MARGIN, y + 4);
		y += 8;
	}

	/** Altura aproximada de línea en mm según tamaño de fuente (pt). */
	const lineGapMm = (pt: number) => (pt / 72) * 25.4 * 1.2;

	const writeBlock = (title: string, bodyLines: string[], titleSize = 9, bodySize = 9) => {
		if (y > LABEL_H_MM - MARGIN - 6) return;

		doc.setFont('helvetica', 'bold');
		doc.setFontSize(titleSize);
		doc.text(title, MARGIN, y);
		y += lineGapMm(titleSize) + 0.5;

		doc.setFont('helvetica', 'normal');
		doc.setFontSize(bodySize);
		const lh = lineGapMm(bodySize);
		for (const raw of bodyLines) {
			if (y > LABEL_H_MM - MARGIN - 4) return;
			const wrapped = doc.splitTextToSize(raw, CONTENT_W);
			doc.text(wrapped, MARGIN, y);
			y += Math.max(lh, wrapped.length * lh);
		}
		y += 1.5;
	};

	writeBlock('Número de pedido', [order.order_number], 9, 11);

	const addr = order.shipping_address;
	if (addr && typeof addr === 'object') {
		writeBlock('Destinatario', [order.customer_name]);
		writeBlock('Dirección', addressMainLines(addr as Record<string, unknown>));
		const details = addressDetailLines(addr as Record<string, unknown>);
		if (details.length) {
			writeBlock('Detalles / referencias', details);
		}
	} else {
		writeBlock('Destinatario', [order.customer_name]);
		writeBlock('Dirección', ['Sin dirección registrada']);
	}

	const contact: string[] = [order.customer_email];
	if (order.customer_phone?.trim()) contact.push(order.customer_phone.trim());
	writeBlock('Contacto', contact);

	writeBlock('Método de envío (interno)', [shippingMethodLabel(order)]);

	if (order.shipping_tracking_number?.trim()) {
		writeBlock('Número de guía', [order.shipping_tracking_number.trim()]);
	}

	const safeName = order.order_number.replace(/[^\w.-]+/g, '_');
	doc.save(`etiqueta-${safeName}.pdf`);
}
