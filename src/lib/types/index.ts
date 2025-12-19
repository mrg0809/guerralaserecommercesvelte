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
	product: Product;
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
}

