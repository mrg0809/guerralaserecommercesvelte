import type { jsPDF } from 'jspdf';
import type { QuotationTotalLine } from '$lib/utils/quotationTax';
import {
	ensureQuotationPdfVerticalSpace,
	QUOTATION_PDF_MARGIN_TOP
} from '$lib/utils/quotationPdfLayout';

type TotalsColors = {
	red: readonly [number, number, number];
	blue: readonly [number, number, number];
};

export function drawQuotationPdfTotals(
	doc: jsPDF,
	totalLines: QuotationTotalLine[],
	startY: number,
	colors: TotalsColors
): number {
	let currentY = startY + 3;
	const { red: redColor, blue: blueColor } = colors;
	const lineHeight = (bold: boolean) => (bold ? 8 : 5);

	currentY = ensureQuotationPdfVerticalSpace(doc, currentY, 12);
	doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
	doc.setLineWidth(0.5);
	doc.line(120, currentY, 200, currentY);
	currentY += 6;

	for (const line of totalLines) {
		if (line.separatorBefore) {
			currentY = ensureQuotationPdfVerticalSpace(doc, currentY, 7);
			currentY += 2;
			doc.setDrawColor(200, 210, 230);
			doc.setLineWidth(0.1);
			doc.line(120, currentY, 200, currentY);
			currentY += 5;
		}

		if (line.section) {
			currentY = ensureQuotationPdfVerticalSpace(doc, currentY, 5);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(8);
			doc.setTextColor(80, 80, 80);
			doc.text(line.label, 120, currentY);
			doc.setTextColor(0, 0, 0);
			currentY += 5;
			continue;
		}

		currentY = ensureQuotationPdfVerticalSpace(doc, currentY, lineHeight(!!line.bold));

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

		const pdfValue =
			line.value.startsWith('$') && !line.value.includes('MXN')
				? `${line.value} MXN`
				: line.value;

		doc.text(line.label, 155, currentY, { align: 'right' });
		doc.text(pdfValue, 195, currentY, { align: 'right' });
		currentY += lineHeight(!!line.bold);

		doc.setTextColor(0, 0, 0);
		doc.setFont('helvetica', 'normal');
	}

	return currentY;
}
