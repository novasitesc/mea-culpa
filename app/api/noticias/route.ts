import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { requireAdmin } from "@/lib/adminAuth";
import type { Noticia } from "@/lib/types/noticia";

const NEWS_BUCKET = "news-images";
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function sanitizeFileName(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildStoragePath(filename: string) {
  const safeName = sanitizeFileName(filename);
  return `news/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    const image = formData.get("image");
    return {
      titulo: formData.get("titulo")?.toString() ?? "",
      contenido: formData.get("contenido")?.toString() ?? "",
      visible: formData.get("visible")?.toString() ?? undefined,
      image: image instanceof File ? image : undefined,
    };
  }

  const body = await request.json().catch(() => ({}));
  return {
    titulo: body.titulo ?? "",
    contenido: body.contenido ?? "",
    visible: body.visible,
    image: body.image,
  };
}

 function resolvePublicUrl(db: ReturnType<typeof createServerClient>) {
  return function getPublicUrl(path: string) {
    const { data } = db.storage.from(NEWS_BUCKET).getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new Error("No se pudo obtener la URL de la imagen");
    }
    return data.publicUrl;
  };
}

async function fetchAdminState(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) return false;

  const { data: perfil, error: perfilError } = await db
    .from("perfiles")
    .select("es_admin")
    .eq("id", user.id)
    .single();

  return !perfilError && perfil?.es_admin === true;
}

export async function GET(request: Request) {
  const db = createServerClient();
  const isAdmin = await fetchAdminState(request);

  let query = db
    .from("noticias")
    .select("id,titulo,contenido,imagen_url,imagen_path,visible,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query.eq("visible", true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  // Usar service role para bypass RLS
  const db = createServerClient();
  const payload = await parsePayload(request);
  const titulo = payload.titulo?.trim();
  const contenido = payload.contenido?.trim();
  const visible =
    payload.visible === undefined
      ? true
      : payload.visible === "true" || payload.visible === true;

  if (!titulo || !contenido) {
    return NextResponse.json(
      { error: "El título y el contenido son requeridos." },
      { status: 400 },
    );
  }

  let imagen_path: string | null = null;
  let imagen_url: string | null = null;

  if (payload.image) {
    // Check if bucket exists
    const { data: buckets, error: bucketError } = await db.storage.listBuckets();
    if (bucketError) {
      return NextResponse.json(
        { error: `Error al verificar buckets de almacenamiento: ${bucketError.message}` },
        { status: 500 },
      );
    }

    const bucketExists = buckets?.some(bucket => bucket.name === NEWS_BUCKET);
    if (!bucketExists) {
      // Try to create the bucket
      const { error: createError } = await db.storage.createBucket(NEWS_BUCKET, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: MAX_IMAGE_BYTES,
      });
      
      if (createError) {
        return NextResponse.json(
          { error: `Error al crear el bucket de almacenamiento: ${createError.message}` },
          { status: 500 },
        );
      }
    }

    const image = payload.image;
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json(
        { error: "Tipo de imagen no permitido." },
        { status: 400 },
      );
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo de 5MB." },
        { status: 400 },
      );
    }

    imagen_path = buildStoragePath(image.name);
    const { error: uploadError } = await db.storage
      .from(NEWS_BUCKET)
      .upload(imagen_path, image, { upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 },
      );
    }
    
    const getPublicUrl = await resolvePublicUrl(db);
    imagen_url = getPublicUrl(imagen_path);
  }

  const { data, error } = await db
    .from("noticias")
    .insert({ 
      titulo,
       contenido, 
       imagen_url, 
       imagen_path, 
       visible
    })
    .select()
    .single();

  if (error) {
    console.error("Database insert error:", error);
    return NextResponse.json(
      { error: `Error al guardar en la base de datos: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
