-- ============================================================
-- MEA CULPA - Migracion 020
-- Limite maximo de nivel de clase por personaje = 20
-- ============================================================

BEGIN;

ALTER TABLE public.clases_personaje
  DROP CONSTRAINT IF EXISTS clases_personaje_nivel_check;

ALTER TABLE public.clases_personaje
  ADD CONSTRAINT clases_personaje_nivel_check
  CHECK (nivel BETWEEN 1 AND 20);

COMMIT;
