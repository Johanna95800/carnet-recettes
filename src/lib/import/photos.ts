import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "recipe-photos";

export type PxBox = { left: number; top: number; right: number; bottom: number };

/** Normalise une image (rotation EXIF, taille max, JPEG) avant stockage. */
export async function toStoredJpeg(input: Buffer, maxSide = 1600) {
  return sharp(input).rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

/** Applique l'orientation EXIF puis la rotation demandée (sens horaire). Renvoie l'image droite. */
export async function makeUpright(input: Buffer, rotation: number) {
  let buf = await sharp(input).rotate().toBuffer();
  if (rotation % 360) buf = await sharp(buf).rotate(rotation).toBuffer();
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  return { buf, width, height };
}

/** Version réduite envoyée à l'IA (≤ 1568 px : taille vue telle quelle par le modèle). */
export async function forModel(input: Buffer, maxSide = 1568) {
  const { data, info } = await sharp(input).resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  return { base64: data.toString("base64"), mediaType: "image/jpeg" as const, width: info.width, height: info.height };
}

// ---------------------------------------------------------------------------
// Ajustement des bords sur l'image elle-même
// ---------------------------------------------------------------------------

type Raster = { w: number; h: number; lum: Uint8Array; sat: Uint8Array };

async function raster(buf: Buffer, maxSide = 700): Promise<{ r: Raster; scale: number; W: number; H: number }> {
  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const { data, info } = await sharp(buf).resize(maxSide, maxSide, { fit: "inside" }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const lum = new Uint8Array(n);
  const sat = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    lum[i] = (r * 299 + g * 587 + b * 114) / 1000;
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  return { r: { w: info.width, h: info.height, lum, sat }, scale: info.width / W, W, H };
}

/** Pixel « papier » : clair et peu coloré, par rapport à la teinte de papier estimée. */
function paperTest(r: Raster, b: PxBox) {
  // luminance de référence du papier : 85e centile à l'intérieur du cadre
  const vals: number[] = [];
  for (let y = b.top; y < b.bottom; y += 3) for (let x = b.left; x < b.right; x += 3) vals.push(r.lum[y * r.w + x]);
  vals.sort((a, c) => a - c);
  const paperL = vals[Math.floor(vals.length * 0.85)] ?? 200;
  return {
    isPaper: (i: number) => r.lum[i] > paperL * 0.78 && r.sat[i] < 45,
    // encre du texte : sombre et neutre
    isInk: (i: number) => r.lum[i] < paperL * 0.5 && r.sat[i] < 40,
  };
}

const clampBox = (b: PxBox, w: number, h: number): PxBox => ({
  left: Math.max(0, Math.min(w - 1, Math.round(b.left))),
  top: Math.max(0, Math.min(h - 1, Math.round(b.top))),
  right: Math.max(1, Math.min(w, Math.round(b.right))),
  bottom: Math.max(1, Math.min(h, Math.round(b.bottom))),
});

/**
 * Resserre un cadre approximatif :
 * - mode "page" : retire les bandes qui ne sont pas du papier (table, fond) ;
 * - mode "dish" : retire les bandes de papier / texte autour de la photo imprimée.
 * Chaque bord avance tant que la ligne correspond à ce qu'on veut retirer.
 */
function snap(r: Raster, start: PxBox, mode: "page" | "dish", t: ReturnType<typeof paperTest>): PxBox {
  const b = { ...start };
  // page : part de papier ; plat : part de pixels « photo » (ni papier, ni encre de texte)
  const hit = mode === "page" ? t.isPaper : (i: number) => !t.isPaper(i) && !t.isInk(i);
  const frac = (horizontal: boolean, pos: number) => {
    let p = 0, n = 0;
    if (horizontal) for (let x = b.left; x < b.right; x += 2) { n++; if (hit(pos * r.w + x)) p++; }
    else for (let y = b.top; y < b.bottom; y += 2) { n++; if (hit(y * r.w + pos)) p++; }
    return n ? p / n : 0;
  };
  // on retire la ligne tant qu'elle n'est pas majoritairement ce qu'on veut garder
  const shouldTrim = (f: number) => f < 0.5;
  
  const maxW = (start.right - start.left) * 0.3;
  const maxH = (start.bottom - start.top) * 0.3;
  for (let i = 0; i < maxH && b.bottom - b.top > 20 && shouldTrim(frac(true, b.top)); i++) b.top++;
  for (let i = 0; i < maxH && b.bottom - b.top > 20 && shouldTrim(frac(true, b.bottom - 1)); i++) b.bottom--;
  for (let i = 0; i < maxW && b.right - b.left > 20 && shouldTrim(frac(false, b.left)); i++) b.left++;
  for (let i = 0; i < maxW && b.right - b.left > 20 && shouldTrim(frac(false, b.right - 1)); i++) b.right--;
  return b;
}

/**
 * Affine un cadre donné par l'IA (en pixels de l'image `buf`) et renvoie un cadre en pixels de `buf`,
 * ou null s'il est inutilisable.
 */
export async function refineBox(buf: Buffer, box: PxBox, mode: "page" | "dish"): Promise<PxBox | null> {
  const { r, scale, W, H } = await raster(buf);
  const ai = clampBox({ left: box.left * scale, top: box.top * scale, right: box.right * scale, bottom: box.bottom * scale }, r.w, r.h);
  const aiArea = (ai.right - ai.left) * (ai.bottom - ai.top);
  if (ai.right - ai.left < 15 || ai.bottom - ai.top < 15) return null;

  // marge de sécurité de 4 % pour rattraper un cadre trop serré, puis on resserre sur l'image
  const mx = (ai.right - ai.left) * 0.04, my = (ai.bottom - ai.top) * 0.04;
  const start = clampBox({ left: ai.left - mx, top: ai.top - my, right: ai.right + mx, bottom: ai.bottom + my }, r.w, r.h);
  let b = snap(r, start, mode, paperTest(r, mode === "page" ? ai : start));
  // garde-fou : si l'ajustement a trop mangé l'image, on revient au cadre de l'IA
  if ((b.right - b.left) * (b.bottom - b.top) < aiArea * 0.55) b = ai;

  const out = clampBox({ left: b.left / scale, top: b.top / scale, right: b.right / scale, bottom: b.bottom / scale }, W, H);
  // un cadre qui couvre quasiment toute l'image n'apporte rien
  if (mode === "page" && (out.right - out.left) * (out.bottom - out.top) > 0.97 * W * H) return null;
  return out;
}

export async function cropTo(buf: Buffer, b: PxBox, maxSide = 1600) {
  const cut = await sharp(buf).extract({ left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top }).toBuffer();
  return toStoredJpeg(cut, maxSide);
}

export async function uploadPhoto(supabase: SupabaseClient, familyId: string, jpeg: Buffer) {
  const path = `${familyId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg" });
  if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);
  return path;
}
