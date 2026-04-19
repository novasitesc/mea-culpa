import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

function mapGuildRow(row: any) {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    liderUsuarioId: row.lider_usuario_id,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    miembrosCount: row.miembros_count ?? 0,
  };
}

export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await db
    .from("gremio_miembros")
    .select("gremio_id, rol")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const { data: guildRows, error: guildsError } = await db
    .from("gremios")
    .select("id, nombre, descripcion, lider_usuario_id, creado_en, actualizado_en")
    .order("creado_en", { ascending: false })
    .limit(50);

  if (guildsError) {
    return NextResponse.json({ error: guildsError.message }, { status: 500 });
  }

  const guildIds = (guildRows ?? []).map((g) => g.id);

  let memberCountsByGuild = new Map<number, number>();
  if (guildIds.length > 0) {
    const { data: counts, error: countsError } = await db
      .from("gremio_miembros")
      .select("gremio_id")
      .in("gremio_id", guildIds);

    if (countsError) {
      return NextResponse.json({ error: countsError.message }, { status: 500 });
    }

    memberCountsByGuild = (counts ?? []).reduce((acc, row: any) => {
      const key = Number(row.gremio_id);
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map<number, number>());
  }

  const guilds = (guildRows ?? []).map((g: any) =>
    mapGuildRow({ ...g, miembros_count: memberCountsByGuild.get(Number(g.id)) ?? 0 }),
  );

  if (!membership) {
    return NextResponse.json({
      hasGuild: false,
      myMembership: null,
      myGuild: null,
      guilds,
    });
  }

  const myGuild = guilds.find((g) => g.id === Number(membership.gremio_id)) ?? null;

  const { data: members, error: membersError } = await db
    .from("gremio_miembros")
    .select(
      `
      id,
      rol,
      unido_en,
      usuario_id,
      perfil:usuario_id (id, nombre)
    `,
    )
    .eq("gremio_id", membership.gremio_id)
    .order("unido_en", { ascending: true });

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const { data: baulRows, error: baulError } = await db
    .from("gremio_baul")
    .select(
      `
      id,
      cantidad,
      objeto_id,
      depositante_usuario_id,
      creado_en,
      objeto:objeto_id (id, nombre, icono, rareza, tipo_item, precio),
      depositante:depositante_usuario_id (id, nombre)
    `,
    )
    .eq("gremio_id", membership.gremio_id)
    .order("creado_en", { ascending: false });

  if (baulError) {
    return NextResponse.json({ error: baulError.message }, { status: 500 });
  }

  const { data: solicitudesRows, error: solicitudesError } = await db
    .from("gremio_solicitudes_baul")
    .select(
      `
      id,
      estado,
      nota,
      creado_en,
      resuelto_en,
      baul_item_id,
      solicitante_usuario_id,
      personaje_destino_id,
      solicitante:solicitante_usuario_id (id, nombre),
      personaje:personaje_destino_id (id, nombre),
      baul_item:baul_item_id (
        id,
        cantidad,
        objeto:objeto_id (id, nombre, icono, rareza, tipo_item, precio)
      )
    `,
    )
    .eq("gremio_id", membership.gremio_id)
    .order("creado_en", { ascending: false })
    .limit(100);

  if (solicitudesError) {
    return NextResponse.json({ error: solicitudesError.message }, { status: 500 });
  }

  return NextResponse.json({
    hasGuild: true,
    myMembership: {
      guildId: Number(membership.gremio_id),
      role: membership.rol,
    },
    myGuild,
    guilds,
    members: (members ?? []).map((m: any) => ({
      id: m.id,
      role: m.rol,
      joinedAt: m.unido_en,
      userId: m.usuario_id,
      name: m.perfil?.nombre ?? "Jugador",
    })),
    baul: (baulRows ?? []).map((row: any) => ({
      id: row.id,
      cantidad: row.cantidad,
      createdAt: row.creado_en,
      object: {
        id: row.objeto?.id ?? null,
        nombre: row.objeto?.nombre ?? "Objeto desconocido",
        icono: row.objeto?.icono ?? "📦",
        rareza: row.objeto?.rareza ?? "comun",
        tipo: row.objeto?.tipo_item ?? "misc",
        precio: row.objeto?.precio ?? 0,
      },
      depositBy: {
        userId: row.depositante_usuario_id,
        name: row.depositante?.nombre ?? "Jugador",
      },
    })),
    solicitudes: (solicitudesRows ?? []).map((row: any) => ({
      id: row.id,
      estado: row.estado,
      nota: row.nota,
      createdAt: row.creado_en,
      resolvedAt: row.resuelto_en,
      baulItemId: row.baul_item_id,
      requesterUserId: row.solicitante_usuario_id,
      requesterName: row.solicitante?.nombre ?? "Jugador",
      targetCharacter: {
        id: row.personaje?.id ?? row.personaje_destino_id,
        name: row.personaje?.nombre ?? "Personaje",
      },
      item: {
        id: row.baul_item?.id ?? row.baul_item_id,
        cantidad: row.baul_item?.cantidad ?? 1,
        nombre: row.baul_item?.objeto?.nombre ?? "Objeto",
        icono: row.baul_item?.objeto?.icono ?? "📦",
      },
    })),
  });
}

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { nombre?: unknown; descripcion?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  const descripcion =
    typeof body.descripcion === "string" ? body.descripcion.trim() : "";

  if (nombre.length < 3) {
    return NextResponse.json(
      { error: "El nombre del gremio debe tener al menos 3 caracteres" },
      { status: 400 },
    );
  }

  const { data, error: rpcError } = await db.rpc("crear_gremio_con_costo", {
    p_usuario_id: user.id,
    p_nombre: nombre,
    p_descripcion: descripcion || null,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "No se pudo crear el gremio";
    if (msg.includes("Ya perteneces")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.toLowerCase().includes("insuficiente")) {
      return NextResponse.json(
        { error: "No tienes 500 de oro para crear un gremio" },
        { status: 422 },
      );
    }
    if (msg.includes("duplicate") || msg.includes("uq_gremios_nombre")) {
      return NextResponse.json({ error: "Ese nombre de gremio ya existe" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
