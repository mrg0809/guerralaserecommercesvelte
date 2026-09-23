-- Número de WhatsApp asignado a la landing /acrilico-gdl.

ALTER TABLE public.whatsapp_agents
  ADD COLUMN IF NOT EXISTS is_acrilico_gdl boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_agents_one_acrilico_gdl
  ON public.whatsapp_agents ((is_acrilico_gdl))
  WHERE is_acrilico_gdl = true AND is_active = true;
