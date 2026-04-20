-- ============================================================
-- MEA CULPA - Migracion 023
-- Ruleta de premios (100 slots) + toggle global
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ruleta_configuracion (
  id               SMALLINT PRIMARY KEY DEFAULT 1,
  habilitada       BOOLEAN NOT NULL DEFAULT true,
  actualizado_por  UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ruleta_config_single_row CHECK (id = 1)
);

INSERT INTO public.ruleta_configuracion (id, habilitada)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ruleta_tiradas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id         UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  slot               SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 100),
  categoria          TEXT NOT NULL CHECK (categoria IN ('jackpot', 'muy_grande', 'nada', 'grande', 'mediano', 'pequeno')),
  premio_label       TEXT NOT NULL,
  costo_tipo         TEXT NOT NULL CHECK (costo_tipo IN ('oro', 'usd')),
  costo_monto        INT NOT NULL CHECK (costo_monto > 0),
  ciclo_numero       SMALLINT NOT NULL CHECK (ciclo_numero BETWEEN 1 AND 6),
  cobro_pendiente    BOOLEAN NOT NULL DEFAULT false,
  oro_resultante     INT,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ruleta_tiradas_usuario_fecha
  ON public.ruleta_tiradas (usuario_id, creado_en DESC);

CREATE OR REPLACE FUNCTION public.ruleta_registrar_tirada(
  p_usuario_id    UUID,
  p_slot          SMALLINT,
  p_categoria     TEXT,
  p_premio_label  TEXT,
  p_costo_tipo    TEXT,
  p_costo_monto   INT,
  p_ciclo_numero  SMALLINT
)
RETURNS TABLE (
  tirada_id UUID,
  oro_resultante INT,
  cobro_pendiente BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tirada_id UUID;
  v_nuevo_oro INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ruleta_configuracion
    WHERE id = 1 AND habilitada = true
  ) THEN
    RAISE EXCEPTION 'Ruleta deshabilitada';
  END IF;

  IF p_slot < 1 OR p_slot > 100 THEN
    RAISE EXCEPTION 'Slot invalido';
  END IF;

  IF p_categoria NOT IN ('jackpot', 'muy_grande', 'nada', 'grande', 'mediano', 'pequeno') THEN
    RAISE EXCEPTION 'Categoria invalida';
  END IF;

  IF p_costo_tipo NOT IN ('oro', 'usd') THEN
    RAISE EXCEPTION 'Tipo de costo invalido';
  END IF;

  IF p_ciclo_numero < 1 OR p_ciclo_numero > 6 THEN
    RAISE EXCEPTION 'Ciclo invalido';
  END IF;

  IF p_costo_monto <= 0 THEN
    RAISE EXCEPTION 'Costo invalido';
  END IF;

  INSERT INTO public.ruleta_tiradas (
    usuario_id,
    slot,
    categoria,
    premio_label,
    costo_tipo,
    costo_monto,
    ciclo_numero,
    cobro_pendiente
  )
  VALUES (
    p_usuario_id,
    p_slot,
    p_categoria,
    p_premio_label,
    p_costo_tipo,
    p_costo_monto,
    p_ciclo_numero,
    p_costo_tipo = 'usd'
  )
  RETURNING id INTO v_tirada_id;

  IF p_costo_tipo = 'oro' THEN
    SELECT public.modificar_oro(
      p_usuario_id,
      -p_costo_monto,
      'ruleta_spin:' || p_categoria,
      v_tirada_id
    )
    INTO v_nuevo_oro;
  ELSE
    SELECT oro
    INTO v_nuevo_oro
    FROM public.perfiles
    WHERE id = p_usuario_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Usuario no encontrado';
    END IF;
  END IF;

  UPDATE public.ruleta_tiradas
  SET oro_resultante = v_nuevo_oro
  WHERE id = v_tirada_id;

  RETURN QUERY
  SELECT v_tirada_id, v_nuevo_oro, (p_costo_tipo = 'usd');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ruleta_registrar_tirada(
  UUID,
  SMALLINT,
  TEXT,
  TEXT,
  TEXT,
  INT,
  SMALLINT
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ruleta_registrar_tirada(
  UUID,
  SMALLINT,
  TEXT,
  TEXT,
  TEXT,
  INT,
  SMALLINT
) TO service_role;

COMMIT;
