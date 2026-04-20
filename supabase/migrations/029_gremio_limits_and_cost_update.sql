-- ============================================================
-- MEA CULPA - Migracion 029
-- Gremios: costo de creacion 100, limites base para ampliaciones
-- ============================================================

-- 1) Actualizar costo de creacion de gremio a 100 oro.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gremios_costo_creacion_oro_check'
      AND conrelid = 'public.gremios'::regclass
  ) THEN
    ALTER TABLE public.gremios
      DROP CONSTRAINT gremios_costo_creacion_oro_check;
  END IF;
END $$;

ALTER TABLE public.gremios
  ALTER COLUMN costo_creacion_oro SET DEFAULT 100;

ALTER TABLE public.gremios
  ADD CONSTRAINT ck_gremios_costo_creacion_oro_100
  CHECK (costo_creacion_oro = 100);

UPDATE public.gremios
SET costo_creacion_oro = 100
WHERE costo_creacion_oro <> 100;

-- 2) Agregar limites base para permitir ampliaciones pagadas en el futuro.
ALTER TABLE public.gremios
  ADD COLUMN IF NOT EXISTS limite_integrantes INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS limite_baul_items INT NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_gremios_limite_integrantes_min_1'
      AND conrelid = 'public.gremios'::regclass
  ) THEN
    ALTER TABLE public.gremios
      ADD CONSTRAINT ck_gremios_limite_integrantes_min_1
      CHECK (limite_integrantes >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_gremios_limite_baul_items_min_1'
      AND conrelid = 'public.gremios'::regclass
  ) THEN
    ALTER TABLE public.gremios
      ADD CONSTRAINT ck_gremios_limite_baul_items_min_1
      CHECK (limite_baul_items >= 1);
  END IF;
END $$;

UPDATE public.gremios
SET limite_integrantes = 10
WHERE limite_integrantes IS NULL OR limite_integrantes < 1;

UPDATE public.gremios
SET limite_baul_items = 10
WHERE limite_baul_items IS NULL OR limite_baul_items < 1;

-- 3) Reemplazar RPC de creacion de gremio para cobrar 100 oro y persistir configuracion.
CREATE OR REPLACE FUNCTION public.crear_gremio_con_costo(
  p_usuario_id UUID,
  p_nombre TEXT,
  p_descripcion TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gremio_id BIGINT;
  v_oro INT;
  v_nombre_limpio TEXT;
BEGIN
  v_nombre_limpio := btrim(COALESCE(p_nombre, ''));

  IF v_nombre_limpio = '' OR length(v_nombre_limpio) < 3 THEN
    RAISE EXCEPTION 'El nombre del gremio debe tener al menos 3 caracteres';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.gremio_miembros gm
    WHERE gm.usuario_id = p_usuario_id
  ) THEN
    RAISE EXCEPTION 'Ya perteneces a un gremio';
  END IF;

  SELECT public.modificar_oro(
    p_usuario_id,
    -100,
    'creacion_gremio',
    NULL
  ) INTO v_oro;

  INSERT INTO public.gremios (
    nombre,
    descripcion,
    lider_usuario_id,
    costo_creacion_oro,
    limite_integrantes,
    limite_baul_items
  )
  VALUES (
    v_nombre_limpio,
    NULLIF(btrim(COALESCE(p_descripcion, '')), ''),
    p_usuario_id,
    100,
    10,
    10
  )
  RETURNING id INTO v_gremio_id;

  INSERT INTO public.gremio_miembros (gremio_id, usuario_id, rol)
  VALUES (v_gremio_id, p_usuario_id, 'lider');

  RETURN json_build_object(
    'gremioId', v_gremio_id,
    'nombre', v_nombre_limpio,
    'oro', v_oro,
    'limiteIntegrantes', 10,
    'limiteBaulItems', 10
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crear_gremio_con_costo(UUID, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_gremio_con_costo(UUID, TEXT, TEXT) TO service_role;

-- 4) RPC atomico para unirse al gremio respetando limite de integrantes.
CREATE OR REPLACE FUNCTION public.unirse_gremio_con_limite(
  p_usuario_id UUID,
  p_gremio_id BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite INT;
  v_count INT;
  v_member_id BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.gremio_miembros gm
    WHERE gm.usuario_id = p_usuario_id
  ) THEN
    RAISE EXCEPTION 'Ya perteneces a un gremio';
  END IF;

  SELECT g.limite_integrantes
  INTO v_limite
  FROM public.gremios g
  WHERE g.id = p_gremio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gremio no encontrado';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.gremio_miembros gm
  WHERE gm.gremio_id = p_gremio_id;

  IF v_count >= v_limite THEN
    RAISE EXCEPTION 'El gremio alcanzo el limite de integrantes';
  END IF;

  INSERT INTO public.gremio_miembros (gremio_id, usuario_id, rol)
  VALUES (p_gremio_id, p_usuario_id, 'integrante')
  RETURNING id INTO v_member_id;

  RETURN json_build_object(
    'id', v_member_id,
    'gremio_id', p_gremio_id,
    'rol', 'integrante',
    'miembrosCount', v_count + 1,
    'limiteIntegrantes', v_limite
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unirse_gremio_con_limite(UUID, BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unirse_gremio_con_limite(UUID, BIGINT) TO service_role;

-- 5) RPC atomico para depositar en baul respetando limite de items.
CREATE OR REPLACE FUNCTION public.depositar_gremio_baul_con_limite(
  p_gremio_id BIGINT,
  p_objeto_id BIGINT,
  p_cantidad INT,
  p_depositante_usuario_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite INT;
  v_count INT;
  v_item_id BIGINT;
BEGIN
  IF p_objeto_id IS NULL OR p_objeto_id <= 0 THEN
    RAISE EXCEPTION 'Objeto invalido para deposito';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RAISE EXCEPTION 'Cantidad invalida para deposito';
  END IF;

  SELECT g.limite_baul_items
  INTO v_limite
  FROM public.gremios g
  WHERE g.id = p_gremio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gremio no encontrado';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.gremio_baul gb
  WHERE gb.gremio_id = p_gremio_id;

  IF v_count >= v_limite THEN
    RAISE EXCEPTION 'El baul del gremio alcanzo su limite de items';
  END IF;

  INSERT INTO public.gremio_baul (
    gremio_id,
    objeto_id,
    cantidad,
    depositante_usuario_id
  )
  VALUES (
    p_gremio_id,
    p_objeto_id,
    p_cantidad,
    p_depositante_usuario_id
  )
  RETURNING id INTO v_item_id;

  RETURN json_build_object(
    'id', v_item_id,
    'gremio_id', p_gremio_id,
    'objeto_id', p_objeto_id,
    'cantidad', p_cantidad,
    'baulCount', v_count + 1,
    'limiteBaulItems', v_limite
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.depositar_gremio_baul_con_limite(BIGINT, BIGINT, INT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.depositar_gremio_baul_con_limite(BIGINT, BIGINT, INT, UUID) TO service_role;
