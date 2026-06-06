export type ProductPresetId = 'tarjeta_metalica' | 'termo' | 'custom';

export interface ProductPreset {
	id: ProductPresetId;
	label: string;
	widthMm: number;
	heightMm: number;
}

export interface IconEntry {
	id: string;
	name: string;
	path: string;
}

export interface IconCategory {
	id: string;
	label: string;
	icons: IconEntry[];
}

export interface IconLibrary {
	categories: IconCategory[];
}

export interface ExportDxfPayload {
	svg: string;
	width_mm: number;
	height_mm: number;
	filename?: string;
}
