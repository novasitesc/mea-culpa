-- ============================================================
-- MEA CULPA — Migración 007
-- Función RPC atómica para comprar en tiendas.
--
-- Todo sucede en una sola transacción:
--   1. Verificar que el personaje pertenece al usuario.
--   2. Validar stock de cada artículo.
--   3. Verificar que el usuario tiene oro suficiente.
--   4. Reducir stock en articulos_tienda.
--   5. Añadir objetos a bolsa_objetos:
--      · CONSUMIBLES: se apilan (stacking) en una entrada con cantidad = n
--      · NO CONSUMIBLES: se crean n entradas separadas, cada una con cantidad = 1
--   6. Descontar oro vía modificar_oro (que además registra la transacción).
--
-- Si cualquier paso falla, TODA la operación se revierte (ROLLBACK).
-- ============================================================

CREATE OR REPLACE FUNCTION public.comprar_en_tienda(
  p_usuario_id   UUID,
  p_personaje_id BIGINT,
  p_items        JSONB   -- [{articulo_tienda_id: BIGINT, qty: INT}]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_elem          JSONB;
  v_articulo_id   BIGINT;
  v_qty           INT;
  v_precio        INT;
  v_stock         INT;
  v_obj_id        BIGINT;
  v_tipo_item     TEXT;
  v_total_costo   INT := 0;
  v_nuevo_oro     INT;
  v_existing_id   BIGINT;
  v_next_orden    INT;
  v_bag_count     INT;
  v_bag_capacity  INT;
  v_i              INT;
BEGIN
  -- ── 1. Verificar que el personaje pertenece al usuario ──────────────────
  SELECT capacidad_bolsa INTO v_bag_capacity
  FROM   personajes
  WHERE  id = p_personaje_id AND usuario_id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  -- ── 2. Validar stock y calcular costo total ─────────────────────────────
  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para artículo %', v_articulo_id;
    END IF;

    SELECT at.precio, at.inventario, at.objeto_id, o.tipo_item
    INTO   v_precio, v_stock, v_obj_id, v_tipo_item
    FROM   articulos_tienda at
    INNER JOIN objetos o ON at.objeto_id = o.id
    WHERE  at.id = v_articulo_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Artículo % no encontrado en ninguna tienda', v_articulo_id;
    END IF;

    -- NULL = stock ilimitado; solo validar cuando es finito
    IF v_stock IS NOT NULL AND v_stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para artículo %', v_articulo_id;
    END IF;

    v_total_costo := v_total_costo + v_precio * v_qty;
  END LOOP;

  -- ── 3. Verificar oro suficiente ─────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM perfiles WHERE id = p_usuario_id AND oro >= v_total_costo
  ) THEN
    RAISE EXCEPTION 'Oro insuficiente';
  END IF;

  -- ── 4 & 5. Reducir stock e insertar en bolsa ────────────────────────────
  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    SELECT at.precio, at.inventario, at.objeto_id, o.tipo_item
    INTO   v_precio, v_stock, v_obj_id, v_tipo_item
    FROM   articulos_tienda at
    INNER JOIN objetos o ON at.objeto_id = o.id
    WHERE  at.id = v_articulo_id;

    -- Reducir stock si es finito
    IF v_stock IS NOT NULL THEN
      UPDATE articulos_tienda
        SET inventario = inventario - v_qty
      WHERE id = v_articulo_id;
    END IF;

    -- Si es CONSUMIBLE: usar stacking (una entrada con cantidad = n)
    -- Si NO es consumible: crear una entrada por cada unidad (n entradas con cantidad = 1)
    IF v_tipo_item = 'consumible' THEN
      SELECT id INTO v_existing_id
      FROM   bolsa_objetos
      WHERE  personaje_id = p_personaje_id AND objeto_id = v_obj_id;

      IF FOUND THEN
        UPDATE bolsa_objetos
          SET cantidad = cantidad + v_qty
        WHERE id = v_existing_id;
      ELSE
        -- Verificar capacidad de bolsa antes de ocupar un nuevo slot
        SELECT COUNT(*) INTO v_bag_count
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        IF v_bag_count >= v_bag_capacity THEN
          RAISE EXCEPTION 'Bolsa llena: capacidad máxima de % slots alcanzada para este personaje',
            v_bag_capacity;
        END IF;

        SELECT COALESCE(MAX(orden), -1) + 1 INTO v_next_orden
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        INSERT INTO bolsa_objetos (personaje_id, objeto_id, cantidad, orden)
        VALUES (p_personaje_id, v_obj_id, v_qty, v_next_orden);
      END IF;
    ELSE
      -- NO es consumible: crear una entrada por cada unidad
      FOR v_i IN 1..v_qty LOOP
        -- Verificar capacidad de bolsa antes de cada insert
        SELECT COUNT(*) INTO v_bag_count
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        IF v_bag_count >= v_bag_capacity THEN
          RAISE EXCEPTION 'Bolsa llena: capacidad máxima de % slots alcanzada para este personaje',
            v_bag_capacity;
        END IF;

        SELECT COALESCE(MAX(orden), -1) + 1 INTO v_next_orden
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        INSERT INTO bolsa_objetos (personaje_id, objeto_id, cantidad, orden)
        VALUES (p_personaje_id, v_obj_id, 1, v_next_orden);
      END LOOP;
    END IF;
  END LOOP;

  -- ── 6. Descontar oro y registrar transacción ────────────────────────────
  SELECT modificar_oro(p_usuario_id, -v_total_costo, 'compra_tienda', NULL)
  INTO v_nuevo_oro;

  RETURN json_build_object('oro', v_nuevo_oro);
END;
$$;

-- Solo el backend (service_role) puede llamar a esta función
REVOKE EXECUTE ON FUNCTION public.comprar_en_tienda(UUID, BIGINT, JSONB) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.comprar_en_tienda(UUID, BIGINT, JSONB) TO service_role;
