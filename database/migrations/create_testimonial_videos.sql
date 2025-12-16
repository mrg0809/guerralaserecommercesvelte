-- Tabla para gestionar videos de testimonios de clientes
-- Permite al administrador agregar videos de YouTube y TikTok

CREATE TABLE IF NOT EXISTS testimonial_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    video_type VARCHAR(20) NOT NULL CHECK (video_type IN ('youtube', 'tiktok')),
    thumbnail_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_testimonial_videos_active ON testimonial_videos(is_active);
CREATE INDEX idx_testimonial_videos_order ON testimonial_videos(display_order);
CREATE INDEX idx_testimonial_videos_type ON testimonial_videos(video_type);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_testimonial_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_testimonial_videos_updated_at
    BEFORE UPDATE ON testimonial_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_testimonial_videos_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE testimonial_videos ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden VER videos activos
CREATE POLICY "Public can view active testimonial videos"
    ON testimonial_videos
    FOR SELECT
    USING (is_active = true);

-- Política: Solo usuarios autenticados pueden CREAR videos
CREATE POLICY "Authenticated users can insert testimonial videos"
    ON testimonial_videos
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política: Solo usuarios autenticados pueden ACTUALIZAR videos
CREATE POLICY "Authenticated users can update testimonial videos"
    ON testimonial_videos
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Política: Solo usuarios autenticados pueden ELIMINAR videos
CREATE POLICY "Authenticated users can delete testimonial videos"
    ON testimonial_videos
    FOR DELETE
    TO authenticated
    USING (true);

-- Insertar algunos videos de ejemplo (puedes eliminarlos después)
INSERT INTO testimonial_videos (title, description, video_url, video_type, thumbnail_url, display_order, is_active) VALUES
('Máquina Láser CO2 - Cliente Satisfecho', 'Cliente mostrando los resultados de su máquina láser CO2', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', 1, true),
('Fibra Óptica - Resultados Increíbles', 'Testimonio de cliente usando máquina de fibra óptica', 'https://www.youtube.com/embed/9bZkp7q19f0', 'youtube', 'https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg', 2, true),
('Router CNC en Acción', 'Cliente trabajando con su router CNC', 'https://www.youtube.com/embed/jNQXAC9IVRw', 'youtube', 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg', 3, true),
('Plasma - Corte Profesional', 'Resultados profesionales con máquina de plasma', 'https://www.youtube.com/embed/kJQP7kiw5Fk', 'youtube', 'https://img.youtube.com/vi/kJQP7kiw5Fk/maxresdefault.jpg', 4, true);

-- Comentarios para documentación
COMMENT ON TABLE testimonial_videos IS 'Almacena videos de testimonios de clientes para mostrar en el sitio web';
COMMENT ON COLUMN testimonial_videos.title IS 'Título descriptivo del testimonio';
COMMENT ON COLUMN testimonial_videos.description IS 'Descripción opcional del testimonio';
COMMENT ON COLUMN testimonial_videos.video_url IS 'URL del video embebido (YouTube o TikTok)';
COMMENT ON COLUMN testimonial_videos.video_type IS 'Tipo de plataforma: youtube o tiktok';
COMMENT ON COLUMN testimonial_videos.thumbnail_url IS 'URL de la imagen miniatura (principalmente para YouTube)';
COMMENT ON COLUMN testimonial_videos.display_order IS 'Orden de visualización en el carrusel';
COMMENT ON COLUMN testimonial_videos.is_active IS 'Si el video está activo y visible en el sitio';
