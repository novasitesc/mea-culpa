-- ============================================================
-- MEA CULPA — Migración 009
-- Añadir admin_id a transacciones_oro y actualizar RPC
-- ============================================================

-- 1. Añadir el campo admin_id a la tabla transacciones_oro
ALTER TABLE public.transacciones_oro 
ADD COLUMN admin_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- 2. Eliminar la función RPC anterior para evitar colisiones
DROP FUNCTION IF EXISTS public.modificar_oro(UUID, INT, TEXT, UUID);

-- 3. Crear la nueva versión de modificar_oro con soporte para admin_id
CREATE OR REPLACE FUNCTION public.modificar_oro(
  p_usuario_id UUID,
  p_delta      INT,
  p_concepto   TEXT DEFAULT 'sistema',
  p_referencia UUID DEFAULT NULL,
  p_admin_id   UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nuevo_oro INT;
BEGIN
  -- Actualizar saldo (falla silenciosamente si quedara negativo)
  UPDATE perfiles
    SET oro = oro + p_delta
  WHERE id = p_usuario_id
    AND (oro + p_delta) >= 0
  RETURNING oro INTO v_nuevo_oro;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oro insuficiente o usuario no encontrado (delta=%, usuario=%)',
      p_delta, p_usuario_id;
  END IF;

  -- Registrar la transacción con el admin_id si se proporciona
  INSERT INTO transacciones_oro (usuario_id, delta, balance_after, concepto, referencia_id, admin_id)
  VALUES (p_usuario_id, p_delta, v_nuevo_oro, p_concepto, p_referencia, p_admin_id);

  RETURN v_nuevo_oro;
END;
$$;

-- Solo service_role puede ejecutar esta función
REVOKE EXECUTE ON FUNCTION public.modificar_oro(UUID, INT, TEXT, UUID, UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.modificar_oro(UUID, INT, TEXT, UUID, UUID) TO service_role;
