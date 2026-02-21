export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProductVariantAttributes = {
	color?: string
	color_hex?: string
	grosor?: string | number
	tamano?: string
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      amazon_listings: {
        Row: {
          asin: string | null
          browse_node_path: string | null
          bullet_points: Json | null
          created_at: string
          feed_product_type: string | null
          id: string
          price: number | null
          product_id: string
          sku_amazon: string | null
          specific_attributes: Json | null
          updated_at: string
        }
        Insert: {
          asin?: string | null
          browse_node_path?: string | null
          bullet_points?: Json | null
          created_at?: string
          feed_product_type?: string | null
          id?: string
          price?: number | null
          product_id: string
          sku_amazon?: string | null
          specific_attributes?: Json | null
          updated_at?: string
        }
        Update: {
          asin?: string | null
          browse_node_path?: string | null
          bullet_points?: Json | null
          created_at?: string
          feed_product_type?: string | null
          id?: string
          price?: number | null
          product_id?: string
          sku_amazon?: string | null
          specific_attributes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amazon_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: string
          created_at: string | null
          display_order: number | null
          id: string
          product_id: string
          quantity: number
          variant_id: string | null
        }
        Insert: {
          bundle_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          product_id: string
          quantity?: number
          variant_id?: string | null
        }
        Update: {
          bundle_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          product_id?: string
          quantity?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_mappings: {
        Row: {
          created_at: string
          external_category_id: string
          external_category_name: string | null
          id: string
          internal_type: string
          platform: string
          required_schema: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_category_id: string
          external_category_name?: string | null
          id?: string
          internal_type: string
          platform: string
          required_schema?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_category_id?: string
          external_category_name?: string | null
          id?: string
          internal_type?: string
          platform?: string
          required_schema?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          city: string | null
          company_name: string | null
          contact_name: string
          country: string | null
          created_at: string | null
          created_by: string | null
          customer_number: string | null
          customer_type: string | null
          email: string
          id: string
          mobile: string | null
          neighborhood: string | null
          notes: string | null
          phone: string | null
          rfc: string | null
          state: string | null
          street: string | null
          tags: string[] | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          contact_name: string
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_number?: string | null
          customer_type?: string | null
          email: string
          id?: string
          mobile?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          rfc?: string | null
          state?: string | null
          street?: string | null
          tags?: string[] | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string | null
          contact_name?: string
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_number?: string | null
          customer_type?: string | null
          email?: string
          id?: string
          mobile?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          rfc?: string | null
          state?: string | null
          street?: string | null
          tags?: string[] | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      discounts: {
        Row: {
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string | null
          id: string
          is_active: boolean | null
          min_purchase_amount: number | null
          name: string
          start_date: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          min_purchase_amount?: number | null
          name: string
          start_date?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          min_purchase_amount?: number | null
          name?: string
          start_date?: string | null
        }
        Relationships: []
      }
      mercadolibre_listings: {
        Row: {
          attributes: Json | null
          created_at: string
          id: string
          listing_type: string | null
          ml_id: string | null
          price: number | null
          product_id: string
          updated_at: string
        }
        Insert: {
          attributes?: Json | null
          created_at?: string
          id?: string
          listing_type?: string | null
          ml_id?: string | null
          price?: number | null
          product_id: string
          updated_at?: string
        }
        Update: {
          attributes?: Json | null
          created_at?: string
          id?: string
          listing_type?: string | null
          ml_id?: string | null
          price?: number | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercadolibre_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          order_number: string
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          shipping_address: Json | null
          shipping_amount: number | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          order_number: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: string | null
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          billing_address?: Json | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      product_bundles: {
        Row: {
          bundle_price: number
          created_at: string | null
          description: string | null
          discount_percentage: number | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          product_id: string
          sku: string | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          bundle_price: number
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          product_id: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          bundle_price?: number
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          product_id?: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_bundles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_discounts: {
        Row: {
          created_at: string | null
          discount_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          discount_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          discount_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_discounts_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt_text: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_primary: boolean | null
          media_type: string
          product_id: string
          thumbnail_url: string | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          media_type: string
          product_id: string
          thumbnail_url?: string | null
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          media_type?: string
          product_id?: string
          thumbnail_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          created_at: string
          data_type: string | null
          id: string
          product_id: string
          specification_key: string
          specification_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_type?: string | null
          id?: string
          product_id: string
          specification_key: string
          specification_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_type?: string | null
          id?: string
          product_id?: string
          specification_key?: string
          specification_value?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          product_id: string
          sku: string | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          product_id: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          product_id?: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          manual_pdf_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          short_description: string | null
          sku: string | null
          slug: string
          stock_quantity: number | null
          technical_sheet_url: string | null
          updated_at: string | null
        }
        Insert: {
          base_price: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          manual_pdf_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          short_description?: string | null
          sku?: string | null
          slug: string
          stock_quantity?: number | null
          technical_sheet_url?: string | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          manual_pdf_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_quantity?: number | null
          technical_sheet_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          description: string
          id: string
          line_discount_percentage: number
          product_id: string | null
          quantity: number
          quotation_id: string
          sku: string | null
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_discount_percentage?: number
          product_id?: string | null
          quantity: number
          quotation_id: string
          sku?: string | null
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_discount_percentage?: number
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          sku?: string | null
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_company: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          customer_rfc: string | null
          discount_amount: number
          general_discount_percentage: number
          id: string
          notes: string | null
          payment_terms: string
          quotation_number: string
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_company?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_rfc?: string | null
          discount_amount: number
          general_discount_percentage?: number
          id?: string
          notes?: string | null
          payment_terms?: string
          quotation_number: string
          status?: string
          subtotal: number
          total_amount: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_company?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_rfc?: string | null
          discount_amount?: number
          general_discount_percentage?: number
          id?: string
          notes?: string | null
          payment_terms?: string
          quotation_number?: string
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sat_product_info: {
        Row: {
          clave_prod_serv: string
          clave_unidad: string
          created_at: string
          id: string
          material_peligroso: boolean
          product_id: string
          unidad_medida: string
          updated_at: string
        }
        Insert: {
          clave_prod_serv: string
          clave_unidad: string
          created_at?: string
          id?: string
          material_peligroso?: boolean
          product_id: string
          unidad_medida: string
          updated_at?: string
        }
        Update: {
          clave_prod_serv?: string
          clave_unidad?: string
          created_at?: string
          id?: string
          material_peligroso?: boolean
          product_id?: string
          unidad_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sat_product_info_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      testimonial_videos: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_type: string
          video_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_type: string
          video_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_type?: string
          video_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_product_price: {
        Args: { product_id_param: string }
        Returns: number
      }
      generate_customer_number: { Args: never; Returns: string }
      generate_quotation_number: { Args: never; Returns: string }
      get_category_tree: { Args: never; Returns: Json }
      get_product_details: { Args: { product_slug: string }; Returns: Json }
      get_products_by_tag: {
        Args: { tag_slug_param: string }
        Returns: {
          base_price: number
          category_id: string
          id: string
          is_featured: boolean
          name: string
          short_description: string
          slug: string
        }[]
      }
      get_subcategories: {
        Args: { parent_category_id: string }
        Returns: {
          description: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          parent_id: string
          slug: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
