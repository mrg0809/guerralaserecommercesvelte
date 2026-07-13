import type { jsPDF } from 'jspdf';
import { QUOTATION_PDF_COL } from '$lib/utils/quotationPdfTableHeader';
import {
	drawPdfLineWithEmoji,
	drawPdfTextBlock,
	getPdfLineHeightMm,
	wrapPdfText
} from '$lib/utils/pdfEmojiText';
import {
	getQuotationPdfContentBottom,
	QUOTATION_PDF_MARGIN_TOP
} from '$lib/utils/quotationPdfLayout';

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

function pageBottom(doc: jsPDF): number {
	return getQuotationPdfContentBottom(doc);
}

function lineStep(doc: jsPDF): number {
	return getPdfLineHeightMm(doc, 1.2);
}

function startNewTablePage(doc: jsPDF, drawTableHeader: () => void): number {
	doc.addPage();
	drawTableHeader();
	return QUOTATION_PDF_MARGIN_TOP;
}

function needsNewPage(y: number, needed: number, doc: jsPDF): boolean {
	return y + needed > pageBottom(doc);
}

export async function drawQuotationTableItemRow(
	doc: jsPDF,
	item: QuotationPdfTableRowItem,
	context: DrawQuotationTableRowContext
): Promise<void> {
	let currentY = context.getCurrentY();
	const step = lineStep(doc);

	doc.setFontSize(8);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(0, 0, 0);

	const descLines = await wrapPdfText(doc, item.description || '', DESC_WIDTH);
	const skuLines = doc.splitTextToSize(item.sku || '-', 16);
	const skuHeight = skuLines.length * step;
	const rowMinHeight = Math.max(item.imageUrl ? IMAGE_SIZE : 0, skuHeight, step);

	if (needsNewPage(currentY, rowMinHeight, doc)) {
		currentY = startNewTablePage(doc, context.drawTableHeader);
	}

	if (item.imageUrl) {
		const loadedImage = context.imageCache.get(item.imageUrl);
		if (loadedImage) {
			const imageY = context.getCurrentY();
			if (needsNewPage(imageY, IMAGE_SIZE, doc)) {
				context.setCurrentY(startNewTablePage(doc, context.drawTableHeader));
			}
			doc.addImage(
				loadedImage.dataUrl,
				loadedImage.format,
				IMAGE_X,
				context.getCurrentY(),
				IMAGE_SIZE,
				IMAGE_SIZE
			);
		}
	}

	const drawY = context.getCurrentY() + 1;
	doc.text(skuLines, SKU_X, drawY);
	doc.text(String(item.quantity), QUOTATION_PDF_COL.cant, drawY, { align: 'right' });
	doc.text(`$${item.unitPriceDisplay.toFixed(2)}`, QUOTATION_PDF_COL.price, drawY, { align: 'right' });
	doc.text(`${item.discount.toFixed(1)}%`, QUOTATION_PDF_COL.discount, drawY, { align: 'right' });
	doc.text(`$${item.lineTotalDisplay.toFixed(2)}`, QUOTATION_PDF_COL.total, drawY, { align: 'right' });

	let y = drawY;
	for (const line of descLines) {
		if (needsNewPage(y, step, doc)) {
			y = startNewTablePage(doc, context.drawTableHeader) + 1;
		}
		await drawPdfLineWithEmoji(doc, line, DESC_X, y);
		y += step;
	}

	currentY = y + ROW_GAP;

	if (item.includeDetail && item.detailDescription?.trim()) {
		if (needsNewPage(currentY, step, doc)) {
			currentY = startNewTablePage(doc, context.drawTableHeader);
		}
		currentY += 2;
		doc.setFontSize(7);
		doc.setTextColor(70, 70, 70);
		currentY = await drawPdfTextBlock(doc, item.detailDescription, 11, currentY, 188, {
			pageBottom: pageBottom(doc),
			pageTop: QUOTATION_PDF_MARGIN_TOP,
			lineHeightMultiplier: 1.2,
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

	if (needsNewPage(currentY, ROW_GAP, doc)) {
		currentY = startNewTablePage(doc, context.drawTableHeader);
	}

	doc.setDrawColor(200, 210, 230);
	doc.setLineWidth(0.1);
	doc.line(10, currentY, 200, currentY);
	currentY += ROW_GAP;

	context.setCurrentY(currentY);
}
