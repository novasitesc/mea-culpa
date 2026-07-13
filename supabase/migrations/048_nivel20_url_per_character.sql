-- BUG-006: Migrar nivel20_url de perfiles (1 por cuenta) a personajes (1 por PJ)
-- Cada personaje tiene su propia ficha en nivel20.com que los admins necesitan
-- para verificar stats/equipamiento rápidamente.

BEGIN;

-- 1. Agregar columna nivel20_url a personajes
ALTER TABLE public.personajes
  ADD COLUMN IF NOT EXISTS nivel20_url TEXT;

-- 2. Agregar constraint de dominio (mismo que perfiles)
ALTER TABLE public.personajes
  DROP CONSTRAINT IF EXISTS personajes_nivel20_url_domain_check;

ALTER TABLE public.personajes
  ADD CONSTRAINT personajes_nivel20_url_domain_check
  CHECK (
    nivel20_url IS NULL
    OR nivel20_url ~* '^https?://([a-z0-9-]+\.)*nivel20\.com(:[0-9]+)?([/?#].*)?$'
  );

-- 3. Migrar datos existentes: copiar el nivel20_url del perfil al primer
--    personaje vivo del usuario (si existe)
UPDATE public.personajes p
SET nivel20_url = pr.nivel20_url
FROM public.perfiles pr
WHERE p.usuario_id = pr.id
  AND pr.nivel20_url IS NOT NULL
  AND p.id = (
    SELECT id FROM public.personajes
    WHERE usuario_id = pr.id
      AND (estado_vida IS NULL OR estado_vida NOT IN ('enterrado', 'eliminado'))
    ORDER BY numero_slot ASC
    LIMIT 1
  );

COMMIT;
