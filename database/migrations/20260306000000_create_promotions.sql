-- Tabla para promociones/creativos del home
-- Permite administrar banners con enlace a producto, categoria u otra URL

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_order ON promotions(display_order);

CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_promotions_updated_at ON promotions;
CREATE TRIGGER trigger_update_promotions_updated_at
    BEFORE UPDATE ON promotions
    FOR EACH ROW
    EXECUTE FUNCTION update_promotions_updated_at();

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active promotions" ON promotions;
CREATE POLICY "Public can view active promotions"
    ON promotions
    FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can insert promotions" ON promotions;
CREATE POLICY "Authenticated users can insert promotions"
    ON promotions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update promotions" ON promotions;
CREATE POLICY "Authenticated users can update promotions"
    ON promotions
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete promotions" ON promotions;
CREATE POLICY "Authenticated users can delete promotions"
    ON promotions
    FOR DELETE
    TO authenticated
    USING (true);

COMMENT ON TABLE promotions IS 'Promociones y creativos del home con imagen y enlace opcional';
COMMENT ON COLUMN promotions.title IS 'Titulo de la promocion';
COMMENT ON COLUMN promotions.description IS 'Texto opcional corto para reforzar el creativo';
COMMENT ON COLUMN promotions.image_url IS 'URL publica de imagen en storage';
COMMENT ON COLUMN promotions.link_url IS 'Ruta interna o URL externa para redireccionar';
COMMENT ON COLUMN promotions.display_order IS 'Orden de visualizacion en carrusel';
COMMENT ON COLUMN promotions.is_active IS 'Si la promocion se muestra en el sitio';
