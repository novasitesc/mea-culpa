-- ============================================================
-- MEA CULPA — Migración 003
-- Agrega el campo `oro` a la tabla `perfiles`.
-- ============================================================

ALTER TABLE public.perfiles
  ADD COLUMN oro INT NOT NULL DEFAULT 0 CHECK (oro >= 0);

-- Actualizar el trigger de creación de perfil para incluir oro
CREATE OR REPLACE FUNCTION crear_perfil_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol, nivel, hogar, oro)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'Dungeon Explorer',
    1,
    'Sin hogar',
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
