import { getSession } from "@/lib/supabase/server";
import { BookBuilder } from "@/components/BookBuilder";
import type { Recipe } from "@/lib/types";

export default async function Livre() {
  const { supabase, family, user } = await getSession();
  const [{ data }, { data: marks }] = await Promise.all([
    supabase.from("recipes").select("id, title, category, tags").eq("family_id", family!.id).order("title"),
    supabase.from("recipe_marks").select("recipe_id").eq("user_id", user!.id).eq("favorite", true),
  ]);
  const favs = new Set((marks ?? []).map((m) => m.recipe_id));
  const recipes = ((data ?? []) as Pick<Recipe, "id" | "title" | "category" | "tags">[]).map((r) => ({ ...r, favorite: favs.has(r.id) }));
  return (
    <main className="px-4 pt-6">
      <h1 className="titre text-3xl font-semibold">📕 Livre de recettes</h1>
      <p className="mt-1 text-encre-douce">Choisissez les recettes, puis imprimez-les ou enregistrez-les en PDF.</p>
      <BookBuilder recipes={recipes} familyName={family!.name} />
    </main>
  );
}
