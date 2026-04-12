-- ============================================================
-- MEA CULPA - Migracion 021
-- Persistir cooldown por usuario aunque borre personaje
-- ============================================================

BEGIN;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS ultima_partida_finalizada_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_perfiles_ultima_partida_finalizada_en
  ON public.perfiles (ultima_partida_finalizada_en);

COMMIT;
