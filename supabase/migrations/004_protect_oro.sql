-- ============================================================
-- MEA CULPA — Migración 004
-- Protege el campo `oro` contra modificación directa por el cliente.
-- El oro solo puede ser modificado desde el servidor (service_role)
-- o a través de la función RPC segura `modificar_oro`.
-- ============================================================

-- 1. Reemplazar la política de UPDATE de perfiles para que el cliente
--    NO pueda tocar las columnas económicas (oro, nivel, rol).
--    PostgreSQL no soporta "column-level" en RLS policies directamente,
--    así que usamos un CHECK que verifica que esas columnas no cambien.
DROP POLICY IF EXISTS perfiles_update ON perfiles;

CREATE POLICY perfiles_update ON perfiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- El cliente solo puede cambiar nombre y hogar.
    -- oro, nivel y rol deben mantenerse igual al valor actual.
    AND oro   = (SELECT oro   FROM perfiles WHERE id = auth.uid())
    AND nivel = (SELECT nivel FROM perfiles WHERE id = auth.uid())
    AND rol   = (SELECT rol   FROM perfiles WHERE id = auth.uid())
  );

-- 2. Función RPC para modificar oro desde el servidor (service_role).
--    Solo el backend puede llamar a esta función de forma efectiva,
--    ya que el cliente anon/authenticated es bloqueado por el CHECK anterior.
CREATE OR REPLACE FUNCTION modificar_oro(
  p_usuario_id UUID,
  p_delta      INT   -- positivo = ganar oro, negativo = gastar oro
)
RETURNS INT  -- devuelve el nuevo saldo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nuevo_oro INT;
BEGIN
  UPDATE perfiles
    SET oro = oro + p_delta
  WHERE id = p_usuario_id
    AND (oro + p_delta) >= 0  -- nunca oro negativo
  RETURNING oro INTO v_nuevo_oro;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oro insuficiente o usuario no encontrado';
  END IF;

  RETURN v_nuevo_oro;
END;
$$;

-- Solo service_role puede ejecutar esta función desde fuera.
-- Los roles anon/authenticated quedan revocados.
REVOKE EXECUTE ON FUNCTION modificar_oro(UUID, INT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION modificar_oro(UUID, INT) TO service_role;
