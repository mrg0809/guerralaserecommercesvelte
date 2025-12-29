export type Database = {
	public: {
		Tables: {
			categories: {
				Row: {
					id: string;
					name: string;
					slug: string;
					description: string | null;
					parent_id: string | null;
					image_url: string | null;
					display_order: number;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					slug: string;
					description?: string | null;
					parent_id?: string | null;
					image_url?: string | null;
					display_order?: number;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					slug?: string;
					description?: string | null;
					parent_id?: string | null;
					image_url?: string | null;
					display_order?: number;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			products: {
				Row: {
					id: string;
					name: string;
					slug: string;
					description: string | null;
					short_description: string | null;
					base_price: number;
					category_id: string | null;
					is_active: boolean;
					is_featured: boolean;
					stock_quantity: number;
					sku: string | null;
					meta_title: string | null;
					meta_description: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					slug: string;
					description?: string | null;
					short_description?: string | null;
					base_price: number;
					category_id?: string | null;
					is_active?: boolean;
					is_featured?: boolean;
					stock_quantity?: number;
					sku?: string | null;
					meta_title?: string | null;
					meta_description?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					slug?: string;
					description?: string | null;
					short_description?: string | null;
					base_price?: number;
					category_id?: string | null;
					is_active?: boolean;
					is_featured?: boolean;
					stock_quantity?: number;
					sku?: string | null;
					meta_title?: string | null;
					meta_description?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			product_variants: {
				Row: {
					id: string;
					product_id: string;
					name: string;
					sku: string | null;
					price: number;
					stock_quantity: number;
					attributes: Record<string, any> | null;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					name: string;
					sku?: string | null;
					price: number;
					stock_quantity?: number;
					attributes?: Record<string, any> | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					name?: string;
					sku?: string | null;
					price?: number;
					stock_quantity?: number;
					attributes?: Record<string, any> | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			product_media: {
				Row: {
					id: string;
					product_id: string;
					media_type: string;
					url: string;
					thumbnail_url: string | null;
					alt_text: string | null;
					display_order: number;
					is_primary: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					media_type: string;
					url: string;
					thumbnail_url?: string | null;
					alt_text?: string | null;
					display_order?: number;
					is_primary?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					media_type?: string;
					url?: string;
					thumbnail_url?: string | null;
					alt_text?: string | null;
					display_order?: number;
					is_primary?: boolean;
					created_at?: string;
				};
			};
			discounts: {
				Row: {
					id: string;
					name: string;
					description: string | null;
					discount_type: string;
					discount_value: number;
					start_date: string | null;
					end_date: string | null;
					is_active: boolean;
					min_purchase_amount: number | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					description?: string | null;
					discount_type: string;
					discount_value: number;
					start_date?: string | null;
					end_date?: string | null;
					is_active?: boolean;
					min_purchase_amount?: number | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					description?: string | null;
					discount_type?: string;
					discount_value?: number;
					start_date?: string | null;
					end_date?: string | null;
					is_active?: boolean;
					min_purchase_amount?: number | null;
					created_at?: string;
				};
			};
			product_discounts: {
				Row: {
					id: string;
					product_id: string;
					discount_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					discount_id: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					discount_id?: string;
					created_at?: string;
				};
			};
			orders: {
				Row: {
					id: string;
					order_number: string;
					customer_name: string;
					customer_email: string;
					customer_phone: string | null;
					shipping_address: Record<string, any> | null;
					billing_address: Record<string, any> | null;
					subtotal: number;
					discount_amount: number;
					tax_amount: number;
					shipping_amount: number;
					total_amount: number;
					status: string;
					payment_status: string;
					payment_method: string | null;
					payment_id: string | null;
					notes: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					order_number: string;
					customer_name: string;
					customer_email: string;
					customer_phone?: string | null;
					shipping_address?: Record<string, any> | null;
					billing_address?: Record<string, any> | null;
					subtotal: number;
					discount_amount?: number;
					tax_amount?: number;
					shipping_amount?: number;
					total_amount: number;
					status?: string;
					payment_status?: string;
					payment_method?: string | null;
					payment_id?: string | null;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					order_number?: string;
					customer_name?: string;
					customer_email?: string;
					customer_phone?: string | null;
					shipping_address?: Record<string, any> | null;
					billing_address?: Record<string, any> | null;
					subtotal?: number;
					discount_amount?: number;
					tax_amount?: number;
					shipping_amount?: number;
					total_amount?: number;
					status?: string;
					payment_status?: string;
					payment_method?: string | null;
					payment_id?: string | null;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			product_specifications: {
				Row: {
					id: string;
					product_id: string;
					specification_key: string;
					specification_value: string;
					data_type: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					specification_key: string;
					specification_value: string;
					data_type?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					specification_key?: string;
					specification_value?: string;
					data_type?: string;
					created_at?: string;
					updated_at?: string;
				};
			};
			tags: {
				Row: {
					id: string;
					name: string;
					slug: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					slug: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					slug?: string;
					created_at?: string;
				};
			};
			product_tags: {
				Row: {
					id: string;
					product_id: string;
					tag_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					tag_id: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					tag_id?: string;
					created_at?: string;
				};
			};
			order_items: {
				Row: {
					id: string;
					order_id: string;
					product_id: string | null;
					variant_id: string | null;
					product_name: string;
					variant_name: string | null;
					quantity: number;
					unit_price: number;
					total_price: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					order_id: string;
					product_id?: string | null;
					variant_id?: string | null;
					product_name: string;
					variant_name?: string | null;
					quantity: number;
					unit_price: number;
					total_price: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					order_id?: string;
					product_id?: string | null;
					variant_id?: string | null;
					product_name?: string;
					variant_name?: string | null;
					quantity?: number;
					unit_price?: number;
					total_price?: number;
					created_at?: string;
				};
			};
			product_bundles: {
				Row: {
					id: string;
					product_id: string;
					name: string;
					description: string | null;
					sku: string | null;
					bundle_price: number;
					discount_percentage: number;
					stock_quantity: number;
					is_active: boolean;
					display_order: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					name: string;
					description?: string | null;
					sku?: string | null;
					bundle_price: number;
					discount_percentage?: number;
					stock_quantity?: number;
					is_active?: boolean;
					display_order?: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					name?: string;
					description?: string | null;
					sku?: string | null;
					bundle_price?: number;
					discount_percentage?: number;
					stock_quantity?: number;
					is_active?: boolean;
					display_order?: number;
					created_at?: string;
					updated_at?: string;
				};
			};
			bundle_items: {
				Row: {
					id: string;
					bundle_id: string;
					product_id: string;
					variant_id: string | null;
					quantity: number;
					display_order: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					bundle_id: string;
					product_id: string;
					variant_id?: string | null;
					quantity?: number;
					display_order?: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					bundle_id?: string;
					product_id?: string;
					variant_id?: string | null;
					quantity?: number;
					display_order?: number;
					created_at?: string;
				};
			};
			sat_product_info: {
				Row: {
					id: string;
					product_id: string;
					clave_prod_serv: string;
					clave_unidad: string;
					unidad_medida: string;
					material_peligroso: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					clave_prod_serv: string;
					clave_unidad: string;
					unidad_medida: string;
					material_peligroso?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					clave_prod_serv?: string;
					clave_unidad?: string;
					unidad_medida?: string;
					material_peligroso?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			amazon_listings: {
				Row: {
					id: string;
					product_id: string;
					sku_amazon: string | null;
					asin: string | null;
					feed_product_type: string | null;
					bullet_points: Record<string, any> | null;
					specific_attributes: Record<string, any> | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					sku_amazon?: string | null;
					asin?: string | null;
					feed_product_type?: string | null;
					bullet_points?: Record<string, any> | null;
					specific_attributes?: Record<string, any> | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					sku_amazon?: string | null;
					asin?: string | null;
					feed_product_type?: string | null;
					bullet_points?: Record<string, any> | null;
					specific_attributes?: Record<string, any> | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			mercadolibre_listings: {
				Row: {
					id: string;
					product_id: string;
					ml_id: string | null;
					listing_type: string;
					attributes: Record<string, any> | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					product_id: string;
					ml_id?: string | null;
					listing_type?: string;
					attributes?: Record<string, any> | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					product_id?: string;
					ml_id?: string | null;
					listing_type?: string;
					attributes?: Record<string, any> | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			category_mappings: {
				Row: {
					id: string;
					internal_type: string;
					platform: 'amazon' | 'mercadolibre' | 'sat';
					external_category_id: string;
					external_category_name: string | null;
					required_schema: Record<string, any> | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					internal_type: string;
					platform: 'amazon' | 'mercadolibre' | 'sat';
					external_category_id: string;
					external_category_name?: string | null;
					required_schema?: Record<string, any> | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					internal_type?: string;
					platform?: 'amazon' | 'mercadolibre' | 'sat';
					external_category_id?: string;
					external_category_name?: string | null;
					required_schema?: Record<string, any> | null;
					created_at?: string;
					updated_at?: string;
				};
			};
		};
		Functions: {
			get_product_details: {
				Args: { product_slug: string };
				Returns: any;
			};
			calculate_product_price: {
				Args: { product_id_param: string };
				Returns: number;
			};
		};
	};
};
