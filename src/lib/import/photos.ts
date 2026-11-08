import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "recipe-photos";

/** Normalise une image (rotation EXIF, taille max, JPEG) avant stockage. */
export async function toStoredJpeg(input: Buffer, maxSide = 1600) {
  return sharp(input).rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * Remet une photo dans le bon sens et la recadre.
 * `box` est exprimé en fractions de l'image orientée selon l'EXIF (ce que l'IA a vu), avant `rotation`.
 */
export async function straightenAndCrop(
  input: Buffer,
  box: Box | null,
  rotation: number,
  { maxSide = 1600, requireBox = false } = {},
) {
  const upright = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  const W = upright.info.width;
  const H = upright.info.height;
  let img = sharp(upright.data);
  if (box) {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const left = Math.round(clamp(box.x) * W);
    const top = Math.round(clamp(box.y) * H);
    const width = Math.min(W - left, Math.round(clamp(box.width) * W));
    const height = Math.min(H - top, Math.round(clamp(box.height) * H));
    // cadre absurde (trop petit) : on l'ignore, ou on abandonne si le cadre était l'objectif
    if (width >= 80 && height >= 80 && width * height >= 0.02 * W * H) {
      img = sharp(await img.extract({ left, top, width, height }).toBuffer());
    } else if (requireBox) {
      return null;
    }
  }
  if (rotation % 360) img = sharp(await img.rotate(rotation).toBuffer());
  return toStoredJpeg(await img.toBuffer(), maxSide);
}

export async function uploadPhoto(supabase: SupabaseClient, familyId: string, jpeg: Buffer) {
  const path = `${familyId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg" });
  if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);
  return path;
}
