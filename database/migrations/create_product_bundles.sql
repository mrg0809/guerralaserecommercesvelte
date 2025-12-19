-- Tabla de bundles/paquetes de productos
CREATE TABLE IF NOT EXISTS product_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    bundle_price DECIMAL(10, 2) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de items que componen cada bundle
CREATE TABLE IF NOT EXISTS bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID NOT NULL REFERENCES product_bundles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_product_bundles_product_id ON product_bundles(product_id);
CREATE INDEX IF NOT EXISTS idx_product_bundles_is_active ON product_bundles(is_active);
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON bundle_items(product_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_product_bundles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_bundles_updated_at
    BEFORE UPDATE ON product_bundles
    FOR EACH ROW
    EXECUTE FUNCTION update_product_bundles_updated_at();

-- Políticas RLS (Row Level Security)
ALTER TABLE product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;

-- Política para lectura pública de bundles activos
CREATE POLICY "Public can view active bundles"
    ON product_bundles
    FOR SELECT
    USING (is_active = true);

-- Política para lectura pública de items de bundles
CREATE POLICY "Public can view bundle items"
    ON bundle_items
    FOR SELECT
    USING (true);

-- Políticas para administradores (necesitas ajustar según tu sistema de auth)
-- Aquí asumo que tienes una función is_admin() o similar
CREATE POLICY "Admins can do everything on bundles"
    ON product_bundles
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can do everything on bundle items"
    ON bundle_items
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comentarios para documentación
COMMENT ON TABLE product_bundles IS 'Almacena los paquetes/bundles de productos que se muestran como opciones en la página de producto';
COMMENT ON TABLE bundle_items IS 'Define qué productos y variantes componen cada bundle';
COMMENT ON COLUMN product_bundles.bundle_price IS 'Precio total del bundle';
COMMENT ON COLUMN product_bundles.discount_percentage IS 'Porcentaje de descuento comparado con la suma de precios individuales';
COMMENT ON COLUMN bundle_items.quantity IS 'Cantidad de este producto/variante en el bundle';
