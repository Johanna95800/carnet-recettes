import type { ExtractedRecipe, RecipeDraft, SourceType } from "@/lib/types";

export function toDraft(
  r: ExtractedRecipe,
  source: { type: SourceType; url?: string | null },
  photos: string[],
): RecipeDraft {
  const pos = (n: number | null) => (n != null && n > 0 ? Math.round(n) : null);
  return {
    title: r.title.trim(),
    description: r.description,
    category: r.category,
    difficulty: r.difficulty,
    servings: r.servings != null && r.servings > 0 ? r.servings : null,
    servings_unit: r.servings_unit ?? "personnes",
    prep_minutes: pos(r.prep_minutes),
    cook_minutes: pos(r.cook_minutes),
    rest_minutes: pos(r.rest_minutes),
    ingredients: r.ingredients,
    steps: r.steps,
    utensils: r.utensils,
    tips: r.tips,
    tags: r.tags,
    photos,
    source_type: source.type,
    source_url: source.url ?? null,
    source_label: source.url ? new URL(source.url).hostname.replace(/^www\./, "") : null,
  };
}
