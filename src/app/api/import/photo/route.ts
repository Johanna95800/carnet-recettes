import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { extractFromImages, locateOnPages, ExtractionError } from "@/lib/import/claude";
import { cropTo, forModel, makeUpright, refineBox, toStoredJpeg, uploadPhoto } from "@/lib/import/photos";
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
    // 1) Retranscription (l'IA indique aussi dans quel sens tourner chaque photo)
    const forAi = await Promise.all(originals.map(async (b) => forModel((await makeUpright(b, 0)).buf)));
    const recipe = await extractFromImages(forAi, kind);

    // 2) Remise à l'endroit, puis localisation précise de la page et de la photo du plat
    const rotationOf = (i: number) => Number(recipe.images.find((im) => im.image_index === i)?.rotation ?? 0);
    const upright = await Promise.all(originals.map((b, i) => makeUpright(b, rotationOf(i))));
    const small = await Promise.all(upright.map((u) => forModel(u.buf)));
    const located = await locateOnPages(small, kind === "livre").catch((e) => {
      console.error("localisation", e);
      return [];
    });
    // coordonnées renvoyées dans l'image réduite → image pleine résolution
    const toFull = (i: number, box: { left: number; top: number; right: number; bottom: number }) => {
      const k = upright[i].width / small[i].width;
      return { left: box.left * k, top: box.top * k, right: box.right * k, bottom: box.bottom * k };
    };

    const photos: string[] = [];
    if (kind === "livre") {
      const withDish = located
        .filter((l) => l.dish_photo_box && upright[l.image_index])
        .sort((a, b) => area(b.dish_photo_box!) - area(a.dish_photo_box!))[0];
      if (withDish) {
        const i = withDish.image_index;
        const box = await refineBox(upright[i].buf, toFull(i, withDish.dish_photo_box!), "dish").catch(() => null);
        if (box) photos.push(await uploadPhoto(supabase, family.id, await cropTo(upright[i].buf, box)));
      }
    }
    // Pages / fiches d'origine, remises à l'endroit et débarrassées du fond
    for (const [i, u] of upright.entries()) {
      const l = located.find((x) => x.image_index === i);
      const box = l ? await refineBox(u.buf, toFull(i, l.page_box), "page").catch(() => null) : null;
      const jpeg = box ? await cropTo(u.buf, box, 2000) : await toStoredJpeg(u.buf, 2000);
      photos.push(await uploadPhoto(supabase, family.id, jpeg));
    }

    const draft = toDraft(recipe, { type: kind === "livre" ? "photo-livre" : "photo-manuscrite" }, photos);
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("import photo", err);
    const message = err instanceof ExtractionError ? err.message : "Impossible d'analyser la photo.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

function area(b: { left: number; top: number; right: number; bottom: number }) {
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}
