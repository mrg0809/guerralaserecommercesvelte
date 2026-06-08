export interface SvgValidationResult {
	ok: boolean;
	warnings: string[];
	error?: string;
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80) || 'icono';
}

/** Nombre legible a partir del nombre de archivo (sin extensión .svg). */
export function filenameToIconName(filename: string): string {
	const base = filename.replace(/\.svg$/i, '').trim();
	return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Icono';
}

export async function validateSvgFile(file: File): Promise<SvgValidationResult> {
	const warnings: string[] = [];
	const maxBytes = 500 * 1024;

	if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
		return { ok: false, warnings, error: 'El archivo debe ser SVG (.svg)' };
	}
	if (file.size > maxBytes) {
		return { ok: false, warnings, error: 'El SVG no debe superar 500 KB' };
	}

	const text = await file.text();
	const lower = text.toLowerCase();

	if (!lower.includes('<svg')) {
		return { ok: false, warnings, error: 'El archivo no parece un SVG válido' };
	}
	if (lower.includes('<script') || lower.includes('javascript:') || lower.includes('<iframe')) {
		return { ok: false, warnings, error: 'SVG no permitido: contiene scripts o contenido inseguro' };
	}
	if (lower.includes('<image') || lower.includes('xlink:href="data:image')) {
		warnings.push('Contiene imágenes raster embebidas; no son ideales para grabado láser.');
	}
	if (lower.includes('gradient') || lower.includes('radialgradient') || lower.includes('lineargradient')) {
		warnings.push('Contiene gradientes; conviene usar trazo negro simple para láser.');
	}
	if (lower.includes('filter')) {
		warnings.push('Contiene filtros SVG; simplifica el archivo en Inkscape.');
	}

	return { ok: true, warnings };
}
