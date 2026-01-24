-- Habilitar la extensión pgvector para búsqueda semántica
CREATE EXTENSION IF NOT EXISTS vector;

-- Agregar columna de embeddings a la tabla products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS name_embedding vector(768);

-- Agregar columna de embeddings a la tabla product_variants
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS name_embedding vector(768);

-- Crear índice para búsqueda rápida de vectores en products
CREATE INDEX IF NOT EXISTS products_name_embedding_idx 
ON products 
USING ivfflat (name_embedding vector_cosine_ops)
WITH (lists = 100);

-- Crear índice para búsqueda rápida de vectores en product_variants
CREATE INDEX IF NOT EXISTS product_variants_name_embedding_idx 
ON product_variants 
USING ivfflat (name_embedding vector_cosine_ops)
WITH (lists = 100);

-- Función para buscar productos por similitud semántica
CREATE OR REPLACE FUNCTION search_products_by_embedding(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    name varchar(255),
    sku varchar(255),
    base_price numeric,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.sku,
        p.base_price,
        1 - (p.name_embedding <=> query_embedding) as similarity
    FROM products p
    WHERE p.is_active = true
        AND p.name_embedding IS NOT NULL
        AND 1 - (p.name_embedding <=> query_embedding) > match_threshold
    ORDER BY p.name_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Función para buscar variantes de productos por similitud semántica
CREATE OR REPLACE FUNCTION search_product_variants_by_embedding(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    product_id uuid,
    product_name varchar(255),
    variant_name varchar(255),
    sku varchar(255),
    price numeric,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.id,
        pv.product_id,
        p.name as product_name,
        pv.name as variant_name,
        pv.sku,
        pv.price,
        1 - (pv.name_embedding <=> query_embedding) as similarity
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    WHERE p.is_active = true
        AND pv.name_embedding IS NOT NULL
        AND 1 - (pv.name_embedding <=> query_embedding) > match_threshold
    ORDER BY pv.name_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON COLUMN products.name_embedding IS 'Vector embedding del nombre del producto para búsqueda semántica (768 dimensiones - Gemini)';
COMMENT ON COLUMN product_variants.name_embedding IS 'Vector embedding del nombre de la variante para búsqueda semántica (768 dimensiones - Gemini)';
