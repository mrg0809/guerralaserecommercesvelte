import { Canvas, FabricText, FabricImage, loadSVGFromURL, util, type Canvas as FabricCanvas } from 'fabric';
import QRCode from 'qrcode';
import products from './products.json';

export const PX_PER_MM = products.pxPerMm;

export function mmToPx(mm: number): number {
	return mm * PX_PER_MM;
}

export function createDesignCanvas(
	el: HTMLCanvasElement,
	widthMm: number,
	heightMm: number
): FabricCanvas {
	return new Canvas(el, {
		width: mmToPx(widthMm),
		height: mmToPx(heightMm),
		backgroundColor: '#ffffff',
		preserveObjectStacking: true
	});
}

export function resizeDesignCanvas(canvas: FabricCanvas, widthMm: number, heightMm: number): void {
	canvas.setDimensions({ width: mmToPx(widthMm), height: mmToPx(heightMm) });
	canvas.requestRenderAll();
}

export async function addIconFromLibrary(canvas: FabricCanvas, iconPath: string): Promise<void> {
	const { objects, options } = await loadSVGFromURL(iconPath);
	if (!objects.length) return;
	const group = util.groupSVGElements(objects, options);
	const maxDim = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.25;
	const bounds = group.getBoundingRect();
	const scale = maxDim / Math.max(bounds.width, bounds.height, 1);
	group.set({
		left: canvas.getWidth() / 2,
		top: canvas.getHeight() / 2,
		scaleX: scale,
		scaleY: scale,
		originX: 'center',
		originY: 'center',
		strokeUniform: true
	});
	canvas.add(group);
	canvas.setActiveObject(group);
	canvas.requestRenderAll();
}

export function addTextToCanvas(
	canvas: FabricCanvas,
	text: string,
	fontFamily: string,
	fontSizePx = 24
): FabricText {
	const obj = new FabricText(text, {
		left: canvas.getWidth() / 2,
		top: canvas.getHeight() / 2,
		fontFamily,
		fontSize: fontSizePx,
		fill: '#000000',
		originX: 'center',
		originY: 'center'
	});
	canvas.add(obj);
	canvas.setActiveObject(obj);
	canvas.requestRenderAll();
	return obj;
}

export async function addQrToCanvas(canvas: FabricCanvas, content: string, sizePx = 80): Promise<void> {
	const dataUrl = await QRCode.toDataURL(content, {
		margin: 1,
		width: sizePx,
		color: { dark: '#000000', light: '#ffffff' }
	});
	const img = await FabricImage.fromURL(dataUrl);
	const scale = sizePx / Math.max(img.width ?? sizePx, 1);
	img.set({
		left: canvas.getWidth() - sizePx - 10,
		top: 10,
		scaleX: scale,
		scaleY: scale
	});
	canvas.add(img);
	canvas.setActiveObject(img);
	canvas.requestRenderAll();
}

export function exportNativeSvg(canvas: FabricCanvas, widthMm: number, heightMm: number): string {
	return canvas.toSVG({
		viewBox: { x: 0, y: 0, width: widthMm, height: heightMm },
		width: `${widthMm}mm`,
		height: `${heightMm}mm`,
		suppressPreamble: false
	});
}

export async function downloadDxf(
	svg: string,
	widthMm: number,
	heightMm: number,
	accessToken: string,
	filename = 'diseno_guerra_laser.dxf'
): Promise<void> {
	const res = await fetch('/api/design-builder/export-dxf', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`
		},
		body: JSON.stringify({
			svg,
			width_mm: widthMm,
			height_mm: heightMm,
			filename
		})
	});

	if (!res.ok) {
		let msg = `Error ${res.status}`;
		try {
			const err = (await res.json()) as { error?: string; detail?: string };
			msg = err.error ?? err.detail ?? msg;
		} catch {
			msg = (await res.text()).slice(0, 200) || msg;
		}
		throw new Error(msg);
	}

	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
