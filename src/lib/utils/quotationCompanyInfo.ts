import type { jsPDF } from 'jspdf';

export const QUOTATION_COMPANY = {
	headerName: 'Luis Enrique Guerra Zavala',
	name: 'Guerra Laser',
	rfc: 'GUZL6309303D7',
	phone: 'Tel: 33 2015 2372',
	mobile: 'Cel: 33 3475 8653 | 33 1864 0008',
	email: 'mundolasergdl@gmail.com',
	addressLine1: 'Av. Las Torres 5301, Col. Glorias del Colli',
	addressLine2: 'Zapopan, Jalisco CP 45010',
	thanksLine: 'Gracias por su preferencia - Guerra Laser'
} as const;

export function drawQuotationCompanyHeader(doc: jsPDF, validityDays: number): void {
	const today = new Date();
	doc.setFontSize(16);
	doc.setFont('helvetica', 'bold');
	doc.setTextColor(220, 38, 38);
	doc.text('COTIZACIÓN', 200, 15, { align: 'right' });

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(0, 0, 0);
	doc.text(`Fecha: ${today.toLocaleDateString('es-MX')}`, 200, 22, { align: 'right' });
	doc.text(`Vigencia: ${validityDays} días`, 200, 27, { align: 'right' });

	doc.setFontSize(8);
	doc.setTextColor(80, 80, 80);
	doc.text(QUOTATION_COMPANY.headerName, 200, 35, { align: 'right' });
	doc.text(`RFC: ${QUOTATION_COMPANY.rfc}`, 200, 39, { align: 'right' });
	doc.text(QUOTATION_COMPANY.phone, 200, 43, { align: 'right' });
	doc.text(QUOTATION_COMPANY.mobile, 200, 47, { align: 'right' });
	doc.text(QUOTATION_COMPANY.email, 200, 51, { align: 'right' });
	doc.text(QUOTATION_COMPANY.addressLine1, 200, 55, { align: 'right' });
	doc.text(QUOTATION_COMPANY.addressLine2, 200, 59, { align: 'right' });
}
