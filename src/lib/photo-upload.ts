"use client";

import { createBrowser } from "@/lib/supabase/browser";

/**
 * Envio de fotos direto do navegador para o bucket privado do Supabase, com a
 * sessão do usuário (as políticas do Storage conferem o acesso à OS).
 * Os arquivos não passam pelo servidor da aplicação — na Vercel o corpo de uma
 * requisição é limitado a ~4,5 MB, o que impediria várias fotos de uma vez.
 */

export const MAX_PHOTOS = 15;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 2048; // reduz fotos de celular sem perder detalhes úteis de avarias
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

function typeOf(f: File) {
  if (f.type && TYPES[f.type]) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "heic" ? "image/heic" : ext === "heif" ? "image/heif" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : f.type;
}

export function checkPhotos(files: File[]): string | null {
  if (files.length > MAX_PHOTOS) return `Envie no máximo ${MAX_PHOTOS} fotos por vez.`;
  const bad = files.find((f) => !TYPES[typeOf(f)]);
  return bad ? `Formato não suportado: ${bad.name}. Use JPG, PNG, WEBP ou HEIC.` : null;
}

/** Reduz e converte para JPEG quando o navegador consegue decodificar a imagem. */
async function prepare(file: File): Promise<{ blob: Blob; type: string; ext: string }> {
  const type = typeOf(file);
  const original = { blob: file as Blob, type, ext: TYPES[type] ?? "jpg" };
  if (typeof createImageBitmap !== "function") return original;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const heic = type === "image/heic" || type === "image/heif";
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && !heic) {
      bmp.close();
      return original;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob && (heic || blob.size < file.size)) return { blob, type: "image/jpeg", ext: "jpg" };
  } catch {
    // formato que o navegador não decodifica (ex.: HEIC no Chrome): envia o original
  }
  return original;
}

export async function uploadOrderPhotos(orderId: string, files: File[], onProgress?: (done: number, total: number) => void) {
  const supabase = createBrowser();
  const paths: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const { blob, type, ext } = await prepare(f);
    if (blob.size > MAX_PHOTO_BYTES) {
      failed.push(`${f.name} (mais de 10 MB)`);
    } else {
      const path = `orders/${orderId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("order-photos").upload(path, blob, { contentType: type, upsert: false });
      if (error) failed.push(f.name);
      else paths.push(path);
    }
    onProgress?.(i + 1, files.length);
  }
  return { paths, failed };
}
