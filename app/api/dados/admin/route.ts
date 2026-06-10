import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { DICE_TYPES, REWARD_TYPES } from "@/lib/types/dados";
import type { DiceType, RewardType } from "@/lib/types/dados";

function normalizeDiceType(v: unknown): DiceType | null {
  return typeof v === "string" && DICE_TYPES.includes(v as DiceType) ? (v as DiceType) : null;
}

function normalizeRewardType(v: unknown): RewardType | null {
  return typeof v === "string" && REWARD_TYPES.includes(v as RewardType) ? (v as RewardType) : null;
}

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;

  const { data, error } = await session.db
    .from("dados_recompensas")
    .select(`
      id, nombre, descripcion, tipo, tipo_dado, costo_oro, activo, orden,
      objeto_id, cantidad_dados, multiplicador_oro, created_at,
      objeto:objeto_id(id, nombre, icono),
      dados_sublista_items(id, objeto_id, valor_min, valor_max, orden, objeto:objeto_id(id, nombre, icono))
    `)
    .order("orden", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapped = (data ?? []).map((r: any) => {
    const objetoRow = Array.isArray(r.objeto) ? r.objeto[0] : r.objeto;
    const sublistaItems = (r.dados_sublista_items ?? [])
      .map((si: any) => {
        const siObj = Array.isArray(si.objeto) ? si.objeto[0] : si.objeto;
        return {
          id: si.id,
          objetoId: si.objeto_id,
          objetoNombre: siObj?.nombre ?? "",
          objetoIcono: siObj?.icono ?? "",
          valorMin: si.valor_min,
          valorMax: si.valor_max,
          orden: si.orden,
        };
      })
      .sort((a: any, b: any) => a.orden - b.orden);

    return {
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion ?? null,
      tipo: r.tipo,
      tipoDado: r.tipo_dado,
      costoOro: r.costo_oro,
      activo: r.activo,
      orden: r.orden,
      objetoId: r.objeto_id ?? null,
      objetoNombre: objetoRow?.nombre ?? null,
      objetoIcono: objetoRow?.icono ?? null,
      cantidadDados: r.cantidad_dados ?? 1,
      multiplicadorOro: r.multiplicador_oro ?? 1,
      createdAt: r.created_at,
      sublistaItems,
    };
  });

  return NextResponse.json({ recompensas: mapped });
}

export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;
  const body = await request.json().catch(() => null);

  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const descripcion = typeof body?.descripcion === "string" ? body.descripcion.trim() : null;
  const tipo = normalizeRewardType(body?.tipo);
  const tipoDado = normalizeDiceType(body?.tipoDado);
  const costoOro = Number.isInteger(body?.costoOro) && body.costoOro >= 0 ? body.costoOro : null;
  const activo = typeof body?.activo === "boolean" ? body.activo : true;
  const orden = Number.isInteger(body?.orden) ? body.orden : 0;

  if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (!tipo) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  if (!tipoDado) return NextResponse.json({ error: "Tipo de dado inválido" }, { status: 400 });
  if (costoOro === null) return NextResponse.json({ error: "Costo de oro inválido" }, { status: 400 });

  const payload: Record<string, unknown> = {
    nombre,
    descripcion,
    tipo,
    tipo_dado: tipoDado,
    costo_oro: costoOro,
    activo,
    orden,
  };

  if (tipo === "item_fijo") {
    const objetoId = Number(body?.objetoId);
    if (!Number.isFinite(objetoId) || objetoId <= 0) {
      return NextResponse.json({ error: "Objeto inválido para item_fijo" }, { status: 400 });
    }
    payload.objeto_id = Math.floor(objetoId);
    payload.cantidad_dados = 1;
    payload.multiplicador_oro = 1;
  } else if (tipo === "sublista") {
    payload.objeto_id = null;
    payload.cantidad_dados = 1;
    payload.multiplicador_oro = 1;
  } else if (tipo === "oro_dados") {
    const cantidadDados = Number(body?.cantidadDados);
    const multiplicadorOro = Number(body?.multiplicadorOro);
    if (!Number.isFinite(cantidadDados) || cantidadDados < 1) {
      return NextResponse.json({ error: "Cantidad de dados inválida" }, { status: 400 });
    }
    if (!Number.isFinite(multiplicadorOro) || multiplicadorOro < 1) {
      return NextResponse.json({ error: "Multiplicador inválido" }, { status: 400 });
    }
    payload.objeto_id = null;
    payload.cantidad_dados = Math.floor(cantidadDados);
    payload.multiplicador_oro = Math.floor(multiplicadorOro);
  }

  const { data, error } = await session.db
    .from("dados_recompensas")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insertar sublista items si aplica
  if (tipo === "sublista" && Array.isArray(body?.sublistaItems) && body.sublistaItems.length > 0) {
    const subItems = body.sublistaItems
      .filter((si: any) => si.objetoId && si.valorMin !== undefined && si.valorMax !== undefined)
      .map((si: any, idx: number) => ({
        recompensa_id: data.id,
        objeto_id: Number(si.objetoId),
        valor_min: Number(si.valorMin),
        valor_max: Number(si.valorMax),
        orden: idx,
      }));

    if (subItems.length > 0) {
      await session.db.from("dados_sublista_items").insert(subItems);
    }
  }

  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}

export async function PUT(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;
  const body = await request.json().catch(() => null);

  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : null;
  const descripcion = typeof body?.descripcion === "string" ? body.descripcion.trim() : null;
  const tipo = normalizeRewardType(body?.tipo);
  const tipoDado = normalizeDiceType(body?.tipoDado);
  const costoOro = Number.isInteger(body?.costoOro) && body.costoOro >= 0 ? body.costoOro : null;
  const activo = typeof body?.activo === "boolean" ? body.activo : undefined;
  const orden = Number.isInteger(body?.orden) ? body.orden : undefined;

  const patch: Record<string, unknown> = {};
  if (nombre) patch.nombre = nombre;
  if (descripcion !== undefined) patch.descripcion = descripcion;
  if (tipo) patch.tipo = tipo;
  if (tipoDado) patch.tipo_dado = tipoDado;
  if (costoOro !== null) patch.costo_oro = costoOro;
  if (activo !== undefined) patch.activo = activo;
  if (orden !== undefined) patch.orden = orden;

  if (tipo === "item_fijo" && body?.objetoId) {
    patch.objeto_id = Number(body.objetoId);
  }
  if (tipo === "oro_dados") {
    if (body?.cantidadDados) patch.cantidad_dados = Math.floor(Number(body.cantidadDados));
    if (body?.multiplicadorOro) patch.multiplicador_oro = Math.floor(Number(body.multiplicadorOro));
  }
  if (tipo === "sublista" || tipo === "item_fijo") {
    patch.cantidad_dados = 1;
    patch.multiplicador_oro = 1;
  }

  const { error } = await session.db
    .from("dados_recompensas")
    .update(patch)
    .eq("id", Math.floor(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Actualizar sublista items: borrar y re-insertar
  if (tipo === "sublista" && Array.isArray(body?.sublistaItems)) {
    await session.db.from("dados_sublista_items").delete().eq("recompensa_id", Math.floor(id));

    const subItems = body.sublistaItems
      .filter((si: any) => si.objetoId && si.valorMin !== undefined && si.valorMax !== undefined)
      .map((si: any, idx: number) => ({
        recompensa_id: Math.floor(id),
        objeto_id: Number(si.objetoId),
        valor_min: Number(si.valorMin),
        valor_max: Number(si.valorMax),
        orden: idx,
      }));

    if (subItems.length > 0) {
      await session.db.from("dados_sublista_items").insert(subItems);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { error } = await session.db
    .from("dados_recompensas")
    .delete()
    .eq("id", Math.floor(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
