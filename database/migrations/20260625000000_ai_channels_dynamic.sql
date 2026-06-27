-- Temas dinámicos del asistente + columnas channel como texto

CREATE TABLE IF NOT EXISTS ai_channels (
    slug TEXT PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    emoji VARCHAR(16) DEFAULT '💬',
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrar columnas de enum a text (idempotente si ya es text)
DO $$ BEGIN
    ALTER TABLE knowledge_articles ALTER COLUMN channel TYPE TEXT USING channel::text;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ai_chat_sessions ALTER COLUMN channel TYPE TEXT USING channel::text;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Temas iniciales + nuevos
INSERT INTO ai_channels (slug, label, emoji, sort_order) VALUES
    ('general', 'General', '💬', 0),
    ('maquinas', 'Máquinas láser', '🖥️', 1),
    ('extractores', 'Extractores', '💨', 2),
    ('chillers', 'Chillers', '❄️', 3),
    ('guias_lineales', 'Guías lineales', '📏', 4),
    ('tubos_laser', 'Tubos láser', '🔴', 5),
    ('compresores', 'Compresores', '🌬️', 6),
    ('instalaciones', 'Instalaciones', '🔧', 7),
    ('soporte_tecnico', 'Soporte técnico', '🛠️', 8)
ON CONFLICT (slug) DO UPDATE SET
    label = EXCLUDED.label,
    emoji = EXCLUDED.emoji,
    sort_order = EXCLUDED.sort_order;

-- RPC actualizada para filtro text
CREATE OR REPLACE FUNCTION search_knowledge_by_embedding(
    query_embedding vector(768),
    filter_channel text DEFAULT NULL,
    match_threshold float DEFAULT 0.65,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    title varchar(500),
    content text,
    channel text,
    source_type varchar(30),
    source_url text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ka.id,
        ka.title,
        ka.content,
        ka.channel::text,
        ka.source_type,
        ka.source_url,
        1 - (ka.embedding <=> query_embedding) AS similarity
    FROM knowledge_articles ka
    WHERE ka.embedding IS NOT NULL
        AND (filter_channel IS NULL OR ka.channel = filter_channel OR ka.channel = 'general')
        AND 1 - (ka.embedding <=> query_embedding) > match_threshold
    ORDER BY ka.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON TABLE ai_channels IS 'Temas/canales del asistente IA — editables desde admin';
