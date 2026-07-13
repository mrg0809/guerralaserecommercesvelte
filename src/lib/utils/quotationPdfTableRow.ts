import type { jsPDF } from 'jspdf';
import { QUOTATION_PDF_COL } from '$lib/utils/quotationPdfTableHeader';
import { drawPdfLineWithEmoji, drawPdfTextBlock, getPdfLineHeightMm, wrapPdfText } from '$lib/utils/pdfEmojiText';

const PAGE_BOTTOM = 270;
const PAGE_TOP = 20;
const ROW_GAP = 3;
const IMAGE_SIZE = 16;
const IMAGE_X = 11;
const SKU_X = 30;
const DESC_X = 48;
const DESC_WIDTH = 58;

export type QuotationPdfTableRowItem = {
	sku?: string;
	description: string;
	quantity: number;
	unitPriceDisplay: number;
	discount: number;
	lineTotalDisplay: number;
	imageUrl?: string;
	includeDetail?: boolean;
	detailDescription?: string;
};

export type DrawQuotationTableRowContext = {
	getCurrentY: () => number;
	setCurrentY: (y: number) => void;
	drawTableHeader: () => void;
	imageCache: Map<string, { dataUrl: string; format: 'PNG' | 'JPEG' }>;
};

function startNewTablePage(doc: jsPDF, drawTableHeader: () => void): number {
	doc.addPage();
	drawTableHeader();
	return PAGE_TOP;
}

export async function drawQuotationTableItemRow(
	doc: jsPDF,
	item: QuotationPdfTableRowItem,
	context: DrawQuotationTableRowContext
): Promise<void> {
	let currentY = context.getCurrentY();
	const lineHeight = getPdfLineHeightMm(doc, 1.12);

	doc.setFontSize(8);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(0, 0, 0);

	const descLines = await wrapPdfText(doc, item.description || '', DESC_WIDTH);
	const skuLines = doc.splitTextToSize(item.sku || '-', 16);

	if (currentY + lineHeight > PAGE_BOTTOM) {
		currentY = startNewTablePage(doc, context.drawTableHeader);
	}

	const rowTop = currentY;
	const textY = rowTop + 1;

	if (item.imageUrl) {
		const loadedImage = context.imageCache.get(item.imageUrl);
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

	doc.text(skuLines, SKU_X, textY);
	doc.text(String(item.quantity), QUOTATION_PDF_COL.cant, textY, { align: 'right' });
	doc.text(`$${item.unitPriceDisplay.toFixed(2)}`, QUOTATION_PDF_COL.price, textY, { align: 'right' });
	doc.text(`${item.discount.toFixed(1)}%`, QUOTATION_PDF_COL.discount, textY, { align: 'right' });
	doc.text(`$${item.lineTotalDisplay.toFixed(2)}`, QUOTATION_PDF_COL.total, textY, { align: 'right' });

	let y = textY;
	for (const line of descLines) {
		if (y + lineHeight > PAGE_BOTTOM) {
			y = startNewTablePage(doc, context.drawTableHeader) + 1;
		}
		await drawPdfLineWithEmoji(doc, line, DESC_X, y);
		y += lineHeight;
	}

	currentY = y + ROW_GAP;

	if (item.includeDetail && item.detailDescription?.trim()) {
		if (currentY + lineHeight > PAGE_BOTTOM) {
			currentY = startNewTablePage(doc, context.drawTableHeader);
		}
		currentY += 2;
		doc.setFontSize(7);
		doc.setTextColor(70, 70, 70);
		currentY = await drawPdfTextBlock(doc, item.detailDescription, 11, currentY, 188, {
			pageBottom: PAGE_BOTTOM,
			pageTop: PAGE_TOP,
			lineHeightMultiplier: 1.12,
			onNewPage: () => {
				context.drawTableHeader();
				doc.setFontSize(7);
				doc.setTextColor(70, 70, 70);
			}
		});
		currentY += 2;
		doc.setFontSize(8);
		doc.setTextColor(0, 0, 0);
	}

	if (currentY + ROW_GAP > PAGE_BOTTOM) {
		currentY = startNewTablePage(doc, context.drawTableHeader);
	}

	doc.setDrawColor(200, 210, 230);
	doc.setLineWidth(0.1);
	doc.line(10, currentY, 200, currentY);
	currentY += ROW_GAP;

	context.setCurrentY(currentY);
}
