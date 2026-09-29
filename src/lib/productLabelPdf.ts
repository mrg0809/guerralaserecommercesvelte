import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { formatPrice } from '$lib/utils';

/** Etiqueta grande: 60 × 40 mm. */
export const LARGE_LABEL_W_MM = 60;
export const LARGE_LABEL_H_MM = 40;

/** Etiqueta chica (Brother 29 × 90,3): 90,3 × 29 mm. */
export const SMALL_LABEL_W_MM = 90.3;
export const SMALL_LABEL_H_MM = 29;

export const PRODUCT_LABEL_W_MM = LARGE_LABEL_W_MM;
export const PRODUCT_LABEL_H_MM = LARGE_LABEL_H_MM;

export type ProductLabelFormat = 'large' | 'small';

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

export function expandLabelCopies(item: ProductLabelItem, quantity: number): ProductLabelItem[] {
	const n = Math.max(0, Math.floor(quantity));
	return Array.from({ length: n }, () => item);
}

type LogoImage = { dataUrl: string; format: 'PNG' | 'JPEG'; nw: number; nh: number };

function fitRectMm(naturalW: number, naturalH: number, maxW: number, maxH: number): { w: number; h: number } {
	if (naturalW <= 0 || naturalH <= 0) return { w: maxW, h: maxH };
	const ratio = naturalW / naturalH;
	let w = maxW;
	let h = w / ratio;
	if (h > maxH) {
		h = maxH;
		w = h * ratio;
	}
	return { w, h };
}

async function loadLogo(logoUrl = '/logorectangular.png'): Promise<LogoImage | null> {
	try {
		const res = await fetch(logoUrl);
		if (!res.ok) return null;
		const blob = await res.blob();
		const mime = blob.type || '';
		const format: 'PNG' | 'JPEG' = mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : 'PNG';
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(String(reader.result));
			reader.onerror = () => reject(new Error('read'));
			reader.readAsDataURL(blob);
		});
		const { nw, nh } = await new Promise<{ nw: number; nh: number }>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve({ nw: img.naturalWidth || img.width, nh: img.naturalHeight || img.height });
			img.onerror = () => reject(new Error('logo'));
			img.src = dataUrl;
		});
		return { dataUrl, format, nw, nh };
	} catch {
		return null;
	}
}

function drawLogo(
	doc: jsPDF,
	logo: LogoImage,
	x: number,
	y: number,
	maxW: number,
	maxH: number,
	align: 'left' | 'center' = 'left'
): void {
	const { w, h } = fitRectMm(logo.nw, logo.nh, maxW, maxH);
	const drawX = align === 'center' ? x + (maxW - w) / 2 : x;
	doc.addImage(logo.dataUrl, logo.format, drawX, y, w, h);
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

async function qrPngDataUrl(origin: string, sku: string): Promise<string> {
	return QRCode.toDataURL(productScanUrl(origin, sku), {
		margin: 1,
		width: 256,
		errorCorrectionLevel: 'M',
		color: { dark: '#000000', light: '#ffffff' }
	});
}

async function drawLargeLabel(
	doc: jsPDF,
	item: ProductLabelItem,
	origin: string,
	logo: LogoImage | null
): Promise<void> {
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const margin = 2;
	const contentW = pageW - margin * 2;

	const qrSize = 16.5;
	const qrX = pageW - margin - qrSize;
	const qrY = margin;
	const textW = Math.max(20, qrX - margin - 1.5);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7);
	let y = margin + 2.6;
	const nameLines = doc.splitTextToSize(item.name, textW).slice(0, 3);
	doc.text(nameLines, margin, y);
	y += nameLines.length * 2.7 + 1.1;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(6.5);
	const refLines = doc.splitTextToSize(`Ref: ${item.sku}`, textW);
	doc.text(refLines, margin, y);
	y += refLines.length * 2.4 + 1.1;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8);
	doc.text(formatPrice(item.price), margin, y);

	doc.addImage(await qrPngDataUrl(origin, item.sku), 'PNG', qrX, qrY, qrSize, qrSize);

	const barcodeH = 11;
	const barcodeY = pageH - margin - barcodeH;
	doc.addImage(barcodePngDataUrl(item.sku), 'PNG', margin, barcodeY, contentW, barcodeH);

	if (logo) {
		const gapTop = qrY + qrSize + 0.6;
		const maxH = Math.max(4, barcodeY - gapTop - 0.4);
		drawLogo(doc, logo, qrX, gapTop, qrSize, maxH, 'center');
	}
}

async function drawSmallLabel(
	doc: jsPDF,
	item: ProductLabelItem,
	origin: string,
	logo: LogoImage | null
): Promise<void> {
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const margin = 1.6;

	const qrSize = Math.min(22, pageH - margin * 2);
	const qrX = pageW - margin - qrSize;
	const qrY = (pageH - qrSize) / 2;
	const textW = Math.max(30, qrX - margin - 2);
	const textX = margin;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8);
	let y = margin + 3.2;
	const nameLines = doc.splitTextToSize(item.name, textW).slice(0, 2);
	doc.text(nameLines, textX, y);
	y += nameLines.length * 3.1 + 1.2;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7);
	const refLines = doc.splitTextToSize(`Ref: ${item.sku}`, textW);
	doc.text(refLines, textX, y);
	y += refLines.length * 2.6 + 1.4;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(10);
	const priceMaxY = pageH - margin - (logo ? 7.2 : 1.5);
	doc.text(formatPrice(item.price), textX, Math.min(y, priceMaxY));

	if (logo) {
		drawLogo(doc, logo, textX, pageH - margin - 6, 20, 6, 'left');
	}

	doc.addImage(await qrPngDataUrl(origin, item.sku), 'PNG', qrX, qrY, qrSize, qrSize);
}

function sizeForFormat(format: ProductLabelFormat): { w: number; h: number } {
	if (format === 'small') {
		return { w: SMALL_LABEL_W_MM, h: SMALL_LABEL_H_MM };
	}
	return { w: LARGE_LABEL_W_MM, h: LARGE_LABEL_H_MM };
}

function createLabelDocument(format: ProductLabelFormat): jsPDF {
	const { w, h } = sizeForFormat(format);
	return new jsPDF({
		unit: 'mm',
		format: [w, h],
		orientation: 'landscape',
		compress: true
	});
}

export async function openProductLabelsPdf(
	items: ProductLabelItem[],
	origin: string,
	format: ProductLabelFormat = 'large'
): Promise<void> {
	if (items.length === 0) {
		throw new Error('No hay etiquetas para imprimir: faltan SKU.');
	}

	const { w, h } = sizeForFormat(format);
	const doc = createLabelDocument(format);
	const logo = await loadLogo();
	const draw = format === 'small' ? drawSmallLabel : drawLargeLabel;

	for (let i = 0; i < items.length; i++) {
		if (i > 0) {
			doc.addPage([w, h], 'landscape');
		}
		await draw(doc, items[i], origin, logo);
	}

	const blob = doc.output('blob');
	const url = URL.createObjectURL(blob);
	const win = window.open(url, '_blank');
	if (!win) {
		const suffix = format === 'small' ? 'chica' : 'grande';
		doc.save(items.length === 1 ? `etiqueta-${suffix}-${items[0].sku}.pdf` : `etiquetas-${suffix}.pdf`);
	}
}
