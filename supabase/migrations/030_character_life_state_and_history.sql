BEGIN;

ALTER TABLE public.personajes
  ADD COLUMN IF NOT EXISTS estado_vida TEXT NOT NULL DEFAULT 'vivo',
  ADD COLUMN IF NOT EXISTS muerto_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revivido_en TIMESTAMPTZ;

ALTER TABLE public.personajes
  DROP CONSTRAINT IF EXISTS personajes_estado_vida_check;

ALTER TABLE public.personajes
  ADD CONSTRAINT personajes_estado_vida_check
  CHECK (estado_vida IN ('vivo', 'muerto'));

UPDATE public.personajes
SET estado_vida = 'vivo'
WHERE estado_vida IS NULL;

CREATE INDEX IF NOT EXISTS idx_personajes_usuario_estado_vida
  ON public.personajes (usuario_id, estado_vida);

CREATE TABLE IF NOT EXISTS public.personajes_historial_vida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personaje_id BIGINT NOT NULL REFERENCES public.personajes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  evento TEXT NOT NULL CHECK (evento IN ('muerto', 'revivido')),
  motivo TEXT,
  muerto_en TIMESTAMPTZ,
  revivido_en TIMESTAMPTZ,
  partida_id UUID REFERENCES public.partidas(id) ON DELETE SET NULL,
  pago_id UUID REFERENCES public.pagos_paypal(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personajes_historial_vida_personaje
  ON public.personajes_historial_vida (personaje_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_personajes_historial_vida_usuario
  ON public.personajes_historial_vida (usuario_id, creado_en DESC);

ALTER TABLE public.personajes_historial_vida
  DROP CONSTRAINT IF EXISTS personajes_historial_vida_fechas_check;

ALTER TABLE public.personajes_historial_vida
  ADD CONSTRAINT personajes_historial_vida_fechas_check
  CHECK (
    (evento = 'muerto' AND muerto_en IS NOT NULL)
    OR
    (evento = 'revivido' AND revivido_en IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.marcar_personaje_muerto(
  p_personaje_id BIGINT,
  p_usuario_id UUID,
  p_motivo TEXT DEFAULT 'sistema',
  p_partida_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  personaje_id BIGINT,
  estado_vida TEXT,
  muerto_en TIMESTAMPTZ,
  revivido_en TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_muerto_en TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(muerto_en, now())
  INTO v_muerto_en
  FROM public.personajes
  WHERE id = p_personaje_id
    AND usuario_id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  UPDATE public.personajes
  SET estado_vida = 'muerto',
      muerto_en = v_muerto_en,
      revivido_en = NULL,
      actualizado_en = now()
  WHERE id = p_personaje_id
    AND usuario_id = p_usuario_id;

  INSERT INTO public.personajes_historial_vida (
    personaje_id,
    usuario_id,
    evento,
    motivo,
    muerto_en,
    partida_id,
    metadata
  )
  VALUES (
    p_personaje_id,
    p_usuario_id,
    'muerto',
    p_motivo,
    v_muerto_en,
    p_partida_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN QUERY
  SELECT p.id, p.estado_vida, p.muerto_en, p.revivido_en
  FROM public.personajes p
  WHERE p.id = p_personaje_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revivir_personaje(
  p_personaje_id BIGINT,
  p_usuario_id UUID,
  p_motivo TEXT DEFAULT 'revivir',
  p_pago_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  personaje_id BIGINT,
  estado_vida TEXT,
  muerto_en TIMESTAMPTZ,
  revivido_en TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_muerto_en TIMESTAMPTZ;
  v_revivido_en TIMESTAMPTZ := now();
BEGIN
  SELECT muerto_en
  INTO v_muerto_en
  FROM public.personajes
  WHERE id = p_personaje_id
    AND usuario_id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  UPDATE public.personajes
  SET estado_vida = 'vivo',
      revivido_en = v_revivido_en,
      actualizado_en = now()
  WHERE id = p_personaje_id
    AND usuario_id = p_usuario_id;

  INSERT INTO public.personajes_historial_vida (
    personaje_id,
    usuario_id,
    evento,
    motivo,
    muerto_en,
    revivido_en,
    pago_id,
    metadata
  )
  VALUES (
    p_personaje_id,
    p_usuario_id,
    'revivido',
    p_motivo,
    v_muerto_en,
    v_revivido_en,
    p_pago_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN QUERY
  SELECT p.id, p.estado_vida, p.muerto_en, p.revivido_en
  FROM public.personajes p
  WHERE p.id = p_personaje_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_personaje_muerto(BIGINT, UUID, TEXT, UUID, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_personaje_muerto(BIGINT, UUID, TEXT, UUID, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.revivir_personaje(BIGINT, UUID, TEXT, UUID, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revivir_personaje(BIGINT, UUID, TEXT, UUID, JSONB) TO service_role;

COMMIT;