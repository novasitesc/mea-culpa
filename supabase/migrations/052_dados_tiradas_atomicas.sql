-- ============================================================
-- MEA CULPA — Migración 052
-- Tiradas de dados atómicas e idempotentes.
-- dados_tiradas: 1 fila por tirada; roll_id (generado por el cliente) es PK →
-- reintentos/doble clic/refresh devuelven lo ya persistido sin re-cobrar.
-- La RPC dados_ejecutar_tirada aplica cobro + premios + registro en UNA
-- transacción (patrón comprar_en_tienda/modificar_oro). El azar se resuelve
-- en TS (lib/dice/engine.ts); aquí solo se aplican efectos ya resueltos.
-- ============================================================

CREATE TABLE dados_tiradas (
  roll_id       UUID PRIMARY KEY,
  contexto      TEXT NOT NULL CHECK (contexto IN ('personal', 'partida')),
  usuario_id    UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  personaje_id  BIGINT REFERENCES personajes(id) ON DELETE SET NULL,
  recompensa_id INTEGER NOT NULL,          -- sin FK: es log, la recompensa puede borrarse
  partida_id    UUID REFERENCES partidas(id) ON DELETE CASCADE,
  cantidad      INTEGER NOT NULL DEFAULT 1,
  costo_total   INTEGER NOT NULL DEFAULT 0,
  resultado     JSONB NOT NULL,            -- RollResult completo para reproducir tras refresh
  entregas      JSONB,                     -- [{objetoId, solicitada, entregada}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dados_tiradas_usuario ON dados_tiradas(usuario_id, created_at DESC);
-- RLS sin policies: solo service role lee/escribe (la API filtra por dueño).
ALTER TABLE dados_tiradas ENABLE ROW LEVEL SECURITY;

-- Permitir 'dado' como origen en el log de objetos.
-- Lista = unión de todo lo que escribe el código: 026 añadió 'comercio',
-- 028 añadió 'gremio', lib/asignarItem.ts escribe 'partida_sala'.
-- NOT VALID: solo valida filas nuevas, por si los datos históricos traen
-- algún valor fuera de esta lista (el esquema real ya divergió antes).
ALTER TABLE transacciones_objetos DROP CONSTRAINT IF EXISTS transacciones_objetos_origen_check;
ALTER TABLE transacciones_objetos ADD CONSTRAINT transacciones_objetos_origen_check
  CHECK (origen IN ('tienda', 'admin', 'drop', 'quest', 'comercio', 'gremio', 'partida_sala', 'dado'))
  NOT VALID;

-- Entrega a la bolsa (misma semántica que lib/asignarItem.ts: consumibles apilan,
-- no-consumibles 1 slot por unidad hasta llenar; devuelve lo realmente entregado).
-- ponytail: duplica la lógica de bolsa de asignarItem.ts a propósito — es el precio
-- de que la entrega viva DENTRO de la transacción; si divergen, unificar aquí.
CREATE OR REPLACE FUNCTION dados_entregar_item(
  p_personaje_id BIGINT, p_objeto_id BIGINT, p_cantidad INT
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_es_consumible BOOLEAN; v_capacidad INT; v_ocupados INT; v_libres INT;
  v_orden INT; v_existente_id BIGINT; v_entregada INT := 0;
BEGIN
  SELECT (tipo_item = 'consumible') INTO v_es_consumible FROM objetos WHERE id = p_objeto_id;
  IF v_es_consumible IS NULL THEN RETURN 0; END IF;

  -- lock del personaje: serializa entregas concurrentes a la misma bolsa
  SELECT capacidad_bolsa INTO v_capacidad FROM personajes WHERE id = p_personaje_id FOR UPDATE;
  IF v_capacidad IS NULL THEN RETURN 0; END IF;

  SELECT count(*) INTO v_ocupados FROM bolsa_objetos WHERE personaje_id = p_personaje_id;
  v_libres := GREATEST(0, v_capacidad - v_ocupados);
  SELECT COALESCE(MAX(orden), -1) INTO v_orden FROM bolsa_objetos WHERE personaje_id = p_personaje_id;

  IF v_es_consumible THEN
    SELECT id INTO v_existente_id FROM bolsa_objetos
     WHERE personaje_id = p_personaje_id AND objeto_id = p_objeto_id LIMIT 1;
    IF v_existente_id IS NOT NULL THEN
      UPDATE bolsa_objetos SET cantidad = cantidad + p_cantidad WHERE id = v_existente_id;
      v_entregada := p_cantidad;
    ELSIF v_libres > 0 THEN
      INSERT INTO bolsa_objetos (personaje_id, objeto_id, cantidad, orden)
      VALUES (p_personaje_id, p_objeto_id, p_cantidad, v_orden + 1);
      v_entregada := p_cantidad;
    END IF;
  ELSE
    v_entregada := LEAST(v_libres, p_cantidad);
    FOR i IN 1..v_entregada LOOP
      INSERT INTO bolsa_objetos (personaje_id, objeto_id, cantidad, orden)
      VALUES (p_personaje_id, p_objeto_id, 1, v_orden + i);
    END LOOP;
  END IF;

  IF v_entregada > 0 THEN
    INSERT INTO transacciones_objetos (personaje_id, objeto_id, origen, cantidad)
    VALUES (p_personaje_id, p_objeto_id, 'dado', v_entregada);
  END IF;
  RETURN v_entregada;
END; $$;

-- RPC principal: reclama roll_id + cobra + premia + registra, TODO en una transacción.
CREATE OR REPLACE FUNCTION dados_ejecutar_tirada(
  p_roll_id       UUID,
  p_contexto      TEXT,      -- 'personal' | 'partida'
  p_usuario_id    UUID,      -- quien paga/recibe oro
  p_personaje_id  BIGINT,    -- destino de ítems (NULL → no se entregan)
  p_recompensa_id INT,
  p_cantidad      INT,
  p_costo_total   INT,
  p_efectos       JSONB,     -- [{tipo:'oro',cantidad} | {tipo:'item',objetoId,cantidad}]
  p_resultado     JSONB,     -- RollResult completo (para replay)
  p_logs          JSONB,     -- filas de dados_historial o partidas_eventos
  p_partida_id    UUID DEFAULT NULL,
  p_admin_id      UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existente dados_tiradas%ROWTYPE;
  v_oro_total INT := 0; v_entregas JSONB := '[]'::jsonb;
  v_ef JSONB; v_entregada INT;
BEGIN
  INSERT INTO dados_tiradas (roll_id, contexto, usuario_id, personaje_id, recompensa_id,
                             partida_id, cantidad, costo_total, resultado)
  VALUES (p_roll_id, p_contexto, p_usuario_id, p_personaje_id, p_recompensa_id,
          p_partida_id, p_cantidad, p_costo_total, p_resultado)
  ON CONFLICT (roll_id) DO NOTHING;

  IF NOT FOUND THEN  -- roll_id repetido: devolver lo ya comprometido, sin re-aplicar nada
    SELECT * INTO v_existente FROM dados_tiradas WHERE roll_id = p_roll_id;
    RETURN jsonb_build_object('replayed', true, 'resultado', v_existente.resultado,
                              'entregas', COALESCE(v_existente.entregas, '[]'::jsonb));
  END IF;

  IF p_costo_total > 0 THEN  -- "Oro insuficiente" aborta todo, incluida la reclamación
    PERFORM modificar_oro(p_usuario_id, -p_costo_total, 'dado_costo', NULL, p_admin_id);
  END IF;

  FOR v_ef IN SELECT * FROM jsonb_array_elements(COALESCE(p_efectos, '[]'::jsonb)) LOOP
    IF v_ef->>'tipo' = 'oro' THEN
      v_oro_total := v_oro_total + COALESCE((v_ef->>'cantidad')::int, 0);
    ELSIF v_ef->>'tipo' = 'item' AND p_personaje_id IS NOT NULL THEN
      v_entregada := dados_entregar_item(p_personaje_id, (v_ef->>'objetoId')::bigint,
                                         COALESCE((v_ef->>'cantidad')::int, 1));
      v_entregas := v_entregas || jsonb_build_object(
        'objetoId', (v_ef->>'objetoId')::int,
        'solicitada', COALESCE((v_ef->>'cantidad')::int, 1),
        'entregada', v_entregada);
    END IF;
  END LOOP;

  IF v_oro_total > 0 THEN
    PERFORM modificar_oro(p_usuario_id, v_oro_total,
      CASE WHEN p_contexto = 'partida' THEN 'partida_sala:' || p_partida_id::text
           ELSE 'dado_recompensa_oro' END,
      p_partida_id, p_admin_id);
  END IF;

  IF p_contexto = 'personal' THEN
    INSERT INTO dados_historial (usuario_id, recompensa_id, resultados_dados, tipo_resultado,
                                 objeto_id, cantidad_objeto, cantidad_oro, costo_pagado)
    SELECT p_usuario_id, p_recompensa_id,
           ARRAY(SELECT jsonb_array_elements_text(l->'resultados_dados')::int),
           l->>'tipo_resultado', (l->>'objeto_id')::int, (l->>'cantidad_objeto')::int,
           (l->>'cantidad_oro')::int, COALESCE((l->>'costo_pagado')::int, 0)
    FROM jsonb_array_elements(COALESCE(p_logs, '[]'::jsonb)) AS l;
  ELSE
    INSERT INTO partidas_eventos (partida_id, tipo, personaje_id, personaje_nombre, usuario_id,
                                  tipo_dado, recompensa_nombre, tipo_resultado, objeto_id,
                                  objeto_nombre, objeto_icono, cantidad, cantidad_oro, metadata)
    SELECT p_partida_id, 'dado_tirado', p_personaje_id, l->>'personaje_nombre', p_usuario_id,
           l->>'tipo_dado', l->>'recompensa_nombre', l->>'tipo_resultado', l->>'objeto_id',
           l->>'objeto_nombre', l->>'objeto_icono', (l->>'cantidad')::int,
           (l->>'cantidad_oro')::int, l->'metadata'
    FROM jsonb_array_elements(COALESCE(p_logs, '[]'::jsonb)) AS l;
  END IF;

  UPDATE dados_tiradas SET entregas = v_entregas WHERE roll_id = p_roll_id;

  RETURN jsonb_build_object('replayed', false, 'resultado', p_resultado, 'entregas', v_entregas);
END; $$;

REVOKE EXECUTE ON FUNCTION dados_entregar_item(BIGINT, BIGINT, INT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION dados_entregar_item(BIGINT, BIGINT, INT) TO service_role;
REVOKE EXECUTE ON FUNCTION dados_ejecutar_tirada(UUID, TEXT, UUID, BIGINT, INT, INT, INT, JSONB, JSONB, JSONB, UUID, UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION dados_ejecutar_tirada(UUID, TEXT, UUID, BIGINT, INT, INT, INT, JSONB, JSONB, JSONB, UUID, UUID) TO service_role;
