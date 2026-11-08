import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { extractFromText, ExtractionError } from "@/lib/import/claude";
import { toDraft } from "@/lib/import/draft";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { user, family } = await getSession();
  if (!user || !family) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.trim().length < 20) return NextResponse.json({ error: "Collez le texte de la recette." }, { status: 400 });
  try {
    const recipe = await extractFromText(text);
    return NextResponse.json({ draft: toDraft(recipe, { type: "manuel" }, []) });
  } catch (err) {
    console.error("import texte", err);
    const message = err instanceof ExtractionError ? err.message : "Impossible d'analyser ce texte.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
