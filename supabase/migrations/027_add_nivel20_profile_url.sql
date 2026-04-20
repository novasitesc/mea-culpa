BEGIN;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS nivel20_url TEXT;

ALTER TABLE public.perfiles
  DROP CONSTRAINT IF EXISTS perfiles_nivel20_url_domain_check;

ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_nivel20_url_domain_check
  CHECK (
    nivel20_url IS NULL
    OR nivel20_url ~* '^https?://([a-z0-9-]+\.)*nivel20\.com(:[0-9]+)?([/?#].*)?$'
  );

COMMIT;
