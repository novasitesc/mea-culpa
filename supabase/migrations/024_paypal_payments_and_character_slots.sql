BEGIN;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS max_personajes SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE public.perfiles
  DROP CONSTRAINT IF EXISTS perfiles_max_personajes_check;

ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_max_personajes_check
  CHECK (max_personajes BETWEEN 2 AND 5);

UPDATE public.perfiles
SET max_personajes = GREATEST(2, LEAST(5, max_personajes));

CREATE TABLE IF NOT EXISTS public.pagos_paypal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL CHECK (concepto IN ('ruleta_usd_spin', 'character_slot_unlock')),
  referencia_id UUID,
  monto_usd NUMERIC(10, 2) NOT NULL CHECK (monto_usd > 0),
  moneda TEXT NOT NULL DEFAULT 'USD' CHECK (moneda = 'USD'),
  paypal_order_id TEXT NOT NULL UNIQUE,
  paypal_capture_id TEXT UNIQUE,
  estado TEXT NOT NULL DEFAULT 'created' CHECK (
    estado IN ('created', 'approved', 'captured', 'completed', 'failed', 'refunded')
  ),
  effect_applied BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  completado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pagos_paypal_usuario_estado
  ON public.pagos_paypal (usuario_id, estado, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_paypal_concepto_referencia
  ON public.pagos_paypal (concepto, referencia_id);

CREATE OR REPLACE FUNCTION public.pagos_paypal_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pagos_paypal_updated_at ON public.pagos_paypal;
CREATE TRIGGER tr_pagos_paypal_updated_at
BEFORE UPDATE ON public.pagos_paypal
FOR EACH ROW
EXECUTE FUNCTION public.pagos_paypal_touch_updated_at();

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
    SET max_personajes = 5
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
