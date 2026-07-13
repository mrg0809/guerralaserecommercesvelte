import type { jsPDF } from 'jspdf';
import type { QuotationTotalLine } from '$lib/utils/quotationTax';
import { QUOTATION_COMPANY } from '$lib/utils/quotationCompanyInfo';
import { getPdfLineHeightMm, wrapPdfText } from '$lib/utils/pdfEmojiText';

export const QUOTATION_PDF_MARGIN_TOP = 20;
export const QUOTATION_PDF_MARGIN_BOTTOM = 15;
/** Altura aproximada del bloque bancario + vigencia + agradecimiento */
export const QUOTATION_PDF_FOOTER_BLOCK_HEIGHT = 52;

export function getQuotationPdfPageHeight(doc: jsPDF): number {
	return doc.internal.pageSize.getHeight();
}

export function getQuotationPdfContentBottom(doc: jsPDF): number {
	return getQuotationPdfPageHeight(doc) - QUOTATION_PDF_MARGIN_BOTTOM;
}

export function ensureQuotationPdfVerticalSpace(
	doc: jsPDF,
	currentY: number,
	neededHeight: number,
	marginTop = QUOTATION_PDF_MARGIN_TOP
): number {
	if (currentY + neededHeight > getQuotationPdfContentBottom(doc)) {
		doc.addPage();
		return marginTop;
	}
	return currentY;
}

export function measureQuotationTotalsHeight(totalLines: QuotationTotalLine[]): number {
	let height = 9;
	for (const line of totalLines) {
		if (line.separatorBefore) height += 7;
		if (line.section) {
			height += 5;
			continue;
		}
		height += line.bold ? 8 : 5;
	}
	return height;
}

export async function estimateQuotationNotesHeight(
	doc: jsPDF,
	notes: string,
	maxWidthMm = 180
): Promise<number> {
	const trimmed = notes?.trim();
	if (!trimmed) return 0;
	doc.setFontSize(8);
	const lines = await wrapPdfText(doc, trimmed, maxWidthMm);
	const lineHeight = getPdfLineHeightMm(doc, 1.15);
	return 8 + lines.length * lineHeight + 2;
}

export function drawQuotationPdfFooter(
	doc: jsPDF,
	currentY: number,
	validityDays: number,
	redColor: readonly [number, number, number]
): number {
	currentY = ensureQuotationPdfVerticalSpace(doc, currentY, QUOTATION_PDF_FOOTER_BLOCK_HEIGHT);

	doc.setDrawColor(redColor[0], redColor[1], redColor[2]);
	doc.line(10, currentY, 200, currentY);
	currentY += 6;

	doc.setFontSize(9);
	doc.setFont('helvetica', 'bold');
	doc.setTextColor(0, 0, 0);
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
	doc.text(
		`Esta cotización tiene una vigencia de ${validityDays} días naturales a partir de la fecha de emisión.`,
		105,
		currentY,
		{ align: 'center' }
	);
	doc.text(QUOTATION_COMPANY.thanksLine, 105, currentY + 4, { align: 'center' });

	return currentY + 8;
}
