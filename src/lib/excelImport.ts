import * as XLSX from 'xlsx';
import type { Database } from './types/database.types';

export interface ProductImportRow {
	nombre: string;
	slug?: string;
	descripcion_corta?: string;
	descripcion_larga?: string;
	precio_base: number;
	categoria_slug: string;
	sku?: string;
	stock?: number;
	especificaciones?: string; // JSON string o "key:value|key:value"
	etiquetas?: string; // comma separated
	descuento_porcentaje?: number;
	descuento_fecha_inicio?: string;
	descuento_fecha_fin?: string;
	activo?: boolean;
	destacado?: boolean;
	// Campos para variantes
	variante_nombre?: string; // Ej: "Rojo", "Talla M", "100W"
	variante_sku?: string; // SKU específico de la variante
	variante_precio?: number; // Precio diferencial (si es diferente al base)
	variante_stock?: number; // Stock específico de la variante
	producto_padre?: string; // SKU del producto padre (para agrupar variantes)
}

export interface ImportResult {
	success: boolean;
	total: number;
	imported: number;
	errors: Array<{ row: number; error: string; data?: any }>;
}

/**
 * Parse Excel file to product rows
 */
export async function parseExcelFile(file: File): Promise<ProductImportRow[]> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		
		reader.onload = (e) => {
			try {
				const data = new Uint8Array(e.target?.result as ArrayBuffer);
				const workbook = XLSX.read(data, { type: 'array' });
				
				// Get first sheet
				const sheetName = workbook.SheetNames[0];
				const worksheet = workbook.Sheets[sheetName];
				
				// Convert to JSON
				const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
				
				// Map to ProductImportRow
				const products: ProductImportRow[] = jsonData.map((row, index) => ({
					nombre: row['Nombre'] || row['nombre'] || '',
					slug: row['Slug'] || row['slug'] || generateSlug(row['Nombre'] || row['nombre'] || ''),
					descripcion_corta: row['Descripción Corta'] || row['descripcion_corta'] || '',
					descripcion_larga: row['Descripción Larga'] || row['descripcion_larga'] || '',
					precio_base: parseFloat(row['Precio'] || row['precio_base'] || row['precio'] || 0),
					categoria_slug: row['Categoría'] || row['categoria_slug'] || row['categoria'] || '',
					sku: row['SKU'] || row['sku'] || `AUTO-${Date.now()}-${index}`,
					stock: parseInt(row['Stock'] || row['stock'] || 0),
					especificaciones: row['Especificaciones'] || row['especificaciones'] || '',
					etiquetas: row['Etiquetas'] || row['etiquetas'] || '',
					descuento_porcentaje: parseFloat(row['Descuento %'] || row['descuento_porcentaje'] || 0),
					descuento_fecha_inicio: row['Descuento Inicio'] || row['descuento_fecha_inicio'] || '',
					descuento_fecha_fin: row['Descuento Fin'] || row['descuento_fecha_fin'] || '',
					activo: parseBool(row['Activo'] || row['activo'], true),
					destacado: parseBool(row['Destacado'] || row['destacado'], false),
					// Variantes
					producto_padre: row['Producto Padre'] || row['producto_padre'] || '',
					variante_nombre: row['Variante'] || row['variante_nombre'] || '',
					variante_sku: row['Variante SKU'] || row['variante_sku'] || '',
					variante_precio: row['Variante Precio'] ? parseFloat(row['Variante Precio']) : undefined,
					variante_stock: row['Variante Stock'] ? parseInt(row['Variante Stock']) : undefined
				}));
				
				resolve(products);
			} catch (error) {
				reject(error);
			}
		};
		
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(file);
	});
}

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Parse boolean values
 */
function parseBool(value: any, defaultValue: boolean = false): boolean {
	if (value === undefined || value === null || value === '') return defaultValue;
	if (typeof value === 'boolean') return value;
	const str = String(value).toLowerCase().trim();
	return ['true', '1', 'sí', 'si', 'yes', 'y', 's'].includes(str);
}

/**
 * Parse specifications string to key-value object
 * Accepts formats:
 * - JSON string: '{"key":"value"}'
 * - Pipe separated: 'key:value|key2:value2'
 */
export function parseSpecifications(specsString: string): Record<string, string> {
	if (!specsString || specsString.trim() === '') return {};
	
	try {
		// Try JSON first
		return JSON.parse(specsString);
	} catch {
		// Try pipe format
		const specs: Record<string, string> = {};
		const pairs = specsString.split('|');
		for (const pair of pairs) {
			const [key, ...valueParts] = pair.split(':');
			if (key && valueParts.length > 0) {
				specs[key.trim()] = valueParts.join(':').trim();
			}
		}
		return specs;
	}
}

/**
 * Parse tags string to array
 */
export function parseTags(tagsString: string): string[] {
	if (!tagsString || tagsString.trim() === '') return [];
	return tagsString.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

/**
 * Validate product row
 */
export function validateProductRow(row: ProductImportRow, rowIndex: number): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	
	// Si es una variante, tiene validaciones diferentes
	const isVariant = row.producto_padre && row.producto_padre.trim() !== '';
	
	if (isVariant) {
		// Validación para variantes
		if (!row.variante_nombre || row.variante_nombre.trim() === '') {
			errors.push('Variante requiere nombre');
		}
		if (!row.variante_sku || row.variante_sku.trim() === '') {
			errors.push('Variante requiere SKU');
		}
		if (!row.producto_padre || row.producto_padre.trim() === '') {
			errors.push('Variante requiere Producto Padre');
		}
	} else {
		// Validación para productos normales
		if (!row.nombre || row.nombre.trim() === '') {
			errors.push('Nombre es requerido');
		}
		
		if (!row.precio_base || row.precio_base <= 0) {
			errors.push('Precio debe ser mayor a 0');
		}
		
		if (!row.categoria_slug || row.categoria_slug.trim() === '') {
			errors.push('Categoría es requerida');
		}
	}
	
	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Download Excel template
 */
export function downloadTemplate() {
	const template = [
		// Producto simple sin variantes
		{
			'Nombre': 'Cortadora Láser CO2 100W',
			'Slug': 'cortadora-laser-co2-100w',
			'Descripción Corta': 'Cortadora láser de alta precisión',
			'Descripción Larga': 'Cortadora láser CO2 profesional ideal para trabajos de precisión',
			'Precio': 45000,
			'Categoría': 'laser-co2',
			'SKU': 'LASER-100W',
			'Stock': 5,
			'Especificaciones': 'Potencia:100W|Área de trabajo:1300x900mm|Velocidad:500mm/s',
			'Etiquetas': 'nuevo,profesional',
			'Descuento %': 10,
			'Descuento Inicio': '2025-01-01',
			'Descuento Fin': '2025-01-31',
			'Activo': 'Sí',
			'Destacado': 'Sí',
			'Producto Padre': '',
			'Variante': '',
			'Variante SKU': '',
			'Variante Precio': '',
			'Variante Stock': ''
		},
		// Producto con variantes - Producto padre
		{
			'Nombre': 'Cortadora Láser Fibra',
			'Slug': 'cortadora-laser-fibra',
			'Descripción Corta': 'Cortadora láser de fibra disponible en diferentes potencias',
			'Descripción Larga': 'Sistema de corte láser de fibra profesional con múltiples opciones de potencia',
			'Precio': 85000,
			'Categoría': 'laser-fibra',
			'SKU': 'FIBRA-BASE',
			'Stock': 0,
			'Especificaciones': 'Tipo:Fibra|Área de trabajo:1500x3000mm',
			'Etiquetas': 'profesional,industrial',
			'Descuento %': 0,
			'Descuento Inicio': '',
			'Descuento Fin': '',
			'Activo': 'Sí',
			'Destacado': 'No',
			'Producto Padre': '',
			'Variante': '',
			'Variante SKU': '',
			'Variante Precio': '',
			'Variante Stock': ''
		},
		// Variante 1 del producto anterior
		{
			'Nombre': 'Cortadora Láser Fibra',
			'Slug': '',
			'Descripción Corta': '',
			'Descripción Larga': '',
			'Precio': 0,
			'Categoría': '',
			'SKU': '',
			'Stock': 0,
			'Especificaciones': '',
			'Etiquetas': '',
			'Descuento %': 0,
			'Descuento Inicio': '',
			'Descuento Fin': '',
			'Activo': '',
			'Destacado': '',
			'Producto Padre': 'FIBRA-BASE',
			'Variante': '1000W',
			'Variante SKU': 'FIBRA-1000W',
			'Variante Precio': 85000,
			'Variante Stock': 3
		},
		// Variante 2
		{
			'Nombre': 'Cortadora Láser Fibra',
			'Slug': '',
			'Descripción Corta': '',
			'Descripción Larga': '',
			'Precio': 0,
			'Categoría': '',
			'SKU': '',
			'Stock': 0,
			'Especificaciones': '',
			'Etiquetas': '',
			'Descuento %': 0,
			'Descuento Inicio': '',
			'Descuento Fin': '',
			'Activo': '',
			'Destacado': '',
			'Producto Padre': 'FIBRA-BASE',
			'Variante': '1500W',
			'Variante SKU': 'FIBRA-1500W',
			'Variante Precio': 95000,
			'Variante Stock': 2
		},
		// Variante 3
		{
			'Nombre': 'Cortadora Láser Fibra',
			'Slug': '',
			'Descripción Corta': '',
			'Descripción Larga': '',
			'Precio': 0,
			'Categoría': '',
			'SKU': '',
			'Stock': 0,
			'Especificaciones': '',
			'Etiquetas': '',
			'Descuento %': 0,
			'Descuento Inicio': '',
			'Descuento Fin': '',
			'Activo': '',
			'Destacado': '',
			'Producto Padre': 'FIBRA-BASE',
			'Variante': '2000W',
			'Variante SKU': 'FIBRA-2000W',
			'Variante Precio': 110000,
			'Variante Stock': 1
		}
	];
	
	const ws = XLSX.utils.json_to_sheet(template);
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Productos');
	
	// Set column widths
	ws['!cols'] = [
		{ wch: 30 }, // Nombre
		{ wch: 30 }, // Slug
		{ wch: 40 }, // Descripción Corta
		{ wch: 60 }, // Descripción Larga
		{ wch: 10 }, // Precio
		{ wch: 20 }, // Categoría
		{ wch: 15 }, // SKU
		{ wch: 8 },  // Stock
		{ wch: 50 }, // Especificaciones
		{ wch: 20 }, // Etiquetas
		{ wch: 12 }, // Descuento %
		{ wch: 15 }, // Descuento Inicio
		{ wch: 15 }, // Descuento Fin
		{ wch: 8 },  // Activo
		{ wch: 10 }, // Destacado
		{ wch: 20 }, // Producto Padre
		{ wch: 20 }, // Variante
		{ wch: 20 }, // Variante SKU
		{ wch: 15 }, // Variante Precio
		{ wch: 12 }  // Variante Stock
	];
	
	XLSX.writeFile(wb, 'plantilla_productos.xlsx');
}
