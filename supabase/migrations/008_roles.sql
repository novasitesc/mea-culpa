-- ============================================================
-- MEA CULPA — Migración 008
-- Sistema de roles de cuenta: usuario / admin / super_admin
--
-- `rol`         = rol NARRATIVO/de juego (texto libre, ej: "Dungeon Explorer")
-- `es_admin`    = flag binario; da acceso al panel de administración
-- `rol_sistema` = tier de cuenta: 'usuario', 'admin', 'super_admin'
--
-- SEGURIDAD:
--   - La migración 005 eliminó TODOS los UPDATE policies de `perfiles`,
--     por lo que ningún cliente autenticado puede modificar estas columnas
--     directamente. Solo el backend (service_role) puede hacerlo.
--   - La función `set_rol_sistema` está REVOCADA de anon y authenticated,
--     y solo service_role puede ejecutarla.
-- ============================================================

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS es_admin    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rol_sistema TEXT    NOT NULL DEFAULT 'usuario'
    CHECK (rol_sistema IN ('usuario', 'admin', 'super_admin'));

-- ──────────────────────────────────────────────────────────────
-- Función auxiliar: saber si el usuario actual es admin.
-- Se usa como helper en RLS de otras tablas sin causar recursión.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_es_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT es_admin FROM perfiles WHERE id = auth.uid()),
    false
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- Función de gestión: promover / degradar usuario.
-- Solo service_role puede ejecutarla (backend). Sincroni za
-- ambas columnas automáticamente para mantener consistencia.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_rol_sistema(
  p_usuario_id UUID,
  p_rol_sistema TEXT   -- 'usuario' | 'admin' | 'super_admin'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_rol_sistema NOT IN ('usuario', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Rol de sistema inválido: %', p_rol_sistema;
  END IF;

  UPDATE perfiles
  SET
    es_admin    = (p_rol_sistema IN ('admin', 'super_admin')),
    rol_sistema = p_rol_sistema
  WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_usuario_id;
  END IF;
END;
$$;

-- Bloquear ejecución por clientes directos; solo el backend la invoca
REVOKE EXECUTE ON FUNCTION public.set_rol_sistema(UUID, TEXT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_rol_sistema(UUID, TEXT) TO service_role;
