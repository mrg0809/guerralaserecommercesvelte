# PIM System Integration Guide

## Overview

This guide explains how to integrate the new PIM (Product Information Management) system into your existing product management workflow.

## What's Included

The PIM system provides:

1. **Database Tables**: SAT, Amazon, Mercado Libre listings, and category mappings
2. **TypeScript Types**: Fully typed interfaces for all PIM data
3. **CSV Export**: Amazon Inventory Loader compatible CSV generation
4. **Sync Service**: Future-ready API integration skeleton
5. **UI Component**: Smart forms for managing multi-channel listings

## Quick Start

### 1. Create Database Tables in Supabase

Follow the instructions in `PIM_SETUP_INSTRUCTIONS_ES.md` to create the tables:

```bash
# In Supabase SQL Editor, run:
database/migrations/create_pim_tables.sql
```

### 2. Add PIM Component to Product Edit Modal

In your product management page (e.g., `src/routes/admin/productos/+page.svelte`), import and use the PIM component:

```svelte
<script lang="ts">
	import PIMTabs from '$lib/components/PIMTabs.svelte';
	
	// ... your existing code ...
	
	// Add a new tab option
	let activeTab = $state<'general' | 'variants' | 'specs' | 'pim'>('general');
</script>

<!-- In your modal -->
<div class="tabs mb-4">
	<button 
		class:active={activeTab === 'general'}
		onclick={() => activeTab = 'general'}
	>
		General
	</button>
	<button 
		class:active={activeTab === 'variants'}
		onclick={() => activeTab = 'variants'}
	>
		Variantes
	</button>
	<button 
		class:active={activeTab === 'specs'}
		onclick={() => activeTab = 'specs'}
	>
		Especificaciones
	</button>
	<button 
		class:active={activeTab === 'pim'}
		onclick={() => activeTab = 'pim'}
	>
		PIM (Amazon/ML/SAT)
	</button>
</div>

<!-- Tab content -->
{#if activeTab === 'pim'}
	<PIMTabs 
		productId={editingProduct.id} 
		onSave={loadProducts}
	/>
{/if}
```

### 3. Export Products to Amazon CSV

Create an export button in your product list:

```svelte
<script lang="ts">
	import { exportToAmazonCSV } from '$lib/services/amazonCsvExport';
	import type { ProductWithAmazon } from '$lib/services/amazonCsvExport';
	
	async function handleAmazonExport() {
		try {
			// Load products with Amazon listing data
			const { data, error } = await supabase
				.from('products')
				.select(`
					*,
					amazon_listing:amazon_listings(*)
				`)
				.eq('is_active', true);
			
			if (error) throw error;
			
			// Export to CSV
			exportToAmazonCSV(data as ProductWithAmazon[], 'amazon-inventory.csv');
		} catch (error) {
			console.error('Export error:', error);
			alert('Error al exportar productos');
		}
	}
</script>

<button onclick={handleAmazonExport}>
	📦 Exportar a Amazon CSV
</button>
```

## PIM Component Features

### SAT Tab

- **Clave Producto/Servicio**: 8-digit validation
- **Clave Unidad**: SAT unit code
- **Unidad de Medida**: Unit description
- **Material Peligroso**: Checkbox for hazardous materials

### Amazon Tab

- **Smart Category Selector**: Choose from predefined templates
- **SKU Amazon**: Amazon-specific SKU
- **ASIN**: Amazon Standard Identification Number
- **Feed Product Type**: Product category for Amazon feeds
- **Bullet Points**: Up to 5 product highlights
- **Dynamic Attributes**: Fields render based on selected category

### Mercado Libre Tab

- **Smart Category Selector**: Choose from predefined templates
- **ML ID**: Mercado Libre listing ID
- **Listing Type**: Gold Special, Gold Pro, Gold, Free
- **Dynamic Attributes**: Category-specific fields

### Category Template System

Users can create new category templates on-the-fly:

1. Click "+ Crear nueva plantilla de categoría"
2. Fill in:
   - Internal Type (e.g., "sensor", "laser")
   - Platform (Amazon, Mercado Libre, SAT)
   - External Category ID
   - Category Name
3. Template is saved and immediately available

## CSV Export Usage

### Basic Export

```typescript
import { generateAmazonCSV } from '$lib/services/amazonCsvExport';

const products = [
	{
		id: '123',
		name: 'Sensor Láser',
		sku: 'SEN-001',
		base_price: 1500,
		stock_quantity: 10,
		// ... other product fields
		amazon_listing: {
			sku_amazon: 'GLT-SEN-001',
			asin: 'B08XYZ1234',
			feed_product_type: 'Home',
			bullet_points: ['Alta precisión', 'Resistente al agua'],
			specific_attributes: {
				power_watts: '100',
				voltage: '220'
			}
		}
	}
];

const csv = generateAmazonCSV(products);
console.log(csv);
```

### Custom Attribute Mapping

```typescript
import { mapAttributesToAmazonColumns } from '$lib/services/amazonCsvExport';

const attributes = {
	watts: '100',
	voltage: '220',
	peso: '5.5'
};

const customMappings = {
	peso: 'item_weight_kg'
};

const mapped = mapAttributesToAmazonColumns(attributes, customMappings);
// Result: { power_watts: '100', voltage_rating: '220', item_weight_kg: '5.5' }
```

## API Sync Service (Future)

The sync service is ready for API integration:

```typescript
import { syncStockToAmazon, syncStockToML } from '$lib/services/syncService';

// When ready to implement:
async function updateInventory() {
	// Amazon sync
	const amazonResult = await syncStockToAmazon('GLT-SEN-001', 50);
	
	// ML sync
	const mlResult = await syncStockToML('SEN-001', 50);
}
```

## Category Mapping Schema

Category templates use JSONB schemas to define dynamic fields:

```json
{
	"fields": [
		{
			"name": "power_watts",
			"type": "number",
			"required": true,
			"label": "Potencia (Watts)"
		},
		{
			"name": "color",
			"type": "select",
			"required": false,
			"label": "Color",
			"options": ["Black", "Silver", "Red"]
		}
	]
}
```

### Supported Field Types

- **text**: Text input
- **number**: Numeric input
- **select**: Dropdown with options
- **boolean**: Checkbox

### Creating Category Templates via SQL

```sql
INSERT INTO category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'sensor',
	'amazon',
	'ce_automation_industrial_supplies',
	'Sensores Industriales',
	'{
		"fields": [
			{"name": "power_watts", "type": "number", "required": true, "label": "Potencia (Watts)"},
			{"name": "voltage", "type": "number", "required": true, "label": "Voltaje"},
			{"name": "material", "type": "text", "required": false, "label": "Material"}
		]
	}'::jsonb
);
```

## Complete Workflow Example

### 1. Create Category Templates

```sql
-- Amazon template for sensors
INSERT INTO category_mappings (internal_type, platform, external_category_id, required_schema)
VALUES (
	'sensor',
	'amazon',
	'ce_automation_industrial_supplies',
	'{"fields": [{"name": "power_watts", "type": "number", "required": true, "label": "Potencia"}]}'::jsonb
);

-- ML template for sensors
INSERT INTO category_mappings (internal_type, platform, external_category_id, required_schema)
VALUES (
	'sensor',
	'mercadolibre',
	'MLA1532',
	'{"fields": [{"name": "BRAND", "type": "text", "required": true, "label": "Marca"}]}'::jsonb
);
```

### 2. Edit Product with PIM Component

1. Navigate to Products admin page
2. Click "Edit" on a product
3. Go to "PIM (Amazon/ML/SAT)" tab
4. Fill in SAT information
5. Select Amazon category and fill dynamic fields
6. Select ML category and fill dynamic fields
7. Save each section

### 3. Export to CSV

1. Select products to export
2. Click "Exportar a Amazon CSV"
3. CSV file downloads automatically
4. Upload to Amazon Seller Central

## Troubleshooting

### Issue: PIM tab not showing

**Solution**: Make sure you've imported and added the component to your modal:

```svelte
import PIMTabs from '$lib/components/PIMTabs.svelte';
```

### Issue: Category templates not loading

**Solution**: Check that tables exist in Supabase:

```sql
SELECT * FROM category_mappings;
```

### Issue: CSV export fails

**Solution**: Ensure products have `amazon_listing` data joined:

```typescript
const { data } = await supabase
	.from('products')
	.select(`
		*,
		amazon_listing:amazon_listings(*)
	`);
```

### Issue: Dynamic fields not rendering

**Solution**: Check that the category mapping has a valid `required_schema`:

```sql
SELECT required_schema FROM category_mappings WHERE id = 'your-mapping-id';
```

## Best Practices

### 1. Create Standard Templates

Create templates for your most common product types:

- Sensors
- Lasers
- Motors
- Accessories

### 2. Use Consistent Naming

Use consistent `internal_type` values across platforms:

```sql
-- Good: Same internal_type across platforms
internal_type: 'sensor' → Amazon, ML, SAT

-- Bad: Different names for same product type
internal_type: 'sensor_amazon', 'sensor_ml'
```

### 3. Validate Data Before Export

```typescript
function validateProduct(product: ProductWithAmazon): boolean {
	if (!product.amazon_listing) return false;
	if (!product.amazon_listing.sku_amazon) return false;
	if (!product.amazon_listing.feed_product_type) return false;
	return true;
}

const validProducts = products.filter(validateProduct);
exportToAmazonCSV(validProducts);
```

### 4. Batch Operations

Export products in batches for large catalogs:

```typescript
const batchSize = 100;
for (let i = 0; i < products.length; i += batchSize) {
	const batch = products.slice(i, i + batchSize);
	exportToAmazonCSV(batch, `amazon-batch-${i / batchSize + 1}.csv`);
}
```

## Next Steps

1. ✅ Create database tables in Supabase
2. ✅ Add PIM component to product edit page
3. ✅ Create initial category templates
4. ✅ Test CSV export functionality
5. 🔄 When ready: Implement Amazon SP-API integration
6. 🔄 When ready: Implement Mercado Libre API integration

## Support

For questions or issues:

1. Check `PIM_SETUP_INSTRUCTIONS_ES.md` for setup help
2. Review SQL migration file: `database/migrations/create_pim_tables.sql`
3. Check TypeScript types: `src/lib/types/index.ts`
4. Review component code: `src/lib/components/PIMTabs.svelte`

## Additional Resources

- [Amazon Selling Partner API Documentation](https://developer-docs.amazon.com/sp-api/)
- [Mercado Libre API Documentation](https://developers.mercadolibre.com.mx/)
- [SAT Product/Service Catalog](http://omawww.sat.gob.mx/tramitesyservicios/Paginas/catalogos_emision_cfdi_2022.htm)

---

**Version**: 1.0.0  
**Last Updated**: December 2024
