import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/supabase/server";
import { extractFromWebPage, ExtractionError } from "@/lib/import/claude";
import { fetchPublic, parseRecipePage } from "@/lib/import/web";
import { toStoredJpeg, uploadPhoto } from "@/lib/import/photos";
import { toDraft } from "@/lib/import/draft";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { supabase, user, family } = await getSession();
  if (!user || !family) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url) return NextResponse.json({ error: "Adresse manquante." }, { status: 400 });

  try {
    const page = await fetchPublic(url, "text/html,application/xhtml+xml", 8_000_000);
    const html = page.buf.toString("utf8");
    const { structured, text, images } = parseRecipePage(html, page.url);
    if (!structured && text.length < 200) {
      throw new ExtractionError("Impossible de lire cette page (site protégé ou vide).");
    }
    const recipe = await extractFromWebPage(page.url.toString(), structured, text);

    // Les sites déclarent souvent la même photo en plusieurs tailles / cadrages :
    // on n'en garde qu'une, la plus grande.
    let best: { buf: Buffer; area: number } | null = null;
    for (const img of images) {
      try {
        const { buf } = await fetchPublic(img, "image/*", 15_000_000);
        const { width = 0, height = 0 } = await sharp(buf).metadata();
        if (!best || width * height > best.area) best = { buf, area: width * height };
      } catch {
        /* image illisible : on passe */
      }
    }
    const photos = best ? [await uploadPhoto(supabase, family.id, await toStoredJpeg(best.buf))] : [];
    return NextResponse.json({ draft: toDraft(recipe, { type: "url", url: page.url.toString() }, photos) });
  } catch (err) {
    console.error("import url", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
