import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "recipe-photos";

/** Normalise une image (rotation EXIF, taille max, JPEG) avant stockage. */
export async function toStoredJpeg(input: Buffer, maxSide = 1600) {
  return sharp(input).rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

export async function cropFraction(
  input: Buffer,
  box: { x: number; y: number; width: number; height: number },
) {
  const img = sharp(input).rotate();
  const meta = await img.metadata();
  // après .rotate(), largeur/hauteur peuvent être inversées selon l'orientation EXIF
  const swap = (meta.orientation ?? 1) >= 5;
  const W = (swap ? meta.height : meta.width) ?? 0;
  const H = (swap ? meta.width : meta.height) ?? 0;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const left = Math.round(clamp(box.x) * W);
  const top = Math.round(clamp(box.y) * H);
  const width = Math.min(W - left, Math.round(clamp(box.width) * W));
  const height = Math.min(H - top, Math.round(clamp(box.height) * H));
  if (width < 80 || height < 80) return null;
  const buf = await sharp(await img.toBuffer()).extract({ left, top, width, height }).toBuffer();
  return toStoredJpeg(buf);
}

export async function uploadPhoto(supabase: SupabaseClient, familyId: string, jpeg: Buffer) {
  const path = `${familyId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg" });
  if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);
  return path;
}
