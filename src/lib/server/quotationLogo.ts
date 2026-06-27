import type { jsPDF } from 'jspdf';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const LOGO_WIDTH_MM = 50;
const LOGO_ASPECT_RATIO = 450 / 600; // logorectangular.png (600x450), igual que cotizaciones manuales

const LOGO_SOURCES = [
	() => readFileSync(fileURLToPath(new URL('./assets/logorectangular.png', import.meta.url))),
	() => readFileSync(fileURLToPath(new URL('../../../static/logorectangular.png', import.meta.url)))
];

function isValidPng(buffer: Buffer): boolean {
	return buffer.length > 24 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function bufferToDataUrl(buffer: Buffer): string {
	return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function fetchLogoFromSite(): Promise<Buffer | null> {
	const origins = [
		process.env.ORIGIN,
		process.env.PUBLIC_SITE_URL,
		'https://guerralaser.com'
	].filter(Boolean) as string[];

	for (const origin of origins) {
		try {
			const res = await fetch(`${origin.replace(/\/$/, '')}/logorectangular.png`, {
				headers: { Accept: 'image/png' }
			});
			if (!res.ok) continue;
			const contentType = res.headers.get('content-type') ?? '';
			if (!contentType.includes('image/png')) continue;
			const buffer = Buffer.from(await res.arrayBuffer());
			if (isValidPng(buffer)) return buffer;
		} catch {
			// siguiente origen
		}
	}
	return null;
}

function readBundledLogo(): Buffer | null {
	for (const read of LOGO_SOURCES) {
		try {
			const buffer = read();
			if (isValidPng(buffer)) return buffer;
		} catch {
			// siguiente ruta
		}
	}
	return null;
}

let cachedLogoDataUrl: string | null | undefined;

export async function getQuotationLogoDataUrl(): Promise<string | null> {
	if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;

	const bundled = readBundledLogo();
	if (bundled) {
		cachedLogoDataUrl = bufferToDataUrl(bundled);
		return cachedLogoDataUrl;
	}

	const remote = await fetchLogoFromSite();
	cachedLogoDataUrl = remote ? bufferToDataUrl(remote) : null;
	return cachedLogoDataUrl;
}

export async function addQuotationLogoToPdf(
	doc: jsPDF,
	x: number,
	y: number,
	widthMm = LOGO_WIDTH_MM
): Promise<number> {
	const dataUrl = await getQuotationLogoDataUrl();
	if (!dataUrl) return y;

	try {
		const props = doc.getImageProperties(dataUrl);
		const heightMm =
			props.width && props.height ? (widthMm * props.height) / props.width : widthMm * LOGO_ASPECT_RATIO;
		doc.addImage(dataUrl, 'PNG', x, y, widthMm, heightMm);
		return y + heightMm + 5;
	} catch {
		try {
			const heightMm = widthMm * LOGO_ASPECT_RATIO;
			doc.addImage(dataUrl, 'PNG', x, y, widthMm, heightMm);
			return y + heightMm + 5;
		} catch {
			return y;
		}
	}
}
