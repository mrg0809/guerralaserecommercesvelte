-- Función para generar números de cotización automáticamente (OPCIONAL)
-- Si prefieres que el número se genere automáticamente en la base de datos

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
  new_number TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');
  
  -- Buscar el último número del año actual
  SELECT COALESCE(
    MAX(
      CAST(
        SPLIT_PART(quotation_number, '-', 3) AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_num
  FROM quotations
  WHERE quotation_number LIKE 'COT-' || year_prefix || '-%';
  
  -- Generar el nuevo número
  new_number := 'COT-' || year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Ejemplo de uso:
-- SELECT generate_quotation_number();
