-- ============================================================
-- MEA CULPA — Migración 017
-- Partidas públicas con cupo y autoinscripción de jugadores
-- ============================================================

BEGIN;

-- 1) Cada partida publicada define cupo máximo de jugadores
ALTER TABLE public.partidas
  ADD COLUMN IF NOT EXISTS limite_jugadores INT NOT NULL DEFAULT 4;

ALTER TABLE public.partidas
  DROP CONSTRAINT IF EXISTS partidas_limite_jugadores_check;

ALTER TABLE public.partidas
  ADD CONSTRAINT partidas_limite_jugadores_check
  CHECK (limite_jugadores >= 1);

CREATE INDEX IF NOT EXISTS idx_partidas_estado_creada_en
  ON public.partidas (estado, creada_en DESC);

-- 2) Evitar que el mismo personaje se inscriba dos veces en una partida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partida_participantes_partida_personaje_unique'
  ) THEN
    ALTER TABLE public.partida_participantes
      ADD CONSTRAINT partida_participantes_partida_personaje_unique
      UNIQUE (partida_id, personaje_id);
  END IF;
END $$;

-- 3) Un jugador/personaje no puede estar en dos partidas abiertas a la vez
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
  WHERE p.estado = 'abierta'
    AND pp.partida_id <> NEW.partida_id
    AND (
      pp.personaje_id = NEW.personaje_id
      OR (NEW.usuario_id IS NOT NULL AND pp.usuario_id = NEW.usuario_id)
    )
    AND (TG_OP = 'INSERT' OR pp.id <> NEW.id)
  LIMIT 1;

  IF conflict_partida_id IS NOT NULL THEN
    RAISE EXCEPTION 'El jugador ya está en otra partida abierta (%).', COALESCE(conflict_partida_titulo, conflict_partida_id::TEXT)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_active_partida ON public.partida_participantes;

CREATE TRIGGER trg_single_active_partida
BEFORE INSERT OR UPDATE OF partida_id, personaje_id, usuario_id
ON public.partida_participantes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_active_partida();

COMMIT;
