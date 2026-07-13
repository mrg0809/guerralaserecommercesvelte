import { jsPDF } from 'jspdf';
import { addQuotationLogoToPdf } from '$lib/server/quotationLogo';
import { loadImageForPdf } from '$lib/utils/pdfImages';
import type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';
import { displayQuotationAmount, buildQuotationTotalLines, calculateQuotationSummary } from '$lib/utils/quotationTax';
import { drawQuotationTableHeader } from '$lib/utils/quotationPdfTableHeader';
import { QUOTATION_COMPANY, drawQuotationCompanyHeader } from '$lib/utils/quotationCompanyInfo';
import { drawPdfTextBlock } from '$lib/utils/pdfEmojiText';
import { drawQuotationTableItemRow } from '$lib/utils/quotationPdfTableRow';

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
	drawQuotationCompanyHeader(doc, validityDays);

	currentY = Math.max(currentY, 66);
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

	function drawTableHeader() {
		currentY = drawQuotationTableHeader(doc, currentY, pricesExcludeIva);
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

	const rowContext = {
		getCurrentY: () => currentY,
		setCurrentY: (y: number) => {
			currentY = y;
		},
		drawTableHeader,
		imageCache
	};

	for (const item of items) {
		const total = lineTotal(item);
		await drawQuotationTableItemRow(
			doc,
			{
				sku: item.sku,
				description: item.description,
				quantity: item.quantity,
				unitPriceDisplay: displayQuotationAmount(item.price, pricesExcludeIva),
				discount: item.discount ?? 0,
				lineTotalDisplay: displayQuotationAmount(total, pricesExcludeIva),
				imageUrl: item.imageUrl,
				includeDetail: item.includeDetail,
				detailDescription: item.detailDescription
			},
			rowContext
		);
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

		if (line.section) {
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(8);
			doc.setTextColor(80, 80, 80);
			doc.text(line.label, 120, currentY);
			doc.setTextColor(0, 0, 0);
			currentY += 5;
			continue;
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
		currentY = await drawPdfTextBlock(doc, notes, 10, currentY + 4, 180, {
			pageBottom: 270,
			pageTop: 20,
			lineHeightMultiplier: 1.12
		});
		currentY += 2;
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
	doc.text(QUOTATION_COMPANY.thanksLine, 105, currentY + 4, { align: 'center' });

	return doc;
}
