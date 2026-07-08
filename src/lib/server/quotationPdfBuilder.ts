import { jsPDF } from 'jspdf';
import { addQuotationLogoToPdf } from '$lib/server/quotationLogo';
import { loadImageForPdf } from '$lib/utils/pdfImages';
import type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';
import { displayQuotationAmount, buildQuotationTotalLines, calculateQuotationSummary } from '$lib/utils/quotationTax';
import {
	drawQuotationTableHeader,
	QUOTATION_PDF_COL
} from '$lib/utils/quotationPdfTableHeader';

export interface QuotationPdfItem {
	sku?: string;
	description: string;
	quantity: number;
	price: number;
	discount?: number;
	imageUrl?: string;
	includeDetail?: boolean;
	detailDescription?: string;
}

export interface QuotationPdfOptions {
	customerName?: string;
	customerCompany?: string;
	customerRfc?: string;
	customerEmail?: string;
	customerPhone?: string;
	customerAddress?: string;
	paymentTerms?: string;
	validityDays?: number;
	notes?: string;
	shippingCost?: number;
	installationCost?: number;
	shippingMode?: QuotationExtraCostMode;
	installationMode?: QuotationExtraCostMode;
	generalDiscountPercent?: number;
	items: QuotationPdfItem[];
	fullCustomerBlock?: boolean;
	pricesExcludeIva?: boolean;
}

function lineTotal(item: QuotationPdfItem): number {
	const discount = item.discount ?? 0;
	return item.quantity * item.price * (1 - discount / 100);
}

function itemsSubtotal(items: QuotationPdfItem[]): number {
	return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export async function buildQuotationPdf(options: QuotationPdfOptions): Promise<jsPDF> {
	const {
		customerName = '-',
		customerCompany = '',
		customerRfc = '',
		customerEmail = '',
		customerPhone = '',
		customerAddress = '',
		paymentTerms = 'Contado',
		validityDays = 15,
		notes = '',
		shippingCost = 0,
		installationCost = 0,
		shippingMode,
		installationMode,
		generalDiscountPercent = 0,
		items,
		fullCustomerBlock = false,
		pricesExcludeIva = false
	} = options;

	const doc = new jsPDF();
	let currentY = 10;
	const redColor = [220, 38, 38] as const;
	const blueColor = [37, 99, 235] as const;

	currentY = await addQuotationLogoToPdf(doc, 10, currentY);

	doc.setFontSize(16);
	doc.setFont('helvetica', 'bold');
	doc.setTextColor(redColor[0], redColor[1], redColor[2]);
	doc.text('COTIZACIÓN', 200, 15, { align: 'right' });

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(0, 0, 0);
	doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 200, 22, { align: 'right' });
	doc.text(`Vigencia: ${validityDays} días`, 200, 27, { align: 'right' });

	doc.setFontSize(8);
	doc.setTextColor(80, 80, 80);
	doc.text('Guerra Laser México', 200, 35, { align: 'right' });
	doc.text('Tel: 33 2015 2372', 200, 39, { align: 'right' });
	doc.text('Cel: 33 3475 8653 | 33 1864 0008', 200, 43, { align: 'right' });
	doc.text('contacto@guerralaser.com', 200, 47, { align: 'right' });
	doc.text('Av. Las Torres 5301, Col. Glorias del Colli', 200, 51, { align: 'right' });
	doc.text('Zapopan, Jalisco CP 45010', 200, 55, { align: 'right' });

	currentY = Math.max(currentY, 62);
	doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
	doc.setLineWidth(0.5);
	doc.line(10, currentY, 200, currentY);
	currentY += 6;

	doc.setFontSize(11);
	doc.setFont('helvetica', 'bold');
	doc.setTextColor(0, 0, 0);
	doc.text('DATOS DEL CLIENTE', 10, currentY);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	currentY += 6;
	doc.text(`Nombre: ${customerName || '-'}`, 10, currentY);

	if (fullCustomerBlock) {
		currentY += 4;
		doc.text(`Empresa: ${customerCompany || '-'}`, 10, currentY);
		currentY += 4;
		doc.text(`RFC: ${customerRfc || '-'}`, 10, currentY);
		currentY += 4;
		doc.text(`Correo: ${customerEmail || '-'}`, 10, currentY);
		currentY += 4;
		doc.text(`Teléfono: ${customerPhone || '-'}`, 10, currentY);
		currentY += 4;
		const addressLines = doc.splitTextToSize(`Dirección: ${customerAddress || '-'}`, 90);
		doc.text(addressLines, 10, currentY);
		currentY += addressLines.length * 4 + 2;

		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.text('CONDICIONES COMERCIALES', 110, currentY - (addressLines.length * 4) - 2);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		doc.text(`Forma de pago: ${paymentTerms || 'Contado'}`, 110, currentY - (addressLines.length * 4) + 4);
		currentY += 4;
	} else {
		currentY += 12;
	}

	doc.setDrawColor(redColor[0], redColor[1], redColor[2]);
	doc.line(10, currentY, 200, currentY);
	currentY += 5;

	const IMAGE_SIZE = 16;
	const IMAGE_X = 11;
	const SKU_X = 30;
	const DESC_X = 48;
	const DESC_WIDTH = 58;
	const ROW_GAP = 3;

	function getLineHeightMm() {
		return (doc.getFontSize() * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
	}

	function drawTableHeader() {
		currentY = drawQuotationTableHeader(doc, currentY, pricesExcludeIva);
	}

	function drawItemDetailBlock(detailText: string) {
		const detailLineHeight = getLineHeightMm();
		const detailLines = doc.splitTextToSize(detailText.trim(), 188);

		currentY += 2;
		doc.setFontSize(7);
		doc.setTextColor(70, 70, 70);

		for (const line of detailLines) {
			if (currentY + detailLineHeight > 270) {
				doc.addPage();
				currentY = 20;
				doc.setFontSize(7);
				doc.setTextColor(70, 70, 70);
			}
			doc.text(line, 11, currentY);
			currentY += detailLineHeight;
		}

		currentY += 2;
		doc.setFontSize(8);
		doc.setTextColor(0, 0, 0);
	}

	drawTableHeader();

	const imageCache = new Map<string, { dataUrl: string; format: 'PNG' | 'JPEG' }>();
	await Promise.all(
		items
			.filter((item) => item.imageUrl)
			.map(async (item) => {
				if (!item.imageUrl || imageCache.has(item.imageUrl)) return;
				const loaded = await loadImageForPdf(item.imageUrl);
				if (loaded) imageCache.set(item.imageUrl, loaded);
			})
	);

	for (const item of items) {
		const total = lineTotal(item);
		const displayUnitPrice = displayQuotationAmount(item.price, pricesExcludeIva);
		const displayTotal = displayQuotationAmount(total, pricesExcludeIva);
		const lineHeight = getLineHeightMm();
		const skuLines = doc.splitTextToSize(item.sku || '-', 16);
		const descLines = doc.splitTextToSize(item.description || '', DESC_WIDTH);
		const textLineCount = Math.max(skuLines.length, descLines.length);
		const textBlockHeight = textLineCount * lineHeight;
		const hasImage = Boolean(item.imageUrl && imageCache.get(item.imageUrl));
		const imageBlockHeight = hasImage ? IMAGE_SIZE : 0;
		const contentHeight = Math.max(textBlockHeight, imageBlockHeight);
		const rowHeight = contentHeight + ROW_GAP;

		if (currentY + rowHeight + 2 > 270) {
			doc.addPage();
			currentY = 20;
			drawTableHeader();
		}

		const rowTop = currentY;

		if (hasImage && item.imageUrl) {
			const loadedImage = imageCache.get(item.imageUrl);
			if (loadedImage) {
				doc.addImage(
					loadedImage.dataUrl,
					loadedImage.format,
					IMAGE_X,
					rowTop,
					IMAGE_SIZE,
					IMAGE_SIZE
				);
			}
		}

		const textY = rowTop + 1;
		doc.text(skuLines, SKU_X, textY);
		doc.text(descLines, DESC_X, textY);
		doc.text(String(item.quantity), QUOTATION_PDF_COL.cant, textY, { align: 'right' });
		doc.text(`$${displayUnitPrice.toFixed(2)}`, QUOTATION_PDF_COL.price, textY, { align: 'right' });
		doc.text(`${(item.discount ?? 0).toFixed(1)}%`, QUOTATION_PDF_COL.discount, textY, { align: 'right' });
		doc.text(`$${displayTotal.toFixed(2)}`, QUOTATION_PDF_COL.total, textY, { align: 'right' });

		currentY = rowTop + rowHeight;

		if (item.includeDetail && item.detailDescription?.trim()) {
			drawItemDetailBlock(item.detailDescription);
		}

		doc.setDrawColor(200, 210, 230);
		doc.setLineWidth(0.1);
		doc.line(10, currentY, 200, currentY);
		currentY += ROW_GAP;
	}

	const subtotal = itemsSubtotal(items);
	const generalDiscountAmount =
		generalDiscountPercent > 0 ? (subtotal * generalDiscountPercent) / 100 : 0;
	const summary = calculateQuotationSummary({
		itemsSubtotalConIva: subtotal,
		generalDiscountAmount,
		shippingCost,
		installationCost,
		shippingMode,
		installationMode
	});
	const totalLines = buildQuotationTotalLines(pricesExcludeIva, summary, {
		generalDiscountPercent,
		generalDiscountAmount
	});

	currentY += 3;
	doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
	doc.setLineWidth(0.5);
	doc.line(120, currentY, 200, currentY);
	currentY += 6;

	for (const line of totalLines) {
		if (line.separatorBefore) {
			currentY += 2;
			doc.setDrawColor(200, 210, 230);
			doc.setLineWidth(0.1);
			doc.line(120, currentY, 200, currentY);
			currentY += 5;
		}

		if (line.red) {
			doc.setTextColor(redColor[0], redColor[1], redColor[2]);
		} else {
			doc.setTextColor(0, 0, 0);
		}

		if (line.bold) {
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
		} else {
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
		}

		const pdfValue = line.value.startsWith('$') && !line.value.includes('MXN')
			? `${line.value} MXN`
			: line.value;

		doc.text(line.label, 155, currentY, { align: 'right' });
		doc.text(pdfValue, 195, currentY, { align: 'right' });
		currentY += line.bold ? 8 : 5;

		doc.setTextColor(0, 0, 0);
		doc.setFont('helvetica', 'normal');
	}

	if (notes?.trim()) {
		doc.setFontSize(9);
		doc.setFont('helvetica', 'bold');
		doc.text('Notas:', 10, currentY);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		const splitNotes = doc.splitTextToSize(notes, 180);
		doc.text(splitNotes, 10, currentY + 4);
		currentY += splitNotes.length * 4 + 6;
	}

	if (currentY < 240) currentY = 240;
	doc.setDrawColor(redColor[0], redColor[1], redColor[2]);
	doc.line(10, currentY, 200, currentY);
	currentY += 6;

	doc.setFontSize(9);
	doc.setFont('helvetica', 'bold');
	doc.text('DATOS BANCARIOS PARA DEPÓSITO O TRANSFERENCIA', 105, currentY, { align: 'center' });
	currentY += 5;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(60, 60, 60);
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
	doc.setFontSize(7);
	doc.setTextColor(100, 100, 100);
	doc.text(`Esta cotización tiene una vigencia de ${validityDays} días naturales.`, 105, currentY, {
		align: 'center'
	});
	doc.text('Gracias por su preferencia - Guerra Laser México', 105, currentY + 4, { align: 'center' });

	return doc;
}
