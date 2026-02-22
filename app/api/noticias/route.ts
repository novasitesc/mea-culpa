import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Lee las imágenes de public/imgs/noticias y devuelve sus URLs públicas.
// Para añadir una noticia nueva solo hay que colocar la imagen en esa carpeta.

const NOTICIAS_DIR = path.join(process.cwd(), "public", "imgs", "noticias");

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
]);

export async function GET() {
  try {
    const files = fs.readdirSync(NOTICIAS_DIR);

    const images = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.has(ext);
      })
      .sort() // orden alfabético / numérico
      .map((file) => ({
        filename: file,
        url: `/imgs/noticias/${file}`,
        alt: `Noticia: ${path.basename(file, path.extname(file))}`,
      }));

    return NextResponse.json(images);
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer la carpeta de noticias" },
      { status: 500 },
    );
  }
}
