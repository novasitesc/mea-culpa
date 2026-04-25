import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import type { Noticia } from "@/lib/types/noticia";
import { createServerClient } from "@/lib/supabaseServer";

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
      titulo: formData.get("titulo")?.toString(),
      contenido: formData.get("contenido")?.toString(),
      visible: formData.get("visible")?.toString(),
      image: image instanceof File ? image : undefined,
    };
  }

  const body = await request.json().catch(() => ({}));
  return {
    titulo: body.titulo,
    contenido: body.contenido,
    visible: body.visible,
    image: body.image,
  };
}

async function resolvePublicUrl(db: ReturnType<typeof createServerClient>) {
  return function getPublicUrl(path: string) {
    const { data, error } = db.storage.from(NEWS_BUCKET).getPublicUrl(path);
    if (error || !data?.publicUrl) {
      throw new Error(error?.message ?? "No se pudo obtener la URL de la imagen");
    }
    return data.publicUrl;
  };
}

async function getExistingNoticia(db: ReturnType<typeof createServerClient>, id: number) {
  const { data, error } = await db
    .from<Noticia>("noticias")
    .select("imagen_path")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Usar service role para bypass RLS
  const db = createServerClient();
  const payload = await parsePayload(request);
  const updates: Partial<Omit<Noticia, "id" | "created_at" | "updated_at">> = {};
  const titulo = payload.titulo?.trim();
  const contenido = payload.contenido?.trim();

  if (titulo !== undefined) {
    if (!titulo) {
      return NextResponse.json(
        { error: "El título no puede estar vacío." },
        { status: 400 },
      );
    }
    updates.titulo = titulo;
  }

  if (contenido !== undefined) {
    if (!contenido) {
      return NextResponse.json(
        { error: "El contenido no puede estar vacío." },
        { status: 400 },
      );
    }
    updates.contenido = contenido;
  }

  if (payload.visible !== undefined) {
    updates.visible =
      payload.visible === "true" || payload.visible === true;
  }

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

    if (!ALLOWED_IMAGE_TYPES.has(payload.image.type)) {
      return NextResponse.json(
        { error: "Tipo de imagen no permitido." },
        { status: 400 },
      );
    }
    if (payload.image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo de 5MB." },
        { status: 400 },
      );
    }

    const existing = await getExistingNoticia(session.db, id);
    const imagen_path = buildStoragePath(payload.image.name);

    const { error: uploadError } = await db.storage
      .from(NEWS_BUCKET)
      .upload(imagen_path, payload.image, { upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 },
      );
    }

    updates.imagen_path = imagen_path;
    updates.imagen_url = resolvePublicUrl(db)(imagen_path);

    if (existing?.imagen_path) {
      await db.storage.from(NEWS_BUCKET).remove([existing.imagen_path]);
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No hay cambios para aplicar." },
      { status: 400 },
    );
  }

  const { data, error } = await db
    .from<Noticia>("noticias")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Usar service role para bypass RLS
  const db = createServerClient();
  const existing = await getExistingNoticia(db, id);
  if (!existing) {
    return NextResponse.json({ error: "Noticia no encontrada." }, { status: 404 });
  }

  if (existing.imagen_path) {
    const { error: removeError } = await db.storage
      .from(NEWS_BUCKET)
      .remove([existing.imagen_path]);

    if (removeError) {
      return NextResponse.json(
        { error: removeError.message },
        { status: 500 },
      );
    }
  }

  const { error } = await db
    .from("noticias")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
