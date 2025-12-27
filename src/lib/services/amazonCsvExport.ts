/**
 * Amazon CSV Export Utility
 * 
 * Generates CSV files compatible with Amazon Inventory Loader
 * Maps internal product data + JSONB dynamic attributes to flat CSV format
 */

import type { Product, AmazonListing } from '$lib/types/index';

export interface ProductWithAmazon extends Product {
	amazon_listing?: AmazonListing;
}

export interface AmazonCSVOptions {
	brandName?: string;
	attributeMappings?: Record<string, string>;
}

// Default configuration
export const DEFAULT_BRAND_NAME = 'Guerra Laser';

// Default attribute mappings
export const DEFAULT_ATTRIBUTE_MAPPINGS: Record<string, string> = {
	'watts': 'power_watts',
	'voltage': 'voltage_rating',
	'material': 'material_type',
	'peso': 'item_weight',
	'dimensiones': 'item_dimensions',
	'color': 'color_name',
	'garantia': 'warranty_description'
};

/**
 * Generates an Amazon-compatible CSV string from product data
 * 
 * @param products - Array of products with Amazon listing data
 * @param options - Optional configuration (brand name, attribute mappings)
 * @returns CSV string ready for download
 */
export function generateAmazonCSV(
	products: ProductWithAmazon[], 
	options: AmazonCSVOptions = {}
): string {
	if (!products || products.length === 0) {
		throw new Error('Cannot generate CSV: No products available for export. Please ensure products have Amazon listing data.');
	}

	const brandName = options.brandName || DEFAULT_BRAND_NAME;

	// Define base Amazon columns
	const baseColumns = [
		'sku',
		'product_name',
		'brand_name',
		'item_type',
		'external_product_id',
		'external_product_id_type',
		'standard_price',
		'quantity',
		'product_description',
		'bullet_point1',
		'bullet_point2',
		'bullet_point3',
		'bullet_point4',
		'bullet_point5'
	];

	// Collect all dynamic attribute keys from specific_attributes
	const dynamicKeys = new Set<string>();
	products.forEach(product => {
		if (product.amazon_listing?.specific_attributes) {
			Object.keys(product.amazon_listing.specific_attributes).forEach(key => {
				dynamicKeys.add(key);
			});
		}
	});

	// Combine base columns with dynamic columns
	const allColumns = [...baseColumns, ...Array.from(dynamicKeys).sort()];

	// Generate CSV rows
	const rows: (string | number)[][] = [];
	
	// Add header row
	rows.push(allColumns);

	// Add data rows
	products.forEach(product => {
		const row: (string | number)[] = [];
		
		allColumns.forEach(column => {
			if (column === 'sku') {
				row.push(escapeCsvValue(product.amazon_listing?.sku_amazon || product.sku || ''));
			} else if (column === 'product_name') {
				row.push(escapeCsvValue(product.name || ''));
			} else if (column === 'brand_name') {
				row.push(escapeCsvValue(brandName));
			} else if (column === 'item_type') {
				row.push(escapeCsvValue(product.amazon_listing?.feed_product_type || ''));
			} else if (column === 'external_product_id') {
				row.push(escapeCsvValue(product.amazon_listing?.asin || ''));
			} else if (column === 'external_product_id_type') {
				row.push(product.amazon_listing?.asin ? 'ASIN' : '');
			} else if (column === 'standard_price') {
				row.push(product.base_price || 0);
			} else if (column === 'quantity') {
				row.push(product.stock_quantity || 0);
			} else if (column === 'product_description') {
				row.push(escapeCsvValue(product.description || product.short_description || ''));
			} else if (column.startsWith('bullet_point')) {
				const index = parseInt(column.replace('bullet_point', '')) - 1;
				const bulletPoints = product.amazon_listing?.bullet_points;
				if (bulletPoints && Array.isArray(bulletPoints) && bulletPoints[index]) {
					row.push(escapeCsvValue(bulletPoints[index]));
				} else {
					row.push('');
				}
			} else {
				// Dynamic attribute from specific_attributes JSONB
				const value = product.amazon_listing?.specific_attributes?.[column];
				row.push(escapeCsvValue(value !== undefined ? String(value) : ''));
			}
		});

		rows.push(row);
	});

	// Convert rows to CSV string
	return rows.map(row => row.map(cell => String(cell)).join(',')).join('\n');
}

/**
 * Escapes a value for CSV format
 * Handles quotes, commas, and newlines
 */
function escapeCsvValue(value: string | number | boolean | null | undefined): string {
	if (value === null || value === undefined) {
		return '';
	}

	const stringValue = String(value);
	
	// If the value contains comma, quote, or newline, wrap in quotes and escape quotes
	if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
		return `"${stringValue.replace(/"/g, '""')}"`;
	}
	
	return stringValue;
}

/**
 * Maps JSONB dynamic attributes to Amazon column names
 * 
 * Common mappings for laser equipment:
 * - watts -> power_watts
 * - voltage -> voltage_rating
 * - material -> material_type
 * 
 * @param attributes - JSONB object with dynamic attributes
 * @param mappingRules - Optional custom mapping rules
 * @returns Flat object with Amazon column names
 */
export function mapAttributesToAmazonColumns(
	attributes: Record<string, any>,
	mappingRules?: Record<string, string>
): Record<string, any> {
	const mappings: Record<string, string> = {
		...DEFAULT_ATTRIBUTE_MAPPINGS,
		...mappingRules
	};

	const result: Record<string, any> = {};

	Object.entries(attributes).forEach(([key, value]) => {
		const amazonKey = mappings[key] || key;
		result[amazonKey] = value;
	});

	return result;
}

/**
 * Downloads the CSV file in the browser
 * 
 * @param csvContent - CSV string content
 * @param filename - Desired filename (default: amazon-inventory.csv)
 */
export function downloadCSV(csvContent: string, filename: string = 'amazon-inventory.csv'): void {
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	
	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', filename);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
}

/**
 * Generates and downloads Amazon CSV in one step
 * 
 * @param products - Array of products with Amazon listing data
 * @param filename - Optional custom filename
 * @param options - Optional configuration (brand name, attribute mappings)
 */
export function exportToAmazonCSV(
	products: ProductWithAmazon[], 
	filename?: string,
	options?: AmazonCSVOptions
): void {
	try {
		const csvContent = generateAmazonCSV(products, options);
		downloadCSV(csvContent, filename);
	} catch (error) {
		console.error('Error exporting to Amazon CSV:', error);
		throw error;
	}
}
