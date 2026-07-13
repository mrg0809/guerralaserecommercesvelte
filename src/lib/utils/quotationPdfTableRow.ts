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
const DETAIL_X = 30;
const DETAIL_WIDTH = 170;

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

/** Nueva página de tabla: resetea Y arriba y redibuja encabezados. */
function startNewTablePage(doc: jsPDF, context: DrawQuotationTableRowContext): number {
	doc.addPage();
	context.setCurrentY(QUOTATION_PDF_MARGIN_TOP);
	context.drawTableHeader();
	return context.getCurrentY();
}

function needsNewPage(y: number, needed: number, doc: jsPDF): boolean {
	return y + needed > pageBottom(doc);
}

function hasLoadedImage(
	item: QuotationPdfTableRowItem,
	cache: Map<string, { dataUrl: string; format: 'PNG' | 'JPEG' }>
): boolean {
	return Boolean(item.imageUrl && cache.get(item.imageUrl));
}

export async function drawQuotationTableItemRow(
	doc: jsPDF,
	item: QuotationPdfTableRowItem,
	context: DrawQuotationTableRowContext
): Promise<void> {
	const step = lineStep(doc);

	doc.setFontSize(8);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(0, 0, 0);

	const descLines = await wrapPdfText(doc, item.description || '', DESC_WIDTH);
	const skuLines = doc.splitTextToSize(item.sku || '-', 16);
	const skuHeight = skuLines.length * step;
	const hasImage = hasLoadedImage(item, context.imageCache);
	const rowMinHeight = Math.max(hasImage ? IMAGE_SIZE : 0, skuHeight, step);

	if (needsNewPage(context.getCurrentY(), rowMinHeight, doc)) {
		startNewTablePage(doc, context);
	}

	const rowTop = context.getCurrentY();
	const drawY = rowTop + 1;

	if (hasImage && item.imageUrl) {
		const loadedImage = context.imageCache.get(item.imageUrl)!;
		doc.addImage(
			loadedImage.dataUrl,
			loadedImage.format,
			IMAGE_X,
			rowTop,
			IMAGE_SIZE,
			IMAGE_SIZE
		);
	}

	doc.text(skuLines, SKU_X, drawY);
	doc.text(String(item.quantity), QUOTATION_PDF_COL.cant, drawY, { align: 'right' });
	doc.text(`$${item.unitPriceDisplay.toFixed(2)}`, QUOTATION_PDF_COL.price, drawY, { align: 'right' });
	doc.text(`${item.discount.toFixed(1)}%`, QUOTATION_PDF_COL.discount, drawY, { align: 'right' });
	doc.text(`$${item.lineTotalDisplay.toFixed(2)}`, QUOTATION_PDF_COL.total, drawY, { align: 'right' });

	let y = drawY;
	for (const line of descLines) {
		if (needsNewPage(y, step, doc)) {
			y = startNewTablePage(doc, context) + 1;
		}
		await drawPdfLineWithEmoji(doc, line, DESC_X, y);
		y += step;
	}

	const imageBottom = hasImage ? rowTop + IMAGE_SIZE : rowTop;
	let currentY = Math.max(y, imageBottom) + ROW_GAP;

	if (item.includeDetail && item.detailDescription?.trim()) {
		if (needsNewPage(currentY, step, doc)) {
			currentY = startNewTablePage(doc, context) + 1;
		} else {
			currentY += 2;
		}

		doc.setFontSize(7);
		doc.setTextColor(70, 70, 70);
		currentY = await drawPdfTextBlock(doc, item.detailDescription, DETAIL_X, currentY, DETAIL_WIDTH, {
			pageBottom: pageBottom(doc),
			pageTop: QUOTATION_PDF_MARGIN_TOP,
			lineHeightMultiplier: 1.2,
			onNewPage: () => {
				context.setCurrentY(QUOTATION_PDF_MARGIN_TOP);
				context.drawTableHeader();
				return context.getCurrentY() + 1;
			}
		});
		currentY += 2;
		doc.setFontSize(8);
		doc.setTextColor(0, 0, 0);
	}

	if (needsNewPage(currentY, ROW_GAP, doc)) {
		currentY = startNewTablePage(doc, context);
	}

	doc.setDrawColor(200, 210, 230);
	doc.setLineWidth(0.1);
	doc.line(10, currentY, 200, currentY);
	currentY += ROW_GAP;

	context.setCurrentY(currentY);
}
