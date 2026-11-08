import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/supabase/server";
import { extractFromImages, ExtractionError } from "@/lib/import/claude";
import { cropFraction, toStoredJpeg, uploadPhoto } from "@/lib/import/photos";
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
    const box = recipe.dish_photo_box;
    if (kind === "livre" && box && originals[box.image_index]) {
      const crop = await cropFraction(originals[box.image_index], box).catch(() => null);
      if (crop) photos.push(await uploadPhoto(supabase, family.id, crop));
    }
    // On garde aussi les photos d'origine (souvenir de la fiche manuscrite / page du livre)
    for (const b of originals) photos.push(await uploadPhoto(supabase, family.id, await toStoredJpeg(b, 2000)));

    const draft = toDraft(recipe, { type: kind === "livre" ? "photo-livre" : "photo-manuscrite" }, photos);
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("import photo", err);
    const message = err instanceof ExtractionError ? err.message : "Impossible d'analyser la photo.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
