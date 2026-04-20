-- ============================================================
-- MEA CULPA - Migracion 036
-- Fix: referencia ambigua de muerto_en en funciones de vida
-- ============================================================

BEGIN;

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
  SELECT COALESCE(p.muerto_en, now())
  INTO v_muerto_en
  FROM public.personajes p
  WHERE p.id = p_personaje_id
    AND p.usuario_id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  UPDATE public.personajes p
  SET estado_vida = 'muerto',
      muerto_en = v_muerto_en,
      revivido_en = NULL,
      actualizado_en = now()
  WHERE p.id = p_personaje_id
    AND p.usuario_id = p_usuario_id;

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
  SELECT p.muerto_en
  INTO v_muerto_en
  FROM public.personajes p
  WHERE p.id = p_personaje_id
    AND p.usuario_id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  UPDATE public.personajes p
  SET estado_vida = 'vivo',
      revivido_en = v_revivido_en,
      actualizado_en = now()
  WHERE p.id = p_personaje_id
    AND p.usuario_id = p_usuario_id;

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
