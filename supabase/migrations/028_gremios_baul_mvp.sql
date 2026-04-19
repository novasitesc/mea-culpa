-- ============================================================
-- MEA CULPA — Migracion 028
-- Gremios MVP: membresia, baul compartido y solicitudes
-- ============================================================

-- 1) Extender origenes validos para trazabilidad de objetos
ALTER TABLE public.transacciones_objetos
  DROP CONSTRAINT IF EXISTS transacciones_objetos_origen_check;

ALTER TABLE public.transacciones_objetos
  ADD CONSTRAINT transacciones_objetos_origen_check
  CHECK (origen IN ('tienda', 'admin', 'drop', 'quest', 'comercio', 'gremio'));

-- 2) Tabla principal de gremios
CREATE TABLE IF NOT EXISTS public.gremios (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre              TEXT NOT NULL,
  descripcion         TEXT,
  lider_usuario_id    UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  costo_creacion_oro  INT NOT NULL DEFAULT 500 CHECK (costo_creacion_oro = 500),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gremios_nombre_minimo CHECK (length(btrim(nombre)) >= 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gremios_nombre
  ON public.gremios ((lower(nombre)));

CREATE INDEX IF NOT EXISTS idx_gremios_lider
  ON public.gremios (lider_usuario_id);

DROP TRIGGER IF EXISTS trg_gremios_actualizado ON public.gremios;
CREATE TRIGGER trg_gremios_actualizado
  BEFORE UPDATE ON public.gremios
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

-- 3) Miembros del gremio (un usuario solo puede pertenecer a un gremio)
CREATE TABLE IF NOT EXISTS public.gremio_miembros (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gremio_id     BIGINT NOT NULL REFERENCES public.gremios(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  rol           TEXT NOT NULL DEFAULT 'integrante' CHECK (rol IN ('lider', 'integrante')),
  unido_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gremio_miembros_usuario_unico
  ON public.gremio_miembros (usuario_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gremio_miembros_gremio_usuario
  ON public.gremio_miembros (gremio_id, usuario_id);

CREATE INDEX IF NOT EXISTS idx_gremio_miembros_gremio
  ON public.gremio_miembros (gremio_id, unido_en ASC);

-- 4) Baul del gremio (objetos depositados)
CREATE TABLE IF NOT EXISTS public.gremio_baul (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gremio_id               BIGINT NOT NULL REFERENCES public.gremios(id) ON DELETE CASCADE,
  objeto_id               BIGINT REFERENCES public.objetos(id) ON DELETE SET NULL,
  cantidad                INT NOT NULL DEFAULT 1 CHECK (cantidad >= 1),
  depositante_usuario_id  UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gremio_baul_gremio
  ON public.gremio_baul (gremio_id, creado_en DESC);

-- 5) Solicitudes de objetos del baul
CREATE TABLE IF NOT EXISTS public.gremio_solicitudes_baul (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gremio_id               BIGINT NOT NULL REFERENCES public.gremios(id) ON DELETE CASCADE,
  baul_item_id            BIGINT NOT NULL REFERENCES public.gremio_baul(id) ON DELETE CASCADE,
  solicitante_usuario_id  UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  personaje_destino_id    BIGINT NOT NULL REFERENCES public.personajes(id) ON DELETE CASCADE,
  estado                  TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  nota                    TEXT,
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto_en             TIMESTAMPTZ,
  resuelto_por_usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gremio_solicitudes_gremio
  ON public.gremio_solicitudes_baul (gremio_id, estado, creado_en DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gremio_solicitud_pendiente_por_item
  ON public.gremio_solicitudes_baul (baul_item_id)
  WHERE estado = 'pendiente';

-- 6) RLS: lectura para autenticados, escritura solo backend (service_role)
ALTER TABLE public.gremios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gremio_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gremio_baul ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gremio_solicitudes_baul ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gremios_select ON public.gremios;
CREATE POLICY gremios_select ON public.gremios
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS gremio_miembros_select ON public.gremio_miembros;
CREATE POLICY gremio_miembros_select ON public.gremio_miembros
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS gremio_baul_select ON public.gremio_baul;
CREATE POLICY gremio_baul_select ON public.gremio_baul
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS gremio_solicitudes_baul_select ON public.gremio_solicitudes_baul;
CREATE POLICY gremio_solicitudes_baul_select ON public.gremio_solicitudes_baul
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 7) RPC: crear gremio con costo de 500 oro
CREATE OR REPLACE FUNCTION public.crear_gremio_con_costo(
  p_usuario_id UUID,
  p_nombre TEXT,
  p_descripcion TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gremio_id BIGINT;
  v_oro INT;
  v_nombre_limpio TEXT;
BEGIN
  v_nombre_limpio := btrim(COALESCE(p_nombre, ''));

  IF v_nombre_limpio = '' OR length(v_nombre_limpio) < 3 THEN
    RAISE EXCEPTION 'El nombre del gremio debe tener al menos 3 caracteres';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.gremio_miembros gm
    WHERE gm.usuario_id = p_usuario_id
  ) THEN
    RAISE EXCEPTION 'Ya perteneces a un gremio';
  END IF;

  -- Debita 500 oro de forma atomica y auditable.
  SELECT public.modificar_oro(
    p_usuario_id,
    -500,
    'creacion_gremio',
    NULL
  ) INTO v_oro;

  INSERT INTO public.gremios (nombre, descripcion, lider_usuario_id)
  VALUES (v_nombre_limpio, NULLIF(btrim(COALESCE(p_descripcion, '')), ''), p_usuario_id)
  RETURNING id INTO v_gremio_id;

  INSERT INTO public.gremio_miembros (gremio_id, usuario_id, rol)
  VALUES (v_gremio_id, p_usuario_id, 'lider');

  RETURN json_build_object(
    'gremioId', v_gremio_id,
    'nombre', v_nombre_limpio,
    'oro', v_oro
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crear_gremio_con_costo(UUID, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_gremio_con_costo(UUID, TEXT, TEXT) TO service_role;

-- 8) RPC: salir de gremio con transferencia de liderazgo
CREATE OR REPLACE FUNCTION public.salir_gremio(
  p_usuario_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gremio_id BIGINT;
  v_rol TEXT;
  v_nuevo_lider UUID;
BEGIN
  SELECT gm.gremio_id, gm.rol
  INTO v_gremio_id, v_rol
  FROM public.gremio_miembros gm
  WHERE gm.usuario_id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No perteneces a ningun gremio';
  END IF;

  IF v_rol <> 'lider' THEN
    DELETE FROM public.gremio_miembros
    WHERE usuario_id = p_usuario_id;

    RETURN json_build_object(
      'gremioId', v_gremio_id,
      'salio', true,
      'disuelto', false
    );
  END IF;

  SELECT gm.usuario_id
  INTO v_nuevo_lider
  FROM public.gremio_miembros gm
  WHERE gm.gremio_id = v_gremio_id
    AND gm.usuario_id <> p_usuario_id
  ORDER BY gm.unido_en ASC, gm.id ASC
  LIMIT 1
  FOR UPDATE;

  IF v_nuevo_lider IS NULL THEN
    DELETE FROM public.gremio_miembros
    WHERE usuario_id = p_usuario_id;

    DELETE FROM public.gremios
    WHERE id = v_gremio_id;

    RETURN json_build_object(
      'gremioId', v_gremio_id,
      'salio', true,
      'disuelto', true
    );
  END IF;

  UPDATE public.gremio_miembros
  SET rol = 'lider'
  WHERE gremio_id = v_gremio_id
    AND usuario_id = v_nuevo_lider;

  UPDATE public.gremios
  SET lider_usuario_id = v_nuevo_lider
  WHERE id = v_gremio_id;

  DELETE FROM public.gremio_miembros
  WHERE usuario_id = p_usuario_id;

  RETURN json_build_object(
    'gremioId', v_gremio_id,
    'salio', true,
    'disuelto', false,
    'nuevoLiderUsuarioId', v_nuevo_lider
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.salir_gremio(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salir_gremio(UUID) TO service_role;

-- 9) RPC: resolver solicitud del baul (solo lider)
CREATE OR REPLACE FUNCTION public.resolver_solicitud_gremio_baul(
  p_solicitud_id BIGINT,
  p_lider_usuario_id UUID,
  p_accion TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gremio_id BIGINT;
  v_baul_item_id BIGINT;
  v_solicitante_usuario_id UUID;
  v_personaje_destino_id BIGINT;
  v_estado TEXT;
  v_lider_actual UUID;
  v_objeto_id BIGINT;
  v_cantidad INT;
  v_capacidad INT;
  v_count INT;
  v_next_orden INT;
  v_bag_row_id BIGINT;
  v_accion TEXT;
BEGIN
  v_accion := lower(btrim(COALESCE(p_accion, '')));
  IF v_accion NOT IN ('aprobar', 'rechazar') THEN
    RAISE EXCEPTION 'Accion invalida';
  END IF;

  SELECT
    s.gremio_id,
    s.baul_item_id,
    s.solicitante_usuario_id,
    s.personaje_destino_id,
    s.estado,
    g.lider_usuario_id
  INTO
    v_gremio_id,
    v_baul_item_id,
    v_solicitante_usuario_id,
    v_personaje_destino_id,
    v_estado,
    v_lider_actual
  FROM public.gremio_solicitudes_baul s
  JOIN public.gremios g ON g.id = s.gremio_id
  WHERE s.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  IF v_lider_actual <> p_lider_usuario_id THEN
    RAISE EXCEPTION 'No autorizado para resolver esta solicitud';
  END IF;

  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta';
  END IF;

  IF v_accion = 'rechazar' THEN
    UPDATE public.gremio_solicitudes_baul
    SET estado = 'rechazada',
        resuelto_en = now(),
        resuelto_por_usuario_id = p_lider_usuario_id
    WHERE id = p_solicitud_id;

    RETURN json_build_object(
      'solicitudId', p_solicitud_id,
      'estado', 'rechazada'
    );
  END IF;

  SELECT b.objeto_id, b.cantidad
  INTO v_objeto_id, v_cantidad
  FROM public.gremio_baul b
  WHERE b.id = v_baul_item_id
    AND b.gremio_id = v_gremio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El objeto solicitado ya no esta en el baul';
  END IF;

  PERFORM 1
  FROM public.personajes p
  WHERE p.id = v_personaje_destino_id
    AND p.usuario_id = v_solicitante_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El personaje destino no pertenece al solicitante';
  END IF;

  SELECT p.capacidad_bolsa
  INTO v_capacidad
  FROM public.personajes p
  WHERE p.id = v_personaje_destino_id;

  SELECT COUNT(*)
  INTO v_count
  FROM public.bolsa_objetos bo
  WHERE bo.personaje_id = v_personaje_destino_id;

  IF v_count >= v_capacidad THEN
    RAISE EXCEPTION 'Bolsa llena: capacidad maxima alcanzada';
  END IF;

  SELECT COALESCE(MAX(bo.orden), 0) + 1
  INTO v_next_orden
  FROM public.bolsa_objetos bo
  WHERE bo.personaje_id = v_personaje_destino_id;

  INSERT INTO public.bolsa_objetos (personaje_id, objeto_id, cantidad, orden)
  VALUES (v_personaje_destino_id, v_objeto_id, v_cantidad, v_next_orden)
  RETURNING id INTO v_bag_row_id;

  DELETE FROM public.gremio_baul
  WHERE id = v_baul_item_id;

  UPDATE public.gremio_solicitudes_baul
  SET estado = 'aprobada',
      resuelto_en = now(),
      resuelto_por_usuario_id = p_lider_usuario_id
  WHERE id = p_solicitud_id;

  INSERT INTO public.transacciones_objetos (personaje_id, objeto_id, origen, cantidad)
  VALUES (v_personaje_destino_id, v_objeto_id, 'gremio', v_cantidad);

  RETURN json_build_object(
    'solicitudId', p_solicitud_id,
    'estado', 'aprobada',
    'bagRowId', v_bag_row_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_solicitud_gremio_baul(BIGINT, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_solicitud_gremio_baul(BIGINT, UUID, TEXT) TO service_role;
