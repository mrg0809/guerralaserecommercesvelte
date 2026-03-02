import type { Database } from './database.types';

export type Category = Database['public']['Tables']['categories']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type ProductVariant = Database['public']['Tables']['product_variants']['Row'];
export type ProductMedia = Database['public']['Tables']['product_media']['Row'];
export type ProductSpecification = Database['public']['Tables']['product_specifications']['Row'];
export type Discount = Database['public']['Tables']['discounts']['Row'];
export type Tag = Database['public']['Tables']['tags']['Row'];
export type ProductTag = Database['public']['Tables']['product_tags']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type ProductBundle = Database['public']['Tables']['product_bundles']['Row'];
export type BundleItem = Database['public']['Tables']['bundle_items']['Row'];

// PIM (Product Information Management) Types
export type SATProductInfo = Database['public']['Tables']['sat_product_info']['Row'];
export type AmazonListing = Database['public']['Tables']['amazon_listings']['Row'];
export type MercadoLibreListing = Database['public']['Tables']['mercadolibre_listings']['Row'];
export type CategoryMapping = Database['public']['Tables']['category_mappings']['Row'];

// Tipo para videos testimoniales
export interface TestimonialVideo {
	id: string;
	title: string;
	description: string | null;
	video_url: string;
	video_type: 'youtube' | 'tiktok';
	thumbnail_url: string | null;
	display_order: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CartItem {
	product: Product & { shipping_types?: { name: string } | null };
	shipping_type_name?: string;
	variant?: ProductVariant;
	bundle?: ProductBundle;
	quantity: number;
	media?: ProductMedia[];
}

export interface BundleWithItems extends ProductBundle {
	items?: Array<BundleItem & {
		product?: Product;
		variant?: ProductVariant;
	}>;
	totalValue?: number;
	savings?: number;
}

export interface ProductWithDetails extends Product {
	category?: Category;
	variants?: ProductVariant[];
	bundles?: BundleWithItems[];
	media?: ProductMedia[];
	specifications?: ProductSpecification[];
	discounts?: Discount[];
	tags?: Tag[];
	// PIM data
	sat_info?: SATProductInfo;
	amazon_listing?: AmazonListing;
	mercadolibre_listing?: MercadoLibreListing;
}

// PIM-specific types for CSV generation and data management

export interface AmazonCSVField {
	name: string;
	type: 'text' | 'number' | 'select' | 'boolean';
	required: boolean;
	label: string;
	options?: string[];
}

export interface AmazonCSVMapping {
	product_id: string;
	sku: string;
	product_name: string;
	brand_name: string;
	item_type: string;
	external_product_id?: string;
	external_product_id_type?: string;
	[key: string]: string | number | boolean | undefined;
}

export interface CategoryMappingSchema {
	fields: Array<{
		name: string;
		type: 'text' | 'number' | 'select' | 'boolean';
		required: boolean;
		label: string;
		options?: string[];
	}>;
}

// API sync types for future implementation
export interface SyncPayload {
	sku: string;
	quantity: number;
	price?: number;
	updated_at?: string;
}

export interface AmazonSyncPayload extends SyncPayload {
	asin?: string;
	feed_product_type?: string;
}

export interface MercadoLibreSyncPayload extends SyncPayload {
	ml_id?: string;
	listing_type?: string;
}

