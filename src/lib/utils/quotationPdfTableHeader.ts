import type { jsPDF } from 'jspdf';

export const QUOTATION_PDF_COL = {
	cant: 104,
	price: 133,
	discount: 158,
	total: 195
} as const;

export function quotationTableHeaderHeight(pricesExcludeIva: boolean): number {
	return pricesExcludeIva ? 10 : 6;
}

export function drawQuotationTableHeader(
	doc: jsPDF,
	y: number,
	pricesExcludeIva: boolean
): number {
	const headerH = quotationTableHeaderHeight(pricesExcludeIva);
	doc.setFillColor(240, 240, 240);
	doc.rect(10, y - 4, 190, headerH, 'F');
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(pricesExcludeIva ? 7.5 : 9);

	doc.text('Foto', 11, y);
	doc.text('SKU', 30, y);
	doc.text('Descripción', 48, y);
	doc.text('Cant.', QUOTATION_PDF_COL.cant, y, { align: 'right' });

	if (pricesExcludeIva) {
		const stackedY = y - 2;
		doc.text(['Precio Unit.', 's/IVA'], QUOTATION_PDF_COL.price, stackedY, { align: 'right' });
		doc.text('Desc.%', QUOTATION_PDF_COL.discount, y, { align: 'right' });
		doc.text(['Total', 's/IVA'], QUOTATION_PDF_COL.total, stackedY, { align: 'right' });
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		return y + 8;
	}

	doc.text('Precio Unit.', QUOTATION_PDF_COL.price, y, { align: 'right' });
	doc.text('Desc.%', QUOTATION_PDF_COL.discount, y, { align: 'right' });
	doc.text('Total', QUOTATION_PDF_COL.total, y, { align: 'right' });
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	return y + 5;
}
