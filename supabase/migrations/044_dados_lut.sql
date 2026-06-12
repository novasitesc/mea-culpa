-- Módulo de Dados — LUT (Lookup Table)
-- Nuevos tipos: 'lut' (d20 con 20 caras configurables) y 'subtabla' (d20 sub-tabla de ítems)

-- 1. Extender CHECK de tipo en dados_recompensas
--    El nombre del constraint es generado automáticamente por PostgreSQL como dados_recompensas_tipo_check
ALTER TABLE dados_recompensas DROP CONSTRAINT IF EXISTS dados_recompensas_tipo_check;
ALTER TABLE dados_recompensas
  ADD CONSTRAINT dados_recompensas_tipo_check
  CHECK (tipo IN ('item_fijo', 'sublista', 'oro_dados', 'lut', 'subtabla'));

-- 2. Extender CHECK de tipo_resultado en dados_historial
ALTER TABLE dados_historial DROP CONSTRAINT IF EXISTS dados_historial_tipo_resultado_check;
ALTER TABLE dados_historial
  ADD CONSTRAINT dados_historial_tipo_resultado_check
  CHECK (tipo_resultado IN ('item', 'oro', 'nada', 'subtabla'));

-- 3. Caras individuales para recompensas de tipo='lut'
--    Cada fila representa una cara del d20 con su tipo de recompensa y parámetros
CREATE TABLE dados_lut_caras (
  id                SERIAL PRIMARY KEY,
  recompensa_id     INTEGER NOT NULL REFERENCES dados_recompensas(id) ON DELETE CASCADE,
  numero_cara       INTEGER NOT NULL CHECK (numero_cara BETWEEN 1 AND 20),
  tipo              TEXT NOT NULL CHECK (tipo IN ('oro', 'item', 'subtabla', 'nada')),
  -- campos para tipo='oro': tirar N dados de cierto tipo y multiplicar
  cantidad_dados    INTEGER,
  tipo_dado_oro     TEXT CHECK (tipo_dado_oro IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20')),
  multiplicador_oro INTEGER NOT NULL DEFAULT 1,
  -- campo para tipo='item': ítem específico a entregar
  objeto_id         INTEGER REFERENCES objetos(id) ON DELETE SET NULL,
  -- campo para tipo='subtabla': apunta a una dados_recompensas con tipo='subtabla'
  subtabla_id       INTEGER REFERENCES dados_recompensas(id) ON DELETE SET NULL,
  UNIQUE (recompensa_id, numero_cara)
);

-- 4. Caras individuales para recompensas de tipo='subtabla'
--    Cada fila es una cara del d20; objeto_id NULL = "nada"
CREATE TABLE dados_subtabla_caras (
  id            SERIAL PRIMARY KEY,
  recompensa_id INTEGER NOT NULL REFERENCES dados_recompensas(id) ON DELETE CASCADE,
  numero_cara   INTEGER NOT NULL CHECK (numero_cara BETWEEN 1 AND 20),
  objeto_id     INTEGER REFERENCES objetos(id) ON DELETE SET NULL,
  UNIQUE (recompensa_id, numero_cara)
);

-- 5. RLS: lectura pública (las mismas reglas que las demás tablas del módulo)
ALTER TABLE dados_lut_caras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de lut caras"
  ON dados_lut_caras FOR SELECT USING (true);

ALTER TABLE dados_subtabla_caras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de subtabla caras"
  ON dados_subtabla_caras FOR SELECT USING (true);
