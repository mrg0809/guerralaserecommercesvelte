-- =====================================================
-- FASE 1: Base de Datos de Clientes
-- Guerra Laser - Sistema CRM
-- =====================================================

-- Tabla principal de clientes
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_number VARCHAR(50) UNIQUE, -- CLI-2026-0001
    
    -- Datos básicos
    company_name VARCHAR(255),
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    mobile VARCHAR(50),
    rfc VARCHAR(13),
    
    -- Dirección
    street VARCHAR(255),
    neighborhood VARCHAR(100), -- Colonia
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(10),
    country VARCHAR(100) DEFAULT 'México',
    
    -- Información adicional
    customer_type VARCHAR(50) DEFAULT 'regular', -- regular, vip, wholesale
    notes TEXT,
    tags TEXT[], -- Para categorización flexible
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_contact ON customers(contact_name);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();

-- RLS (Row Level Security) Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Los admins pueden hacer todo
CREATE POLICY "Admins can do everything on customers" ON customers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND (raw_user_meta_data->>'role' = 'admin' OR raw_user_meta_data->>'role' = 'super_admin')
        )
    );

-- Policy: Los usuarios autenticados pueden ver clientes
CREATE POLICY "Authenticated users can view customers" ON customers
    FOR SELECT USING (
        auth.uid() IS NOT NULL
    );

-- =====================================================
-- Función para generar número de cliente automático
-- =====================================================
CREATE OR REPLACE FUNCTION generate_customer_number()
RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    sequence_num INTEGER;
    new_number TEXT;
BEGIN
    -- Obtener año actual
    year_part := TO_CHAR(NOW(), 'YYYY');
    
    -- Obtener el último número de este año
    SELECT COALESCE(
        MAX(
            CAST(
                SUBSTRING(customer_number FROM 'CLI-' || year_part || '-(\d+)')
                AS INTEGER
            )
        ), 0
    ) INTO sequence_num
    FROM customers
    WHERE customer_number LIKE 'CLI-' || year_part || '-%';
    
    -- Incrementar
    sequence_num := sequence_num + 1;
    
    -- Formatear: CLI-2026-0001
    new_number := 'CLI-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Vincular clientes con cotizaciones existentes
-- =====================================================
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);

-- =====================================================
-- Comentarios para documentación
-- =====================================================
COMMENT ON TABLE customers IS 'Tabla principal de clientes del sistema CRM';
COMMENT ON COLUMN customers.customer_number IS 'Número único de cliente (CLI-YYYY-####)';
COMMENT ON COLUMN customers.customer_type IS 'Tipo de cliente: regular, vip, wholesale';
COMMENT ON COLUMN customers.tags IS 'Etiquetas para categorización flexible';
COMMENT ON FUNCTION generate_customer_number() IS 'Genera número secuencial de cliente por año';
