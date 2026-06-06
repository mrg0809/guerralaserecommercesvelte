import {
	Canvas,
	FabricText,
	Group,
	Rect,
	loadSVGFromURL,
	util,
	type Canvas as FabricCanvas,
	type FabricObject
} from 'fabric';
import QRCode from 'qrcode';
import products from './products.json';

export const PX_PER_MM = products.pxPerMm;

type PlacementZone = 'grid' | 'topRight';

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

function computePlacement(
	canvas: FabricCanvas,
	itemWidth: number,
	itemHeight: number,
	zone: PlacementZone,
	index: number
): { left: number; top: number } {
	const pad = mmToPx(4);
	const cw = canvas.getWidth();
	const ch = canvas.getHeight();

	if (zone === 'topRight') {
		return {
			left: cw - pad - itemWidth / 2,
			top: pad + itemHeight / 2
		};
	}

	const cellW = itemWidth + pad;
	const cellH = itemHeight + pad;
	const cols = Math.max(1, Math.floor((cw - pad * 2) / cellW));
	const col = index % cols;
	const row = Math.floor(index / cols);

	let left = pad + col * cellW + itemWidth / 2;
	let top = pad + row * cellH + itemHeight / 2;

	if (top + itemHeight / 2 > ch - pad) {
		const angle = index * 0.85;
		const radius = mmToPx(8) + index * mmToPx(5);
		left = cw * 0.3 + Math.cos(angle) * radius;
		top = ch * 0.3 + Math.sin(angle) * radius;
	}

	return { left, top };
}

function placeObject(canvas: FabricCanvas, obj: FabricObject, zone: PlacementZone, index?: number): void {
	canvas.add(obj);
	obj.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
	obj.setCoords();
	const bounds = obj.getBoundingRect();
	const idx = index ?? canvas.getObjects().length - 1;
	const pos = computePlacement(canvas, bounds.width, bounds.height, zone, idx);
	obj.set({
		left: pos.left,
		top: pos.top,
		originX: 'center',
		originY: 'center'
	});
	obj.setCoords();
	canvas.setActiveObject(obj);
	canvas.requestRenderAll();
}

function removeExistingQr(canvas: FabricCanvas): void {
	for (const obj of canvas.getObjects()) {
		if ((obj as FabricObject & { isLaserQr?: boolean }).isLaserQr) {
			canvas.remove(obj);
		}
	}
}

export async function addIconFromLibrary(canvas: FabricCanvas, iconPath: string): Promise<void> {
	const { objects, options } = await loadSVGFromURL(iconPath);
	if (!objects.length) return;

	const group = util.groupSVGElements(objects, options);
	const maxDim = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.22;
	group.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
	group.setCoords();
	const bounds = group.getBoundingRect();
	const scale = maxDim / Math.max(bounds.width, bounds.height, 1);
	group.set({ scaleX: scale, scaleY: scale, strokeUniform: true });
	group.setCoords();

	const scaledBounds = group.getBoundingRect();
	const idx = canvas.getObjects().length;
	const pos = computePlacement(canvas, scaledBounds.width, scaledBounds.height, 'grid', idx);

	canvas.add(group);
	group.set({
		left: pos.left,
		top: pos.top,
		originX: 'center',
		originY: 'center'
	});
	group.setCoords();
	canvas.setActiveObject(group);
	canvas.requestRenderAll();
}

export function addTextToCanvas(
	canvas: FabricCanvas,
	text: string,
	fontFamily: string,
	fontSizePx = 24
): FabricText {
	const idx = canvas.getObjects().length;
	const obj = new FabricText(text, {
		fontFamily,
		fontSize: fontSizePx,
		fill: '#000000'
	});
	placeObject(canvas, obj, 'grid', idx);
	return obj;
}

function buildFilledQrGroup(content: string, sizePx: number): Group {
	const qr = QRCode.create(content, { errorCorrectionLevel: 'M' });
	const { modules } = qr;
	const count = modules.size;
	const marginModules = 1;
	const totalModules = count + marginModules * 2;
	const modulePx = sizePx / totalModules;

	const rects: Rect[] = [];
	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (modules.get(row, col)) {
				rects.push(
					new Rect({
						left: (col + marginModules) * modulePx,
						top: (row + marginModules) * modulePx,
						width: modulePx,
						height: modulePx,
						fill: '#000000',
						stroke: null,
						strokeWidth: 0
					})
				);
			}
		}
	}

	const group = new Group(rects, { subTargetCheck: false });
	(group as FabricObject & { isLaserQr?: boolean }).isLaserQr = true;
	return group;
}

export function addQrToCanvas(canvas: FabricCanvas, content: string, sizePx = 80): void {
	removeExistingQr(canvas);

	const group = buildFilledQrGroup(content, sizePx);
	group.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
	group.setCoords();

	const bounds = group.getBoundingRect();
	const pos = computePlacement(canvas, bounds.width, bounds.height, 'topRight', 0);
	canvas.add(group);
	group.set({
		left: pos.left,
		top: pos.top,
		originX: 'center',
		originY: 'center'
	});
	group.setCoords();
	canvas.setActiveObject(group);
	canvas.requestRenderAll();
}

export function exportNativeSvg(canvas: FabricCanvas, widthMm: number, heightMm: number): string {
	// Las imágenes raster no se convierten a trazos en DXF — excluir del export
	const rasterImages = canvas.getObjects().filter((o) => o.type === 'image');
	if (rasterImages.length > 0) {
		const hidden: FabricObject[] = [];
		for (const img of rasterImages) {
			img.visible = false;
			hidden.push(img);
		}
		const svg = canvas.toSVG({
			viewBox: { x: 0, y: 0, width: widthMm, height: heightMm },
			width: `${widthMm}mm`,
			height: `${heightMm}mm`,
			suppressPreamble: false
		});
		for (const img of hidden) {
			img.visible = true;
		}
		return svg;
	}

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
