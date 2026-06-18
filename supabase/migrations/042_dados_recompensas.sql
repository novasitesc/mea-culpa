-- Módulo de Dados con Recompensas
-- Tres tipos: item_fijo, sublista, oro_dados
-- Seis tipos de dado: d4, d6, d8, d10, d12, d20

CREATE TABLE dados_recompensas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('item_fijo', 'sublista', 'oro_dados')),
  tipo_dado TEXT NOT NULL CHECK (tipo_dado IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20')),
  costo_oro INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  -- Para item_fijo: objeto que siempre se entrega
  objeto_id INTEGER REFERENCES objetos(id) ON DELETE SET NULL,
  -- Para oro_dados: cantidad de dados y multiplicador
  cantidad_dados INTEGER NOT NULL DEFAULT 1,
  multiplicador_oro INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dados_sublista_items (
  id SERIAL PRIMARY KEY,
  recompensa_id INTEGER NOT NULL REFERENCES dados_recompensas(id) ON DELETE CASCADE,
  objeto_id INTEGER NOT NULL REFERENCES objetos(id) ON DELETE CASCADE,
  valor_min INTEGER NOT NULL,
  valor_max INTEGER NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE dados_historial (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  recompensa_id INTEGER NOT NULL REFERENCES dados_recompensas(id),
  resultados_dados INTEGER[] NOT NULL,
  tipo_resultado TEXT NOT NULL CHECK (tipo_resultado IN ('item', 'oro')),
  objeto_id INTEGER REFERENCES objetos(id),
  cantidad_objeto INTEGER,
  cantidad_oro INTEGER,
  costo_pagado INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: solo el propio usuario puede ver su historial
ALTER TABLE dados_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven su propio historial de dados"
  ON dados_historial FOR SELECT
  USING (auth.uid() = usuario_id);

-- RLS: lectura pública de recompensas activas (para la homepage)
ALTER TABLE dados_recompensas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de recompensas activas"
  ON dados_recompensas FOR SELECT
  USING (activo = true);

ALTER TABLE dados_sublista_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de sublista items"
  ON dados_sublista_items FOR SELECT
  USING (true);
