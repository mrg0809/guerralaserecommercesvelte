-- Crear tabla de cotizaciones
CREATE TABLE IF NOT EXISTS quotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_company VARCHAR(255),
    customer_rfc VARCHAR(20),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_address TEXT,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    general_discount_percentage DECIMAL(5, 2) DEFAULT 0,
    general_discount_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    validity_days INTEGER DEFAULT 15,
    payment_terms VARCHAR(255) DEFAULT 'Contado',
    notes TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, accepted, rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Crear tabla de items de cotizaciones
CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    sku VARCHAR(100),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    line_discount_percentage DECIMAL(5, 2) DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_quotations_customer_name ON quotations(customer_name);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);

-- Función para generar número de cotización automático
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
BEGIN
    year_prefix := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(quotation_number FROM LENGTH(year_prefix) + 2)
            AS INTEGER
        )
    ), 0) + 1
    INTO next_num
    FROM quotations
    WHERE quotation_number LIKE year_prefix || '-%';
    
    RETURN year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quotations_updated_at
    BEFORE UPDATE ON quotations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden ver todas las cotizaciones
CREATE POLICY "Usuarios autenticados pueden ver cotizaciones"
    ON quotations FOR SELECT
    TO authenticated
    USING (true);

-- Política: Los usuarios autenticados pueden crear cotizaciones
CREATE POLICY "Usuarios autenticados pueden crear cotizaciones"
    ON quotations FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política: Los usuarios autenticados pueden actualizar cotizaciones
CREATE POLICY "Usuarios autenticados pueden actualizar cotizaciones"
    ON quotations FOR UPDATE
    TO authenticated
    USING (true);

-- Política: Los usuarios autenticados pueden eliminar cotizaciones
CREATE POLICY "Usuarios autenticados pueden eliminar cotizaciones"
    ON quotations FOR DELETE
    TO authenticated
    USING (true);

-- Políticas para quotation_items (heredan de quotations)
CREATE POLICY "Usuarios autenticados pueden ver items de cotizaciones"
    ON quotation_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden crear items de cotizaciones"
    ON quotation_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar items de cotizaciones"
    ON quotation_items FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden eliminar items de cotizaciones"
    ON quotation_items FOR DELETE
    TO authenticated
    USING (true);
