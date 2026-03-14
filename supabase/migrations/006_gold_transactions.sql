-- ============================================================
-- MEA CULPA — Migración 006
-- Tabla de transacciones de oro + función RPC actualizada.
--
-- ¿Por qué es necesaria esta migración?
-- 1. Trazabilidad: registra cada cambio de oro con motivo y contexto.
-- 2. Auditoría: admins pueden revisar el historial de cualquier usuario.
-- 3. Anti-trampa: al centralizar el movimiento de oro en la función RPC
--    y logear cada operación, cualquier manipulación queda registrada.
-- ============================================================

-- ============================================================
-- 1. TABLA transacciones_oro
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transacciones_oro (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID        NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  delta         INT         NOT NULL,                  -- + ganar, - gastar
  balance_after INT         NOT NULL CHECK (balance_after >= 0),
  concepto      TEXT        NOT NULL DEFAULT 'sistema', -- 'compra_tienda', 'recompensa_mision', 'admin', etc.
  referencia_id UUID,                                   -- item_id, mision_id, etc. (opcional)
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para queries por usuario (el caso de uso más común)
CREATE INDEX IF NOT EXISTS idx_transacciones_oro_usuario
  ON public.transacciones_oro (usuario_id, creado_en DESC);

-- ============================================================
-- 2. RLS — solo lectura para el propietario, sin escritura directa
-- ============================================================
ALTER TABLE public.transacciones_oro ENABLE ROW LEVEL SECURITY;

-- El usuario autenticado solo pode ver sus propias transacciones
CREATE POLICY transacciones_select ON public.transacciones_oro
  FOR SELECT
  USING (auth.uid() = usuario_id);

-- No se crean políticas INSERT/UPDATE/DELETE:
-- el cliente nunca puede escribir en esta tabla directamente.

-- ============================================================
-- 3. FUNCIÓN RPC modificar_oro (reemplaza la versión anterior)
--    Ahora también registra la transacción en el log.
-- ============================================================

-- Eliminar la firma anterior (2 params) para evitar ambigüedades
DROP FUNCTION IF EXISTS public.modificar_oro(UUID, INT);

CREATE OR REPLACE FUNCTION public.modificar_oro(
  p_usuario_id UUID,
  p_delta      INT,
  p_concepto   TEXT DEFAULT 'sistema',
  p_referencia UUID DEFAULT NULL
)
RETURNS INT        -- devuelve el nuevo saldo
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

  -- Registrar la transacción
  INSERT INTO transacciones_oro (usuario_id, delta, balance_after, concepto, referencia_id)
  VALUES (p_usuario_id, p_delta, v_nuevo_oro, p_concepto, p_referencia);

  RETURN v_nuevo_oro;
END;
$$;

-- Solo service_role puede ejecutar esta función
REVOKE EXECUTE ON FUNCTION public.modificar_oro(UUID, INT, TEXT, UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.modificar_oro(UUID, INT, TEXT, UUID) TO service_role;
