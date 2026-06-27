import { jsPDF } from 'jspdf';
import type { QuoteDraft } from '$lib/types/assistant';
import { calculateQuoteTotals } from '$lib/server/ai/quotationService';
import { normalizeQuoteDraft, parsePrice } from '$lib/server/ai/quoteUtils';

async function loadLogoBase64(): Promise<string | null> {
	try {
		const fs = await import('fs');
		const path = await import('path');
		const logoPath = path.join(process.cwd(), 'static', 'logorectangular.png');
		if (fs.existsSync(logoPath)) {
			return `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
		}
		let baseUrl = 'https://guerralaser.com';
		if (process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
		const response = await fetch(`${baseUrl}/logorectangular.png`);
		if (response.ok) {
			const buf = Buffer.from(await response.arrayBuffer());
			return `data:image/png;base64,${buf.toString('base64')}`;
		}
	} catch {
		// sin logo
	}
	return null;
}

export async function createQuotationPdf(draft: QuoteDraft): Promise<jsPDF> {
	const quote = normalizeQuoteDraft(draft);
	const doc = new jsPDF();
	let currentY = 10;
	const redColor = [220, 38, 38];
	const blueColor = [37, 99, 235];
	const validity = quote.validity_days ?? 7;

	const logo = await loadLogoBase64();
	if (logo) {
		doc.addImage(logo, 'PNG', 10, currentY, 50, 0);
		currentY += 17;
	}

	doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(redColor[0], redColor[1], redColor[2]);
	doc.text('COTIZACIÓN', 200, 15, { align: 'right' });
	doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(0, 0, 0);
	doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 200, 22, { align: 'right' });
	doc.text(`Vigencia: ${validity} días`, 200, 27, { align: 'right' });
	doc.setFontSize(8).setTextColor(80, 80, 80);
	doc.text('Guerra Laser México', 200, 35, { align: 'right' });
	doc.text('Tel: 33 2015 2372', 200, 39, { align: 'right' });
	doc.text('Cel: 33 3475 8653 | 33 1864 0008', 200, 43, { align: 'right' });
	doc.text('contacto@guerralaser.com', 200, 47, { align: 'right' });
	doc.text('Av. Las Torres 5301, Col. Glorias del Colli', 200, 51, { align: 'right' });
	doc.text('Zapopan, Jalisco CP 45010', 200, 55, { align: 'right' });

	currentY = Math.max(currentY, 62);
	doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]).setLineWidth(0.5).line(10, currentY, 200, currentY);
	currentY += 6;
	doc.setFontSize(11).setFont('helvetica', 'bold').text('DATOS DEL CLIENTE', 10, currentY);
	doc.setFont('helvetica', 'normal').setFontSize(9);
	currentY += 6;
	doc.text(`Nombre: ${quote.client_name || '-'}`, 10, currentY);
	currentY += 12;
	doc.setDrawColor(redColor[0], redColor[1], redColor[2]).line(10, currentY, 200, currentY);
	currentY += 5;
	doc.setFillColor(240, 240, 240).rect(10, currentY - 4, 190, 6, 'F');
	doc.setFontSize(9).setFont('helvetica', 'bold');
	doc.text('SKU', 11, currentY);
	doc.text('Descripción', 32, currentY);
	doc.text('Cant.', 110, currentY, { align: 'right' });
	doc.text('Precio Unit.', 135, currentY, { align: 'right' });
	doc.text('Desc.%', 160, currentY, { align: 'right' });
	doc.text('Total', 195, currentY, { align: 'right' });
	currentY += 5;
	doc.setFont('helvetica', 'normal').setFontSize(8);

	for (const item of quote.lines) {
		const unitPrice = parsePrice(item.unit_price);
		const qty = parsePrice(item.quantity);
		const discount = parsePrice(item.discount_percent);
		const lineTotal = qty * unitPrice * (1 - discount / 100);
		const descLines = doc.splitTextToSize(item.description || '', 75);
		const rowHeight = descLines.length * 4;
		if (currentY + rowHeight > 270) {
			doc.addPage();
			currentY = 20;
		}
		doc.text(doc.splitTextToSize(item.sku || '-', 18), 11, currentY);
		doc.text(descLines, 32, currentY);
		doc.text(String(qty), 110, currentY, { align: 'right' });
		doc.text(`$${unitPrice.toFixed(2)}`, 135, currentY, { align: 'right' });
		doc.text(`${discount.toFixed(1)}%`, 160, currentY, { align: 'right' });
		doc.text(`$${lineTotal.toFixed(2)}`, 195, currentY, { align: 'right' });
		currentY += rowHeight + 2;
		doc.setDrawColor(200, 210, 230).setLineWidth(0.1).line(10, currentY, 200, currentY);
		currentY += 2;
	}

	const { subtotal, shipping, installation, total } = calculateQuoteTotals(quote);
	const grossSubtotal = quote.lines.reduce((s, l) => s + parsePrice(l.quantity) * parsePrice(l.unit_price), 0);
	const totalDiscount = grossSubtotal - subtotal;

	currentY += 3;
	doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]).setLineWidth(0.5).line(120, currentY, 200, currentY);
	currentY += 6;
	doc.setFontSize(9);
	doc.text('Subtotal:', 155, currentY, { align: 'right' });
	doc.text(`$${grossSubtotal.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
	currentY += 5;
	if (totalDiscount > 0) {
		doc.text('Descuento:', 155, currentY, { align: 'right' });
		doc.text(`-$${totalDiscount.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
		currentY += 5;
	}
	if (shipping > 0) {
		doc.text('Envío:', 155, currentY, { align: 'right' });
		doc.text(`$${shipping.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
		currentY += 5;
	}
	if (installation > 0) {
		doc.text('Instalación:', 155, currentY, { align: 'right' });
		doc.text(`$${installation.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
		currentY += 5;
	}
	doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(blueColor[0], blueColor[1], blueColor[2]);
	doc.text('Total:', 155, currentY, { align: 'right' });
	doc.text(`$${total.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
	currentY += 8;

	if (quote.notes) {
		doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(0, 0, 0).text('Notas:', 10, currentY);
		doc.setFontSize(8).text(doc.splitTextToSize(quote.notes, 180), 10, currentY + 4);
	}

	if (currentY < 240) currentY = 240;
	doc.setDrawColor(redColor[0], redColor[1], redColor[2]).line(10, currentY, 200, currentY);
	currentY += 6;
	doc.setFontSize(9).setFont('helvetica', 'bold').text('DATOS BANCARIOS PARA DEPÓSITO O TRANSFERENCIA', 105, currentY, {
		align: 'center'
	});
	currentY += 5;
	doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(60, 60, 60);
	doc.text('Banco: BBVA Bancomer', 105, currentY, { align: 'center' });
	currentY += 4;
	doc.text('Nombre: Luis Enrique Guerra Zavala', 105, currentY, { align: 'center' });
	currentY += 4;
	doc.text('Cuenta: 0101373439', 105, currentY, { align: 'center' });
	currentY += 4;
	doc.text('Cuenta interbancaria: 012320001013734399', 105, currentY, { align: 'center' });
	currentY += 4;
	doc.text('Número de tarjeta: 4152 3132 0228 1320', 105, currentY, { align: 'center' });
	currentY += 6;
	doc.setFontSize(7).setTextColor(100, 100, 100);
	doc.text(`Esta cotización tiene una vigencia de ${validity} días naturales.`, 105, currentY, {
		align: 'center'
	});
	doc.text('Gracias por su preferencia - Guerra Laser México', 105, currentY + 4, { align: 'center' });

	return doc;
}

export async function quotationPdfBase64(draft: QuoteDraft): Promise<{ base64: string; filename: string }> {
	const quote = normalizeQuoteDraft(draft);
	const doc = await createQuotationPdf(quote);
	const clientSlug = (quote.client_name || 'cliente').replace(/\s+/g, '-').slice(0, 30);
	const filename = `cotizacion-${clientSlug}-${Date.now()}.pdf`;
	return { base64: doc.output('datauristring'), filename };
}
