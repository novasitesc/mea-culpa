-- ============================================================
-- MEA CULPA - Migracion 051
-- Agotamiento estilo D&D 5e (2014): puntos_cansancio con tope 6.
-- Un descanso largo reduce 1 nivel; rehusar el descanso suma 1
-- y al 6.º nivel el personaje muere de agotamiento.
-- ============================================================

BEGIN;

UPDATE public.personajes
  SET puntos_cansancio = LEAST(puntos_cansancio, 6)
  WHERE puntos_cansancio > 6;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personajes_cansancio_rango'
  ) THEN
    ALTER TABLE public.personajes
      ADD CONSTRAINT personajes_cansancio_rango CHECK (puntos_cansancio >= 0 AND puntos_cansancio <= 6);
  END IF;
END $$;

COMMIT;
