CREATE TABLE notas_usuario (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pagina INT NOT NULL DEFAULT 1 CHECK (pagina BETWEEN 1 AND 5),
  contenido TEXT NOT NULL DEFAULT '',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, pagina)
);

ALTER TABLE notas_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notas_own" ON notas_usuario
  FOR ALL USING (auth.uid() = usuario_id);
