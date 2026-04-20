BEGIN;

CREATE OR REPLACE FUNCTION public.paypal_aplicar_efecto(p_pago_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1
  FROM public.pagos_paypal
  WHERE id = p_pago_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago PayPal no encontrado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pagos_paypal
    WHERE id = p_pago_id
      AND estado <> 'completed'
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pagos_paypal
    WHERE id = p_pago_id
      AND effect_applied = true
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pagos_paypal
    WHERE id = p_pago_id
      AND concepto = 'ruleta_usd_spin'
  ) THEN
    UPDATE public.ruleta_tiradas
    SET cobro_pendiente = false
    WHERE cobro_pendiente = true
      AND id = (
        SELECT referencia_id
        FROM public.pagos_paypal
        WHERE id = p_pago_id
      )
      AND usuario_id = (
        SELECT usuario_id
        FROM public.pagos_paypal
        WHERE id = p_pago_id
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontro una tirada pendiente para el pago';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM public.pagos_paypal
    WHERE id = p_pago_id
      AND concepto = 'character_slot_unlock'
  ) THEN
    UPDATE public.perfiles
    SET max_personajes = LEAST(5, max_personajes + 1)
    WHERE id = (
      SELECT usuario_id
      FROM public.pagos_paypal
      WHERE id = p_pago_id
    )
      AND max_personajes < 5;
  ELSE
    RAISE EXCEPTION 'Concepto de pago no soportado';
  END IF;

  UPDATE public.pagos_paypal
  SET effect_applied = true,
      completado_en = COALESCE(completado_en, now())
  WHERE id = p_pago_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paypal_aplicar_efecto(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paypal_aplicar_efecto(UUID) TO service_role;

COMMIT;
