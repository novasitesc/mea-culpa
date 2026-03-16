-- Limita el nivel de cuenta al rango 1..4.
-- 1: Aventuero Iniciado
-- 2: Aventurero Exprimentado
-- 3: Aventurero Maestro
-- 4: Aventurero Legenda

UPDATE public.perfiles
SET nivel = LEAST(GREATEST(nivel, 1), 4)
WHERE nivel < 1 OR nivel > 4;

ALTER TABLE public.perfiles
DROP CONSTRAINT IF EXISTS perfiles_nivel_check;

ALTER TABLE public.perfiles
ADD CONSTRAINT perfiles_nivel_check CHECK (nivel BETWEEN 1 AND 4);