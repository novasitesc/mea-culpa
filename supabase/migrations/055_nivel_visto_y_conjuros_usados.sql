-- ============================================================
-- MEA CULPA - Migracion 055
-- 1) personajes.nivel_visto: ultimo nivel total que el jugador ya
--    vio celebrado. El DM sube niveles desde el panel; la animacion
--    de ascenso se dispara cuando nivel_total > nivel_visto y se
--    marca al terminar, asi se ve una sola vez y en cualquier equipo.
-- 2) personajes.conjuros_usados: nombres de conjuros gastados.
--    Un descanso largo los devuelve todos (D&D 5e 2014, PHB p.186).
-- ============================================================

BEGIN;

ALTER TABLE public.personajes
  ADD COLUMN IF NOT EXISTS nivel_visto INT NOT NULL DEFAULT 0;

ALTER TABLE public.personajes
  ADD COLUMN IF NOT EXISTS conjuros_usados JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: los personajes existentes ya "vieron" su nivel actual, de lo
-- contrario la animacion se dispararia para todos en el proximo login.
UPDATE public.personajes p
SET nivel_visto = COALESCE(
  (SELECT SUM(c.nivel) FROM public.clases_personaje c WHERE c.personaje_id = p.id),
  1
)
WHERE nivel_visto = 0;

COMMIT;
