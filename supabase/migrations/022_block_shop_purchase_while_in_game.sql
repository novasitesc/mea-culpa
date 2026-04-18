-- ============================================================
-- MEA CULPA - Migracion 022
-- Bloquear compras en tienda para personajes en partida abierta
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.comprar_en_tienda(
  p_usuario_id   UUID,
  p_personaje_id BIGINT,
  p_items        JSONB
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
  v_i             INT;
BEGIN
  -- 1. Verificar que el personaje pertenece al usuario
  SELECT capacidad_bolsa INTO v_bag_capacity
  FROM   personajes
  WHERE  id = p_personaje_id AND usuario_id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personaje no encontrado o no pertenece al usuario';
  END IF;

  -- 2. Bloquear compras si el personaje esta en una partida abierta
  IF EXISTS (
    SELECT 1
    FROM public.partida_participantes pp
    JOIN public.partidas p ON p.id = pp.partida_id
    WHERE pp.personaje_id = p_personaje_id
      AND p.estado = 'abierta'
  ) THEN
    RAISE EXCEPTION 'No puedes comprar en tienda mientras el personaje esta en una partida abierta';
  END IF;

  -- 3. Validar stock y calcular costo total
  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para articulo %', v_articulo_id;
    END IF;

    SELECT o.precio, at.inventario, at.objeto_id, o.tipo_item
    INTO   v_precio, v_stock, v_obj_id, v_tipo_item
    FROM   articulos_tienda at
    INNER JOIN objetos o ON o.id = at.objeto_id
    WHERE  at.id = v_articulo_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Articulo % no encontrado en ninguna tienda', v_articulo_id;
    END IF;

    -- NULL = stock ilimitado; solo validar cuando es finito
    IF v_stock IS NOT NULL AND v_stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para articulo %', v_articulo_id;
    END IF;

    v_total_costo := v_total_costo + v_precio * v_qty;
  END LOOP;

  -- 4. Verificar oro suficiente
  IF NOT EXISTS (
    SELECT 1 FROM perfiles WHERE id = p_usuario_id AND oro >= v_total_costo
  ) THEN
    RAISE EXCEPTION 'Oro insuficiente';
  END IF;

  -- 5 y 6. Reducir stock e insertar en bolsa
  FOR v_elem IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_articulo_id := (v_elem->>'articulo_tienda_id')::BIGINT;
    v_qty         := (v_elem->>'qty')::INT;

    SELECT at.inventario, at.objeto_id, o.tipo_item
    INTO   v_stock, v_obj_id, v_tipo_item
    FROM   articulos_tienda at
    INNER JOIN objetos o ON o.id = at.objeto_id
    WHERE  at.id = v_articulo_id;

    -- Reducir stock si es finito
    IF v_stock IS NOT NULL THEN
      UPDATE articulos_tienda
        SET inventario = inventario - v_qty
      WHERE id = v_articulo_id;
    END IF;

    -- Si es consumible: usar stacking
    -- Si no es consumible: crear una entrada por unidad
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
          RAISE EXCEPTION 'Bolsa llena: capacidad maxima de % slots alcanzada para este personaje',
            v_bag_capacity;
        END IF;

        SELECT COALESCE(MAX(orden), -1) + 1 INTO v_next_orden
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        INSERT INTO bolsa_objetos (personaje_id, objeto_id, cantidad, orden)
        VALUES (p_personaje_id, v_obj_id, v_qty, v_next_orden);
      END IF;
    ELSE
      -- No es consumible: crear una entrada por cada unidad
      FOR v_i IN 1..v_qty LOOP
        -- Verificar capacidad de bolsa antes de cada insert
        SELECT COUNT(*) INTO v_bag_count
        FROM   bolsa_objetos
        WHERE  personaje_id = p_personaje_id;

        IF v_bag_count >= v_bag_capacity THEN
          RAISE EXCEPTION 'Bolsa llena: capacidad maxima de % slots alcanzada para este personaje',
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

  -- 7. Descontar oro y registrar transaccion
  SELECT modificar_oro(p_usuario_id, -v_total_costo, 'compra_tienda', NULL)
  INTO v_nuevo_oro;

  RETURN json_build_object('oro', v_nuevo_oro);
END;
$$;

COMMIT;
