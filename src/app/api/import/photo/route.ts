import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/supabase/server";
import { extractFromImages, ExtractionError } from "@/lib/import/claude";
import { straightenAndCrop, toStoredJpeg, uploadPhoto } from "@/lib/import/photos";
import { toDraft } from "@/lib/import/draft";

export const maxDuration = 300;

const MAX_FILES = 4;

export async function POST(req: Request) {
  const { supabase, user, family } = await getSession();
  if (!user || !family) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const form = await req.formData();
  const kind = form.get("kind") === "livre" ? "livre" : "manuscrite";
  const files = form.getAll("photos").filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
  if (!files.length) return NextResponse.json({ error: "Aucune photo reçue." }, { status: 400 });

  try {
    const originals = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    // Version envoyée à l'IA : orientée correctement, 1600 px max
    const forAi = await Promise.all(
      originals.map(async (b) => ({
        base64: (await sharp(b).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 }).toBuffer()).toString("base64"),
        mediaType: "image/jpeg" as const,
      })),
    );
    const recipe = await extractFromImages(forAi, kind);

    const photos: string[] = [];
    const info = (i: number) => recipe.images.find((im) => im.image_index === i);
    const rotationOf = (i: number) => Number(info(i)?.rotation ?? 0);

    const box = recipe.dish_photo_box;
    if (kind === "livre" && box && originals[box.image_index]) {
      const crop = await straightenAndCrop(originals[box.image_index], box, rotationOf(box.image_index), { requireBox: true }).catch(() => null);
      if (crop) photos.push(await uploadPhoto(supabase, family.id, crop));
    }
    // On garde aussi les pages / fiches d'origine, remises à l'endroit et recadrées
    for (const [i, b] of originals.entries()) {
      const page = (await straightenAndCrop(b, info(i)?.page_box ?? null, rotationOf(i), { maxSide: 2000 }).catch(() => null))
        ?? (await toStoredJpeg(b, 2000));
      photos.push(await uploadPhoto(supabase, family.id, page));
    }

    const draft = toDraft(recipe, { type: kind === "livre" ? "photo-livre" : "photo-manuscrite" }, photos);
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("import photo", err);
    const message = err instanceof ExtractionError ? err.message : "Impossible d'analyser la photo.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
