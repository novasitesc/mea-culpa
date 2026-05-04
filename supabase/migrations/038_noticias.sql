-- Tabla de noticias para la gestión en el home.
-- Cada noticia tiene visibilidad, título, contenido y ruta de imagen en Supabase Storage.

CREATE TABLE IF NOT EXISTS noticias (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo text NOT NULL,
  contenido text NOT NULL,
  imagen_url text NOT NULL,
  imagen_path text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE FUNCTION update_noticias_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER noticias_updated_at
BEFORE UPDATE ON noticias
FOR EACH ROW
EXECUTE FUNCTION update_noticias_updated_at();
