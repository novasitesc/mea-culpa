-- ============================================================
-- MEA CULPA — Migración 018
-- Reglas de cupo y metadata de partidas públicas
-- ============================================================

BEGIN;

ALTER TABLE public.partidas
  ADD COLUMN IF NOT EXISTS minimo_jugadores INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS maximo_jugadores INT NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS piso INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS inicio_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tier INT NOT NULL DEFAULT 1;

ALTER TABLE public.partidas
  DROP CONSTRAINT IF EXISTS partidas_minimo_jugadores_check;
ALTER TABLE public.partidas
  DROP CONSTRAINT IF EXISTS partidas_maximo_jugadores_check;
ALTER TABLE public.partidas
  DROP CONSTRAINT IF EXISTS partidas_min_max_jugadores_check;
ALTER TABLE public.partidas
  DROP CONSTRAINT IF EXISTS partidas_piso_check;
ALTER TABLE public.partidas
  DROP CONSTRAINT IF EXISTS partidas_tier_check;

ALTER TABLE public.partidas
  ADD CONSTRAINT partidas_minimo_jugadores_check
  CHECK (minimo_jugadores >= 5 AND minimo_jugadores <= 6);

ALTER TABLE public.partidas
  ADD CONSTRAINT partidas_maximo_jugadores_check
  CHECK (maximo_jugadores >= 5 AND maximo_jugadores <= 6);

ALTER TABLE public.partidas
  ADD CONSTRAINT partidas_min_max_jugadores_check
  CHECK (minimo_jugadores <= maximo_jugadores);

ALTER TABLE public.partidas
  ADD CONSTRAINT partidas_piso_check
  CHECK (piso >= 1 AND piso <= 20);

ALTER TABLE public.partidas
  ADD CONSTRAINT partidas_tier_check
  CHECK (tier IN (1, 2));

-- Compatibilidad: mantener limite_jugadores como espejo del máximo
UPDATE public.partidas
SET
  minimo_jugadores = GREATEST(5, LEAST(6, COALESCE(minimo_jugadores, 5))),
  maximo_jugadores = GREATEST(5, LEAST(6, COALESCE(maximo_jugadores, limite_jugadores, 6))),
  limite_jugadores = GREATEST(5, LEAST(6, COALESCE(maximo_jugadores, limite_jugadores, 6))),
  piso = GREATEST(1, LEAST(20, COALESCE(piso, 1))),
  tier = CASE WHEN COALESCE(tier, 1) = 2 THEN 2 ELSE 1 END;

COMMIT;
