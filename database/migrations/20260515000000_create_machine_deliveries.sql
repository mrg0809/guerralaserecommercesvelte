-- =====================================================
-- Módulo de entrega de máquinas - Guerra Laser
-- =====================================================

-- Permisos nuevos
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_machine_deliveries', 'Ver entregas de máquinas', 'Ver actas de entrega', 'deliveries'),
    ('create_machine_deliveries', 'Crear entregas de máquinas', 'Crear actas de entrega', 'deliveries'),
    ('complete_machine_deliveries', 'Completar entregas', 'Firmar y cerrar entregas', 'deliveries'),
    ('view_technician_panel', 'Panel técnico', 'Acceso al panel móvil de técnico', 'deliveries')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('admin', 'superadmin')
AND p.name IN (
    'view_machine_deliveries',
    'create_machine_deliveries',
    'complete_machine_deliveries'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'tecnico'
AND p.name IN (
    'view_machine_deliveries',
    'complete_machine_deliveries',
    'view_technician_panel',
    'view_assigned_services'
)
ON CONFLICT DO NOTHING;

-- Número de entrega
CREATE OR REPLACE FUNCTION generate_delivery_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    year_part VARCHAR(4);
    next_num INTEGER;
    new_number VARCHAR(50);
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(delivery_number FROM 10) AS INTEGER)), 0) + 1
    INTO next_num
    FROM machine_deliveries
    WHERE delivery_number LIKE 'ENT-' || year_part || '-%';
    new_number := 'ENT-' || year_part || '-' || LPAD(next_num::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Tabla principal
CREATE TABLE IF NOT EXISTS machine_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_number VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_delivery_number(),

    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    assigned_technician_id UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),

    machinery_type VARCHAR(50) NOT NULL DEFAULT 'co2'
        CHECK (machinery_type IN (
            'canteadora', 'centro_maquinado', 'cnc', 'co2',
            'fibra_optica', 'plasma', 'torno'
        )),
    machine_model TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,

    installation_completed BOOLEAN DEFAULT false,
    left_operational BOOLEAN DEFAULT false,
    training_provided BOOLEAN DEFAULT false,
    training_notes TEXT,

    technician_observations TEXT,
    customer_observations TEXT,

    customer_signature_path TEXT,
    technician_signature_path TEXT,
    pdf_storage_path TEXT,

    status VARCHAR(50) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'in_progress', 'signed', 'emailed')),

    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    order_id UUID,

    signed_at TIMESTAMPTZ,
    emailed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machine_delivery_accessories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES machine_deliveries(id) ON DELETE CASCADE,
    accessory_type VARCHAR(50) NOT NULL
        CHECK (accessory_type IN ('chiller', 'regulator', 'rotary', 'extractor', 'other')),
    description TEXT,
    serial_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machine_delivery_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES machine_deliveries(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machine_deliveries_customer ON machine_deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_machine_deliveries_technician ON machine_deliveries(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_machine_deliveries_status ON machine_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_machine_deliveries_date ON machine_deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_machine_delivery_accessories_delivery ON machine_delivery_accessories(delivery_id);
CREATE INDEX IF NOT EXISTS idx_machine_delivery_photos_delivery ON machine_delivery_photos(delivery_id);

CREATE OR REPLACE FUNCTION update_machine_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_machine_deliveries_updated_at ON machine_deliveries;
CREATE TRIGGER trigger_machine_deliveries_updated_at
    BEFORE UPDATE ON machine_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_machine_deliveries_updated_at();

-- RPC combinado roles + permisos (para login y userStore)
CREATE OR REPLACE FUNCTION get_user_roles_and_permissions(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'roles', COALESCE((
            SELECT json_agg(r.name)
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = user_uuid AND ur.is_active = true AND r.is_active = true
        ), '[]'::json),
        'permissions', COALESCE((
            SELECT json_agg(DISTINCT p.name)
            FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = user_uuid AND ur.is_active = true
        ), '[]'::json)
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS
ALTER TABLE machine_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_delivery_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_delivery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access machine_deliveries" ON machine_deliveries
    FOR ALL USING (
        user_has_role(auth.uid(), 'admin') OR user_has_role(auth.uid(), 'superadmin')
    );

CREATE POLICY "Technicians view assigned deliveries" ON machine_deliveries
    FOR SELECT USING (
        user_has_role(auth.uid(), 'tecnico')
        AND assigned_technician_id = auth.uid()
    );

CREATE POLICY "Technicians update assigned deliveries" ON machine_deliveries
    FOR UPDATE USING (
        user_has_role(auth.uid(), 'tecnico')
        AND assigned_technician_id = auth.uid()
        AND status IN ('draft', 'in_progress')
    );

CREATE POLICY "Admins full access delivery accessories" ON machine_delivery_accessories
    FOR ALL USING (
        user_has_role(auth.uid(), 'admin') OR user_has_role(auth.uid(), 'superadmin')
    );

CREATE POLICY "Technicians manage accessories on assigned" ON machine_delivery_accessories
    FOR ALL USING (
        user_has_role(auth.uid(), 'tecnico')
        AND EXISTS (
            SELECT 1 FROM machine_deliveries d
            WHERE d.id = delivery_id
            AND d.assigned_technician_id = auth.uid()
        )
    );

CREATE POLICY "Admins full access delivery photos" ON machine_delivery_photos
    FOR ALL USING (
        user_has_role(auth.uid(), 'admin') OR user_has_role(auth.uid(), 'superadmin')
    );

CREATE POLICY "Technicians manage photos on assigned" ON machine_delivery_photos
    FOR ALL USING (
        user_has_role(auth.uid(), 'tecnico')
        AND EXISTS (
            SELECT 1 FROM machine_deliveries d
            WHERE d.id = delivery_id
            AND d.assigned_technician_id = auth.uid()
        )
    );

-- Storage bucket delivery-photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-photos', 'delivery-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update delivery photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete delivery photos" ON storage.objects;

CREATE POLICY "Public read delivery photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'delivery-photos');

CREATE POLICY "Authenticated upload delivery photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'delivery-photos');

CREATE POLICY "Authenticated update delivery photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'delivery-photos')
WITH CHECK (bucket_id = 'delivery-photos');

CREATE POLICY "Authenticated delete delivery photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'delivery-photos');
