-- Enrutamiento de WhatsApp por categoría (números asignados a categorías).

CREATE TABLE IF NOT EXISTS public.whatsapp_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  phone text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_agent_categories (
  agent_id uuid NOT NULL REFERENCES public.whatsapp_agents(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, category_id),
  CONSTRAINT whatsapp_agent_categories_category_unique UNIQUE (category_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_agents_active ON public.whatsapp_agents (is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_agent_categories_category ON public.whatsapp_agent_categories (category_id);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_agents_one_default
  ON public.whatsapp_agents ((is_default))
  WHERE is_default = true AND is_active = true;

ALTER TABLE public.whatsapp_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_agent_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active whatsapp agents" ON public.whatsapp_agents;
CREATE POLICY "Public read active whatsapp agents"
  ON public.whatsapp_agents FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Public read whatsapp agent categories" ON public.whatsapp_agent_categories;
CREATE POLICY "Public read whatsapp agent categories"
  ON public.whatsapp_agent_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_agents a
      WHERE a.id = agent_id AND a.is_active = true
    )
  );

INSERT INTO public.whatsapp_agents (label, phone, is_default, is_active)
SELECT 'Atención general', '523334758653', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_agents WHERE is_default = true
);
