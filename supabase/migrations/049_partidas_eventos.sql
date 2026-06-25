-- Tabla de log de eventos de partida
-- Persiste todos los eventos que ocurren durante una sesión:
-- tiradas de dado, asignaciones manuales, desmembramientos, inicio y cierre.
CREATE TABLE partidas_eventos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id       UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL,
  -- 'dado_tirado' | 'asignacion_manual' | 'desmembramiento' | 'partida_iniciada' | 'partida_cerrada'
  personaje_id     BIGINT REFERENCES personajes(id) ON DELETE SET NULL,
  personaje_nombre TEXT,
  usuario_id       UUID  REFERENCES perfiles(id)   ON DELETE SET NULL,
  -- Dados
  tipo_dado        TEXT,
  recompensa_nombre TEXT,
  tipo_resultado   TEXT,
  -- Ítems
  objeto_id        TEXT,
  objeto_nombre    TEXT,
  objeto_icono     TEXT,
  cantidad         INTEGER,
  -- Oro
  cantidad_oro     INTEGER,
  -- Desmembramiento
  miembro          TEXT,
  miembro_label    TEXT,
  desmembrado      BOOLEAN,
  -- Datos extras del evento (ej: lutResultados completos)
  metadata         JSONB,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partidas_eventos_partida ON partidas_eventos(partida_id, creado_en);
CREATE INDEX idx_partidas_eventos_tipo    ON partidas_eventos(tipo);

ALTER TABLE partidas_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_partidas_eventos" ON partidas_eventos
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid()
        AND (es_admin = true OR rol_sistema = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid()
        AND (es_admin = true OR rol_sistema = 'admin')
    )
  );
