-- ============================================
-- Asistente IA: base de conocimientos, chat, tokens móvil
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Canales temáticos del asistente
DO $$ BEGIN
    CREATE TYPE ai_knowledge_channel AS ENUM (
        'chillers',
        'guias_lineales',
        'tubos_laser',
        'compresores',
        'instalaciones',
        'soporte_tecnico',
        'general'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Miembros del equipo (selector móvil sin login)
CREATE TABLE IF NOT EXISTS ai_team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token compartido del APK móvil
CREATE TABLE IF NOT EXISTS mobile_app_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label VARCHAR(200) NOT NULL DEFAULT 'Equipo Guerra Láser',
    token_hash TEXT NOT NULL UNIQUE,
    scopes TEXT[] DEFAULT ARRAY['ai_chat', 'ai_knowledge', 'ai_quote'],
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- v2: vinculación dispositivo → miembro
CREATE TABLE IF NOT EXISTS mobile_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_uuid VARCHAR(255) NOT NULL UNIQUE,
    team_member_id UUID REFERENCES ai_team_members(id) ON DELETE SET NULL,
    label VARCHAR(200),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artículos de conocimiento compartido
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    channel ai_knowledge_channel NOT NULL DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    source_type VARCHAR(30) NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('manual', 'web', 'conversation', 'catalog')),
    source_url TEXT,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    embedding vector(768),
    created_by UUID REFERENCES auth.users(id),
    team_member_id UUID REFERENCES ai_team_members(id) ON DELETE SET NULL,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES auth.users(id),
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_articles_channel_idx ON knowledge_articles(channel);
CREATE INDEX IF NOT EXISTS knowledge_articles_embedding_idx
    ON knowledge_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Sesiones de chat
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    team_member_id UUID REFERENCES ai_team_members(id) ON DELETE SET NULL,
    channel ai_knowledge_channel NOT NULL DEFAULT 'general',
    session_type VARCHAR(20) NOT NULL DEFAULT 'knowledge'
        CHECK (session_type IN ('knowledge', 'quotation')),
    title VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_idx ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS ai_chat_sessions_team_member_idx ON ai_chat_sessions(team_member_id);
CREATE INDEX IF NOT EXISTS ai_chat_sessions_updated_idx ON ai_chat_sessions(updated_at DESC);

-- Mensajes
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chat_messages_session_idx ON ai_chat_messages(session_id, created_at);

-- Adjuntos (fotos / PDF)
CREATE TABLE IF NOT EXISTS ai_chat_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES ai_chat_messages(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    original_filename VARCHAR(500),
    mime_type VARCHAR(120) NOT NULL,
    file_size_bytes INT,
    extracted_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Búsqueda semántica en knowledge_articles
CREATE OR REPLACE FUNCTION search_knowledge_by_embedding(
    query_embedding vector(768),
    filter_channel ai_knowledge_channel DEFAULT NULL,
    match_threshold float DEFAULT 0.65,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    title varchar(500),
    content text,
    channel ai_knowledge_channel,
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
        ka.channel,
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

-- Permiso use_ai_assistant
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('use_ai_assistant', 'Usar Asistente IA', 'Acceso al asistente de inteligencia operativa', 'admin')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'superadmin')
  AND p.name = 'use_ai_assistant'
ON CONFLICT DO NOTHING;

-- Miembros iniciales de ejemplo (editar en admin)
INSERT INTO ai_team_members (display_name, sort_order) VALUES
    ('Ventas 1', 1),
    ('Ventas 2', 2),
    ('Técnico 1', 3),
    ('Técnico 2', 4);

-- Storage bucket (ejecutar políticas en Supabase Dashboard si es necesario)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('ai-chat-attachments', 'ai-chat-attachments', false)
-- ON CONFLICT DO NOTHING;

COMMENT ON TABLE knowledge_articles IS 'Base de conocimientos compartida del equipo';
COMMENT ON TABLE ai_chat_sessions IS 'Sesiones del asistente IA (web o móvil)';
COMMENT ON TABLE mobile_app_tokens IS 'Token compartido embebido en APK Capacitor';
