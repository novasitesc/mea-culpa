// GET / POST — Chat del gremio. Solo miembros: la pertenencia se resuelve desde
// el token, nunca desde el cuerpo de la petición.
// Tras insertar, la API emite un broadcast en `gremio-chat-<id>` para que los
// demás miembros vean el mensaje sin esperar al siguiente fetch.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

const HISTORY_LIMIT = 100;
const MAX_LEN = 500;

type Db = ReturnType<typeof createServerClient>;

async function myGuildId(db: Db, userId: string) {
  const { data } = await db
    .from("gremio_miembros")
    .select("gremio_id")
    .eq("usuario_id", userId)
    .maybeSingle();
  return data ? Number(data.gremio_id) : null;
}

export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const gremioId = await myGuildId(db, user.id);
  if (!gremioId) {
    return NextResponse.json({ error: "No perteneces a ningun gremio" }, { status: 403 });
  }

  const { data, error: queryError } = await db
    .from("gremio_mensajes")
    .select("id, contenido, creado_en, usuario_id, autor:usuario_id (id, nombre)")
    .eq("gremio_id", gremioId)
    .order("creado_en", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  // La consulta pide los más recientes; el chat los pinta en orden cronológico.
  const messages = (data ?? [])
    .map((row: any) => ({
      id: row.id,
      content: row.contenido,
      createdAt: row.creado_en,
      userId: row.usuario_id,
      authorName: row.autor?.nombre ?? "Jugador",
    }))
    .reverse();

  return NextResponse.json({ gremioId, messages });
}

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const content = String(body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "El mensaje esta vacio" }, { status: 400 });
  }
  if (content.length > MAX_LEN) {
    return NextResponse.json(
      { error: `El mensaje supera los ${MAX_LEN} caracteres` },
      { status: 400 },
    );
  }

  const gremioId = await myGuildId(db, user.id);
  if (!gremioId) {
    return NextResponse.json({ error: "No perteneces a ningun gremio" }, { status: 403 });
  }

  const { data, error: insertError } = await db
    .from("gremio_mensajes")
    .insert({ gremio_id: gremioId, usuario_id: user.id, contenido: content })
    .select("id, contenido, creado_en, usuario_id, autor:usuario_id (id, nombre)")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const message = {
    id: data.id,
    content: data.contenido,
    createdAt: data.creado_en,
    userId: data.usuario_id,
    authorName: (data as any).autor?.nombre ?? "Jugador",
  };

  // Mismo patrón que la sala: el emisor ya tiene el mensaje por la respuesta,
  // el broadcast es para los demás. Si falla, el fetch periódico lo recupera.
  try {
    await db.channel(`gremio-chat-${gremioId}`).send({
      type: "broadcast",
      event: "mensaje",
      payload: message,
    });
  } catch {
    // silencioso
  }

  return NextResponse.json({ message }, { status: 201 });
}
