-- ============================================================
-- MEA CULPA - Migracion 035
-- Permitir tiradas de categoria 'nada' sin premio entregable
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ruleta_registrar_tirada(
  p_usuario_id UUID,
  p_slot SMALLINT,
  p_categoria TEXT,
  p_premio_pool_id UUID,
  p_premio_tipo TEXT,
  p_premio_label TEXT,
  p_premio_oro_monto INT,
  p_premio_objeto_id BIGINT,
  p_premio_objeto_cantidad INT,
  p_costo_tipo TEXT,
  p_costo_monto INT,
  p_ciclo_numero SMALLINT,
  p_cobro_pendiente BOOLEAN DEFAULT false
)
RETURNS TABLE (
  tirada_id UUID,
  oro_resultante INT,
  cobro_pendiente BOOLEAN,
  entregado_a_personaje_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tirada_id UUID;
  v_nuevo_oro INT;
  v_personaje_id BIGINT;
  v_personaje_nombre TEXT;
  v_capacidad_bolsa INT;
  v_bolsa_total INT;
  v_row_id BIGINT;
  v_target_order INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ruleta_configuracion
    WHERE id = 1 AND habilitada = true
  ) THEN
    RAISE EXCEPTION 'Ruleta deshabilitada';
  END IF;

  IF p_slot < 1 OR p_slot > 100 THEN
    RAISE EXCEPTION 'Slot invalido';
  END IF;

  IF p_categoria NOT IN ('jackpot', 'muy_grande', 'nada', 'grande', 'mediano', 'pequeno') THEN
    RAISE EXCEPTION 'Categoria invalida';
  END IF;

  IF p_costo_tipo NOT IN ('oro', 'usd') THEN
    RAISE EXCEPTION 'Tipo de costo invalido';
  END IF;

  IF p_ciclo_numero < 1 OR p_ciclo_numero > 6 THEN
    RAISE EXCEPTION 'Ciclo invalido';
  END IF;

  IF p_costo_monto <= 0 THEN
    RAISE EXCEPTION 'Costo invalido';
  END IF;

  IF p_categoria <> 'nada' THEN
    IF p_premio_tipo NOT IN ('oro', 'objeto') THEN
      RAISE EXCEPTION 'Tipo de premio invalido';
    END IF;

    IF p_premio_tipo = 'oro' AND COALESCE(p_premio_oro_monto, 0) <= 0 THEN
      RAISE EXCEPTION 'Monto de premio invalido';
    END IF;

    IF p_premio_tipo = 'objeto' AND (p_premio_objeto_id IS NULL OR COALESCE(p_premio_objeto_cantidad, 0) <= 0) THEN
      RAISE EXCEPTION 'Premio de objeto invalido';
    END IF;
  ELSE
    IF p_premio_oro_monto IS NOT NULL OR p_premio_objeto_id IS NOT NULL THEN
      RAISE EXCEPTION 'La categoria nada no puede otorgar premio';
    END IF;
  END IF;

  INSERT INTO public.ruleta_tiradas (
    usuario_id,
    slot,
    categoria,
    premio_pool_id,
    premio_tipo,
    premio_label,
    premio_oro_monto,
    premio_objeto_id,
    premio_objeto_cantidad,
    pago_tipo,
    pago_monto,
    costo_tipo,
    costo_monto,
    ciclo_numero,
    cobro_pendiente,
    entregado_en
  )
  VALUES (
    p_usuario_id,
    p_slot,
    p_categoria,
    p_premio_pool_id,
    p_premio_tipo,
    COALESCE(NULLIF(BTRIM(p_premio_label), ''), CASE WHEN p_categoria = 'nada' THEN 'Sin premio' ELSE 'Premio' END),
    p_premio_oro_monto,
    p_premio_objeto_id,
    COALESCE(p_premio_objeto_cantidad, 0),
    p_costo_tipo,
    p_costo_monto,
    p_costo_tipo,
    p_costo_monto,
    p_ciclo_numero,
    p_cobro_pendiente,
    now()
  )
  RETURNING id INTO v_tirada_id;

  IF p_costo_tipo = 'oro' THEN
    SELECT public.modificar_oro(
      p_usuario_id,
      -p_costo_monto,
      'ruleta_spin:' || p_categoria,
      v_tirada_id
    )
    INTO v_nuevo_oro;
  ELSE
    SELECT oro
    INTO v_nuevo_oro
    FROM public.perfiles
    WHERE id = p_usuario_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Usuario no encontrado';
    END IF;
  END IF;

  IF p_categoria = 'nada' THEN
    UPDATE public.ruleta_tiradas
    SET entregado_en = now()
    WHERE id = v_tirada_id;
  ELSIF p_premio_tipo = 'oro' THEN
    SELECT public.modificar_oro(
      p_usuario_id,
      p_premio_oro_monto,
      'ruleta_premio:' || p_categoria,
      v_tirada_id
    )
    INTO v_nuevo_oro;

    UPDATE public.ruleta_tiradas
    SET entregado_en = now()
    WHERE id = v_tirada_id;
  ELSE
    SELECT p.id, p.nombre, p.capacidad_bolsa
    INTO v_personaje_id, v_personaje_nombre, v_capacidad_bolsa
    FROM public.personajes p
    WHERE p.usuario_id = p_usuario_id
      AND p.estado_vida = 'vivo'
    ORDER BY p.numero_slot ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No hay un personaje vivo para recibir el premio';
    END IF;

    SELECT COUNT(*)
    INTO v_bolsa_total
    FROM public.bolsa_objetos
    WHERE personaje_id = v_personaje_id;

    IF EXISTS (
      SELECT 1
      FROM public.bolsa_objetos
      WHERE personaje_id = v_personaje_id
        AND objeto_id = p_premio_objeto_id
        AND COALESCE(publicado_en_trade, false) = false
        AND COALESCE(fue_comerciado, false) = false
      ORDER BY orden ASC
      LIMIT 1
    ) THEN
      SELECT id
      INTO v_row_id
      FROM public.bolsa_objetos
      WHERE personaje_id = v_personaje_id
        AND objeto_id = p_premio_objeto_id
        AND COALESCE(publicado_en_trade, false) = false
        AND COALESCE(fue_comerciado, false) = false
      ORDER BY orden ASC
      LIMIT 1;

      UPDATE public.bolsa_objetos
      SET cantidad = cantidad + p_premio_objeto_cantidad
      WHERE id = v_row_id;
    ELSE
      IF v_bolsa_total >= v_capacidad_bolsa THEN
        RAISE EXCEPTION 'La bolsa del personaje esta llena';
      END IF;

      SELECT COALESCE(MAX(orden), 0) + 1
      INTO v_target_order
      FROM public.bolsa_objetos
      WHERE personaje_id = v_personaje_id;

      INSERT INTO public.bolsa_objetos (
        personaje_id,
        objeto_id,
        cantidad,
        orden,
        fue_comerciado,
        publicado_en_trade
      )
      VALUES (
        v_personaje_id,
        p_premio_objeto_id,
        p_premio_objeto_cantidad,
        v_target_order,
        false,
        false
      )
      RETURNING id INTO v_row_id;
    END IF;

    UPDATE public.ruleta_tiradas
    SET entregado_a_personaje_id = v_personaje_id,
        entregado_a_personaje_nombre = v_personaje_nombre,
        entregado_en = now()
    WHERE id = v_tirada_id;
  END IF;

  UPDATE public.ruleta_tiradas
  SET oro_resultante = v_nuevo_oro
  WHERE id = v_tirada_id;

  RETURN QUERY
  SELECT v_tirada_id, v_nuevo_oro, p_cobro_pendiente, v_personaje_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ruleta_registrar_tirada(
  UUID,
  SMALLINT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  INT,
  BIGINT,
  INT,
  TEXT,
  INT,
  SMALLINT,
  BOOLEAN
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ruleta_registrar_tirada(
  UUID,
  SMALLINT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  INT,
  BIGINT,
  INT,
  TEXT,
  INT,
  SMALLINT,
  BOOLEAN
) TO service_role;

COMMIT;
