-- ============================================================
-- MEA CULPA — Migracion 037
-- Estado "en_progreso" para partidas
-- ============================================================

BEGIN;

ALTER TABLE public.partidas
  DROP CONSTRAINT IF EXISTS partidas_estado_check;

ALTER TABLE public.partidas
  ADD CONSTRAINT partidas_estado_check
  CHECK (estado IN ('abierta', 'en_progreso', 'finalizada'));

-- Mantener la regla de una sola partida activa por usuario/personaje,
-- considerando tambien las partidas en progreso.
CREATE OR REPLACE FUNCTION public.enforce_single_active_partida()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_partida_id UUID;
  conflict_partida_titulo TEXT;
BEGIN
  SELECT p.id, p.titulo
  INTO conflict_partida_id, conflict_partida_titulo
  FROM public.partida_participantes pp
  JOIN public.partidas p ON p.id = pp.partida_id
  WHERE p.estado IN ('abierta', 'en_progreso')
    AND pp.partida_id <> NEW.partida_id
    AND (
      pp.personaje_id = NEW.personaje_id
      OR (NEW.usuario_id IS NOT NULL AND pp.usuario_id = NEW.usuario_id)
    )
    AND (TG_OP = 'INSERT' OR pp.id <> NEW.id)
  LIMIT 1;

  IF conflict_partida_id IS NOT NULL THEN
    RAISE EXCEPTION 'El jugador ya esta en otra partida activa (%).', COALESCE(conflict_partida_titulo, conflict_partida_id::TEXT)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
