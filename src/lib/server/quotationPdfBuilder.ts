import { jsPDF } from 'jspdf';
import { addQuotationLogoToPdf } from '$lib/server/quotationLogo';
import { loadImageForPdf } from '$lib/utils/pdfImages';
import type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';
import { displayQuotationAmount, buildQuotationTotalLines, calculateQuotationSummary } from '$lib/utils/quotationTax';
import { drawQuotationTableHeader } from '$lib/utils/quotationPdfTableHeader';
import { drawQuotationCompanyHeader } from '$lib/utils/quotationCompanyInfo';
import { drawPdfTextBlock } from '$lib/utils/pdfEmojiText';
import {
	drawQuotationPdfFooter,
	ensureQuotationPdfVerticalSpace,
	estimateQuotationNotesHeight,
	measureQuotationTotalsHeight,
	QUOTATION_PDF_FOOTER_BLOCK_HEIGHT,
	QUOTATION_PDF_MARGIN_TOP
} from '$lib/utils/quotationPdfLayout';
import { drawQuotationPdfTotals } from '$lib/utils/quotationPdfTotals';
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

	const totalsHeight = measureQuotationTotalsHeight(totalLines);
	const notesHeight = notes?.trim() ? await estimateQuotationNotesHeight(doc, notes) : 0;
	const postTableHeight = totalsHeight + notesHeight + QUOTATION_PDF_FOOTER_BLOCK_HEIGHT + 8;
	currentY = ensureQuotationPdfVerticalSpace(doc, currentY, postTableHeight, QUOTATION_PDF_MARGIN_TOP);

	currentY = drawQuotationPdfTotals(doc, totalLines, currentY, {
		red: redColor,
		blue: blueColor
	});

	if (notes?.trim()) {
		currentY = ensureQuotationPdfVerticalSpace(
			doc,
			currentY,
			notesHeight + QUOTATION_PDF_FOOTER_BLOCK_HEIGHT + 4,
			QUOTATION_PDF_MARGIN_TOP
		);
		doc.setFontSize(9);
		doc.setFont('helvetica', 'bold');
		doc.text('Notas:', 10, currentY);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		currentY = await drawPdfTextBlock(doc, notes, 10, currentY + 4, 180, {
			pageTop: QUOTATION_PDF_MARGIN_TOP,
			lineHeightMultiplier: 1.15,
			reservedBottomMm: QUOTATION_PDF_FOOTER_BLOCK_HEIGHT + 8
		});
		currentY += 2;
	}

	drawQuotationPdfFooter(doc, currentY, validityDays, redColor);

	return doc;
}
