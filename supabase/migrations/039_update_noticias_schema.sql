-- Actualizar tabla noticias para hacer imagen_url e imagen_path opcionales
-- y agregar RLS con policies para admins.

-- Verificar si la tabla existe y tiene las columnas correctas
DO $$
BEGIN
    -- Verificar si la tabla existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'noticias') THEN
        RAISE EXCEPTION 'La tabla noticias no existe. Asegúrate de que la migración 038_noticias.sql se haya aplicado correctamente.';
    END IF;

    -- Verificar si las columnas existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'noticias' AND column_name = 'imagen_url') THEN
        RAISE EXCEPTION 'La columna imagen_url no existe en la tabla noticias.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'noticias' AND column_name = 'imagen_path') THEN
        RAISE EXCEPTION 'La columna imagen_path no existe en la tabla noticias.';
    END IF;
END $$;

-- Cambiar columnas a nullable solo si son NOT NULL
ALTER TABLE noticias ALTER COLUMN imagen_url DROP NOT NULL;
ALTER TABLE noticias ALTER COLUMN imagen_path DROP NOT NULL;

-- Habilitar RLS
ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;

-- Eliminar policies existentes si existen
DROP POLICY IF EXISTS noticias_select ON noticias;
DROP POLICY IF EXISTS noticias_insert ON noticias;
DROP POLICY IF EXISTS noticias_update ON noticias;
DROP POLICY IF EXISTS noticias_delete ON noticias;

-- Policy para SELECT: usuarios normales ven solo visibles, admins ven todas
CREATE POLICY noticias_select ON noticias FOR SELECT
USING (
  visible = true OR public.current_user_es_admin()
);

-- Policy para INSERT: solo admins
CREATE POLICY noticias_insert ON noticias FOR INSERT
WITH CHECK (public.current_user_es_admin());

-- Policy para UPDATE: solo admins
CREATE POLICY noticias_update ON noticias FOR UPDATE
USING (public.current_user_es_admin())
WITH CHECK (public.current_user_es_admin());

-- Policy para DELETE: solo admins
CREATE POLICY noticias_delete ON noticias FOR DELETE
USING (public.current_user_es_admin());