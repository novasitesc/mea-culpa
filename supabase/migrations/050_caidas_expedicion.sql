-- ============================================================
-- MEA CULPA - Migracion 050
-- Contador de caídas por personaje durante la expedición.
-- Inspirado en las salvaciones de muerte de D&D 5e (2014):
-- al acumular 3 caídas el personaje pierde la expedición,
-- se retira al Nexo y carga puntos de cansancio.
-- Las caídas solo se limpian con un descanso largo (pagar posada).
-- ============================================================

BEGIN;

ALTER TABLE public.personajes
  ADD COLUMN IF NOT EXISTS caidas INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personajes_caidas_rango'
  ) THEN
    ALTER TABLE public.personajes
      ADD CONSTRAINT personajes_caidas_rango CHECK (caidas >= 0 AND caidas <= 3);
  END IF;
END $$;

-- Marca al participante que perdió la expedición (3 caídas): se retira
-- al Nexo pero NO muere — distinto de partida_participantes.muerto.
ALTER TABLE public.partida_participantes
  ADD COLUMN IF NOT EXISTS derrotado BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
