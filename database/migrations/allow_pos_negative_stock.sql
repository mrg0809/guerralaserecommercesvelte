-- POS: permitir descontar inventario aunque no haya existencia (stock puede quedar negativo).

CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_product_id uuid, p_qty integer)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE v_affected integer;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida para decrementar: %', p_qty;
  END IF;

  UPDATE public.products
  SET stock_quantity = COALESCE(stock_quantity, 0) - p_qty
  WHERE id = p_product_id;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_product_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_product_variant_stock(p_variant_id uuid, p_qty integer)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE v_affected integer;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida para decrementar variante: %', p_qty;
  END IF;

  UPDATE public.product_variants
  SET stock_quantity = COALESCE(stock_quantity, 0) - p_qty
  WHERE id = p_variant_id;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RAISE EXCEPTION 'Variante no encontrada: %', p_variant_id;
  END IF;
END;
$function$;
