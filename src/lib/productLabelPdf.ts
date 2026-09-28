import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { formatPrice } from '$lib/utils';

/** Etiqueta térmica horizontal 60 × 40 mm (ancho × alto). */
export const PRODUCT_LABEL_W_MM = 60;
export const PRODUCT_LABEL_H_MM = 40;
const MARGIN = 2;

export type ProductLabelItem = {
	name: string;
	sku: string;
	price: number;
};

export function productScanUrl(origin: string, sku: string): string {
	const base = origin.replace(/\/$/, '');
	return `${base}/escanear/${encodeURIComponent(sku)}`;
}

export function collectProductLabelItems(
	product: { name: string; sku?: string | null; base_price?: number | null },
	variants: Array<{ name?: string | null; sku?: string | null; price?: number | null }> | null | undefined
): { items: ProductLabelItem[]; skippedWithoutSku: number } {
	const vars = variants ?? [];
	const productPrice = Number(product.base_price ?? 0);
	if (vars.length > 0) {
		const items: ProductLabelItem[] = [];
		let skippedWithoutSku = 0;
		for (const variant of vars) {
			const sku = variant.sku?.trim();
			if (!sku) {
				skippedWithoutSku += 1;
				continue;
			}
			const variantName = variant.name?.trim();
			items.push({
				name: variantName ? `${product.name} — ${variantName}` : product.name,
				sku,
				price: Number(variant.price ?? productPrice)
			});
		}
		return { items, skippedWithoutSku };
	}

	const sku = product.sku?.trim();
	if (!sku) return { items: [], skippedWithoutSku: 1 };
	return { items: [{ name: product.name, sku, price: productPrice }], skippedWithoutSku: 0 };
}

function barcodePngDataUrl(sku: string): string {
	const canvas = document.createElement('canvas');
	JsBarcode(canvas, sku, {
		format: 'CODE128',
		displayValue: false,
		margin: 4,
		height: 48,
		width: 1,
		background: '#ffffff',
		lineColor: '#000000'
	});
	return canvas.toDataURL('image/png');
}

async function drawLabel(doc: jsPDF, item: ProductLabelItem, origin: string): Promise<void> {
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const contentW = pageW - MARGIN * 2;

	const qrSize = 16.5;
	const qrX = pageW - MARGIN - qrSize;
	const qrY = MARGIN;
	const textW = Math.max(20, qrX - MARGIN - 1.5);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7);
	let y = MARGIN + 2.6;
	const nameLines = doc.splitTextToSize(item.name, textW).slice(0, 3);
	doc.text(nameLines, MARGIN, y);
	y += nameLines.length * 2.7 + 1.1;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(6.5);
	const refLines = doc.splitTextToSize(`Ref: ${item.sku}`, textW);
	doc.text(refLines, MARGIN, y);
	y += refLines.length * 2.4 + 1.1;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8);
	doc.text(formatPrice(item.price), MARGIN, y);

	const qrDataUrl = await QRCode.toDataURL(productScanUrl(origin, item.sku), {
		margin: 1,
		width: 256,
		errorCorrectionLevel: 'M',
		color: { dark: '#000000', light: '#ffffff' }
	});
	doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

	const barcodeH = 11;
	const barcodeY = pageH - MARGIN - barcodeH;
	const barcodeDataUrl = barcodePngDataUrl(item.sku);
	doc.addImage(barcodeDataUrl, 'PNG', MARGIN, barcodeY, contentW, barcodeH);
}

function createLabelDocument(): jsPDF {
	return new jsPDF({
		unit: 'mm',
		format: [PRODUCT_LABEL_W_MM, PRODUCT_LABEL_H_MM],
		orientation: 'landscape',
		compress: true
	});
}

export async function openProductLabelsPdf(items: ProductLabelItem[], origin: string): Promise<void> {
	if (items.length === 0) {
		throw new Error('No hay etiquetas para imprimir: faltan SKU.');
	}

	const doc = createLabelDocument();

	for (let i = 0; i < items.length; i++) {
		if (i > 0) {
			doc.addPage([PRODUCT_LABEL_W_MM, PRODUCT_LABEL_H_MM], 'landscape');
		}
		await drawLabel(doc, items[i], origin);
	}

	const blob = doc.output('blob');
	const url = URL.createObjectURL(blob);
	const win = window.open(url, '_blank');
	if (!win) {
		doc.save(items.length === 1 ? `etiqueta-${items[0].sku}.pdf` : 'etiquetas-productos.pdf');
	}
}
