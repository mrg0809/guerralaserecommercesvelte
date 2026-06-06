-- Biblioteca de iconos SVG para el constructor de diseños (Guerra Láser)

-- ============================================================================
-- TABLAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS design_icon_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS design_icons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES design_icon_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_design_icon_categories_order ON design_icon_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_design_icon_categories_active ON design_icon_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_design_icons_category ON design_icons(category_id);
CREATE INDEX IF NOT EXISTS idx_design_icons_order ON design_icons(display_order);
CREATE INDEX IF NOT EXISTS idx_design_icons_active ON design_icons(is_active);

CREATE OR REPLACE FUNCTION update_design_icon_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_design_icons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_design_icon_categories_updated_at ON design_icon_categories;
CREATE TRIGGER trigger_update_design_icon_categories_updated_at
    BEFORE UPDATE ON design_icon_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_design_icon_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_update_design_icons_updated_at ON design_icons;
CREATE TRIGGER trigger_update_design_icons_updated_at
    BEFORE UPDATE ON design_icons
    FOR EACH ROW
    EXECUTE FUNCTION update_design_icons_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE design_icon_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_icons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active design icon categories" ON design_icon_categories;
CREATE POLICY "Public can view active design icon categories"
    ON design_icon_categories
    FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated can manage design icon categories" ON design_icon_categories;
CREATE POLICY "Authenticated can insert design icon categories"
    ON design_icon_categories
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated can update design icon categories"
    ON design_icon_categories
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated can delete design icon categories"
    ON design_icon_categories
    FOR DELETE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Public can view active design icons" ON design_icons;
CREATE POLICY "Public can view active design icons"
    ON design_icons
    FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM design_icon_categories c
            WHERE c.id = design_icons.category_id AND c.is_active = true
        )
    );

DROP POLICY IF EXISTS "Authenticated can insert design icons" ON design_icons;
CREATE POLICY "Authenticated can insert design icons"
    ON design_icons
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update design icons" ON design_icons;
CREATE POLICY "Authenticated can update design icons"
    ON design_icons
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete design icons" ON design_icons;
CREATE POLICY "Authenticated can delete design icons"
    ON design_icons
    FOR DELETE
    TO authenticated
    USING (true);

-- Admin needs to read inactive rows too — authenticated full read
DROP POLICY IF EXISTS "Authenticated can read all design icon categories" ON design_icon_categories;
CREATE POLICY "Authenticated can read all design icon categories"
    ON design_icon_categories
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated can read all design icons" ON design_icons;
CREATE POLICY "Authenticated can read all design icons"
    ON design_icons
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================================
-- STORAGE BUCKET design-icons
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'design-icons',
    'design-icons',
    true,
    524288,
    ARRAY['image/svg+xml', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 524288,
    allowed_mime_types = ARRAY['image/svg+xml', 'application/octet-stream']::text[];

DROP POLICY IF EXISTS "Public read access for design icons" ON storage.objects;
CREATE POLICY "Public read access for design icons"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'design-icons');

DROP POLICY IF EXISTS "Authenticated upload design icons" ON storage.objects;
CREATE POLICY "Authenticated upload design icons"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'design-icons');

DROP POLICY IF EXISTS "Authenticated update design icons" ON storage.objects;
CREATE POLICY "Authenticated update design icons"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'design-icons')
    WITH CHECK (bucket_id = 'design-icons');

DROP POLICY IF EXISTS "Authenticated delete design icons" ON storage.objects;
CREATE POLICY "Authenticated delete design icons"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'design-icons');

-- ============================================================================
-- SEED: categorías e iconos (paths en bucket; subir SVGs con scripts/seed-design-icons.mjs)
-- ============================================================================

INSERT INTO design_icon_categories (slug, label, display_order, is_active)
VALUES
    ('lineas', 'Líneas decorativas', 1, true),
    ('formas', 'Formas', 2, true),
    ('bebidas', 'Bebidas', 3, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO design_icons (category_id, name, slug, storage_path, display_order, is_active)
SELECT c.id, v.name, v.slug, v.storage_path, v.display_order, true
FROM design_icon_categories c
JOIN (VALUES
    ('lineas', 'Onda', 'onda-1', 'lineas/onda-1.svg', 1),
    ('lineas', 'Línea curva', 'linea-curva-1', 'lineas/linea-curva-1.svg', 2),
    ('formas', 'Corazón', 'corazon-1', 'formas/corazon-1.svg', 1),
    ('formas', 'Nube', 'nube-1', 'formas/nube-1.svg', 2),
    ('bebidas', 'Tarro cerveza', 'cerveza-1', 'bebidas/cerveza-1.svg', 1),
    ('bebidas', 'Vaso', 'vaso-1', 'bebidas/vaso-1.svg', 2)
) AS v(cat_slug, name, slug, storage_path, display_order)
    ON c.slug = v.cat_slug
ON CONFLICT (category_id, slug) DO NOTHING;

COMMENT ON TABLE design_icon_categories IS 'Categorías de la biblioteca SVG del constructor de diseños';
COMMENT ON TABLE design_icons IS 'Iconos SVG para grabado láser en el design builder';
