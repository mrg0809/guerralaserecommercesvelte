-- Agregar URLs de ficha técnica y manual en PDF a productos
ALTER TABLE public.products
	ADD COLUMN IF NOT EXISTS technical_sheet_url text,
	ADD COLUMN IF NOT EXISTS manual_pdf_url text;
