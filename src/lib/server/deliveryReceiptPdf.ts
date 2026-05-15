import jsPDF from 'jspdf';
import {
	ACCESSORY_LABELS,
	MACHINERY_TYPE_LABELS,
	type MachineDelivery,
	type MachineDeliveryAccessory
} from '$lib/types/machineDelivery';

const RED = [220, 38, 38] as const;
const BLUE = [37, 99, 235] as const;

async function loadLogoDataUrl(origin: string): Promise<string | null> {
	try {
		const res = await fetch(`${origin}/logorectangular.png`);
		if (!res.ok) return null;
		const buf = await res.arrayBuffer();
		const b64 = Buffer.from(buf).toString('base64');
		return `data:image/png;base64,${b64}`;
	} catch {
		return null;
	}
}

async function loadImageDataUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const buf = await res.arrayBuffer();
		const contentType = res.headers.get('content-type') || 'image/png';
		const b64 = Buffer.from(buf).toString('base64');
		return `data:${contentType};base64,${b64}`;
	} catch {
		return null;
	}
}

function yesNo(value: boolean): string {
	return value ? 'Sí' : 'No';
}

export type DeliveryPdfInput = {
	delivery: MachineDelivery;
	accessories: MachineDeliveryAccessory[];
	customerSignatureDataUrl?: string | null;
	photoDataUrls?: string[];
	siteOrigin?: string;
};

export async function generateDeliveryReceiptPdf(input: DeliveryPdfInput): Promise<Uint8Array> {
	const { delivery, accessories, customerSignatureDataUrl, photoDataUrls = [] } = input;
	const origin = input.siteOrigin || 'https://guerralaser.com';
	const customer = delivery.customers;

	const doc = new jsPDF();
	let y = 12;

	const logo = await loadLogoDataUrl(origin);
	if (logo) {
		doc.addImage(logo, 'PNG', 10, y, 50, 14);
		y += 20;
	}

	doc.setFontSize(16);
	doc.setFont('helvetica', 'bold');
	doc.setTextColor(RED[0], RED[1], RED[2]);
	doc.text('ACTA DE ENTREGA E INSTALACIÓN', 200, 18, { align: 'right' });

	doc.setFontSize(10);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(0, 0, 0);
	doc.text(`Folio: ${delivery.delivery_number}`, 200, 26, { align: 'right' });
	doc.text(
		`Fecha: ${new Date(delivery.delivery_date).toLocaleDateString('es-MX')}`,
		200,
		32,
		{ align: 'right' }
	);

	doc.setFontSize(8);
	doc.setTextColor(80, 80, 80);
	doc.text('Guerra Laser México', 200, 40, { align: 'right' });
	doc.text('Tel: 33 2015 2372 | Cel: 33 3475 8653', 200, 44, { align: 'right' });
	doc.text('contacto@guerralaser.com', 200, 48, { align: 'right' });

	y = Math.max(y, 55);
	doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
	doc.line(10, y, 200, y);
	y += 8;

	doc.setFontSize(11);
	doc.setFont('helvetica', 'bold');
	doc.setTextColor(0, 0, 0);
	doc.text('DATOS DEL CLIENTE', 10, y);
	y += 6;
	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	if (customer) {
		doc.text(`Nombre: ${customer.contact_name}`, 10, y);
		y += 5;
		doc.text(`Empresa: ${customer.company_name || '-'}`, 10, y);
		y += 5;
		doc.text(`Email: ${customer.email}`, 10, y);
		y += 5;
		doc.text(`Teléfono: ${customer.phone || customer.mobile || '-'}`, 10, y);
		y += 5;
	}
	const addrLines = doc.splitTextToSize(`Dirección de instalación: ${delivery.delivery_address}`, 180);
	doc.text(addrLines, 10, y);
	y += addrLines.length * 5 + 4;

	doc.setFont('helvetica', 'bold');
	doc.text('EQUIPO ENTREGADO', 10, y);
	y += 6;
	doc.setFont('helvetica', 'normal');
	const tipoEtiqueta =
		delivery.machinery_type && MACHINERY_TYPE_LABELS[delivery.machinery_type]
			? MACHINERY_TYPE_LABELS[delivery.machinery_type]
			: delivery.machinery_type || '-';
	doc.text(`Tipo de maquinaria: ${tipoEtiqueta}`, 10, y);
	y += 5;
	doc.text(`Modelo: ${delivery.machine_model}`, 10, y);
	y += 5;
	doc.text(`Número de serie: ${delivery.serial_number}`, 10, y);
	y += 8;

	if (accessories.length > 0) {
		doc.setFont('helvetica', 'bold');
		doc.text('ACCESORIOS INSTALADOS', 10, y);
		y += 6;
		doc.setFont('helvetica', 'normal');
		for (const acc of accessories) {
			const label = ACCESSORY_LABELS[acc.accessory_type] || acc.accessory_type;
			let line = `• ${label}`;
			if (acc.serial_number) line += ` (S/N: ${acc.serial_number})`;
			if (acc.description) line += ` — ${acc.description}`;
			const lines = doc.splitTextToSize(line, 180);
			doc.text(lines, 12, y);
			y += lines.length * 5;
			if (y > 250) {
				doc.addPage();
				y = 20;
			}
		}
		y += 4;
	}

	doc.setFont('helvetica', 'bold');
	doc.text('CHECKLIST DE ENTREGA', 10, y);
	y += 6;
	doc.setFont('helvetica', 'normal');
	doc.text(`Instalación realizada: ${yesNo(delivery.installation_completed)}`, 10, y);
	y += 5;
	doc.text(`Equipo operativo al entregar: ${yesNo(delivery.left_operational)}`, 10, y);
	y += 5;
	doc.text(`Capacitación proporcionada: ${yesNo(delivery.training_provided)}`, 10, y);
	y += 5;
	if (delivery.training_notes) {
		const tn = doc.splitTextToSize(`Notas de capacitación: ${delivery.training_notes}`, 180);
		doc.text(tn, 10, y);
		y += tn.length * 5;
	}
	y += 4;

	if (delivery.technician_observations) {
		doc.setFont('helvetica', 'bold');
		doc.text('OBSERVACIONES DEL TÉCNICO', 10, y);
		y += 5;
		doc.setFont('helvetica', 'normal');
		const obs = doc.splitTextToSize(delivery.technician_observations, 180);
		doc.text(obs, 10, y);
		y += obs.length * 5 + 4;
	}

	if (delivery.customer_observations) {
		doc.setFont('helvetica', 'bold');
		doc.text('OBSERVACIONES DEL CLIENTE', 10, y);
		y += 5;
		doc.setFont('helvetica', 'normal');
		const obs = doc.splitTextToSize(delivery.customer_observations, 180);
		doc.text(obs, 10, y);
		y += obs.length * 5 + 4;
	}

	if (photoDataUrls.length > 0 && y < 200) {
		doc.setFont('helvetica', 'bold');
		doc.text('EVIDENCIA FOTOGRÁFICA', 10, y);
		y += 6;
		let px = 10;
		for (const photo of photoDataUrls.slice(0, 4)) {
			try {
				doc.addImage(photo, 'JPEG', px, y, 42, 32);
				px += 48;
				if (px > 160) {
					px = 10;
					y += 36;
				}
			} catch {
				/* skip bad image */
			}
		}
		y += 40;
	}

	if (y > 220) {
		doc.addPage();
		y = 20;
	}

	doc.setFontSize(8);
	doc.setTextColor(60, 60, 60);
	const legal =
		'El cliente declara haber recibido el equipo descrito en las condiciones indicadas, haber verificado su funcionamiento según lo documentado y aceptar los términos de la presente acta de entrega e instalación.';
	const legalLines = doc.splitTextToSize(legal, 180);
	doc.text(legalLines, 10, y);
	y += legalLines.length * 4 + 8;

	if (customerSignatureDataUrl) {
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(0, 0, 0);
		doc.text('FIRMA DEL CLIENTE', 10, y);
		y += 4;
		try {
			doc.addImage(customerSignatureDataUrl, 'PNG', 10, y, 70, 28);
			y += 32;
		} catch {
			/* skip */
		}
	}

	doc.setFontSize(8);
	doc.text(
		`Documento generado el ${new Date().toLocaleString('es-MX')} — Guerra Laser`,
		10,
		285
	);

	return new Uint8Array(doc.output('arraybuffer'));
}

export function pdfToBase64(pdfBytes: Uint8Array): string {
	return Buffer.from(pdfBytes).toString('base64');
}
