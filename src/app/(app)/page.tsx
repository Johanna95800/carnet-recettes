import Link from "next/link";
import { getSession } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos-server";
import { RecipeList } from "@/components/RecipeList";
import type { Recipe } from "@/lib/types";

export default async function Accueil() {
  const { supabase, family } = await getSession();
  const { data } = await supabase
    .from("recipes")
    .select("id, title, category, difficulty, prep_minutes, cook_minutes, rest_minutes, tags, photos, ingredients, created_at")
    .eq("family_id", family!.id)
    .order("created_at", { ascending: false });
  const recipes = (data ?? []) as Pick<Recipe, "id" | "title" | "category" | "difficulty" | "prep_minutes" | "cook_minutes" | "rest_minutes" | "tags" | "photos" | "ingredients" | "created_at">[];
  const urls = await signPhotos(supabase, recipes.map((r) => r.photos[0]));

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="etiquette">{family!.name}</p>
          <h1 className="titre text-3xl font-semibold">Nos recettes</h1>
        </div>
        <Link href="/ajouter" className="btn-primaire hidden md:inline-flex">➕ Ajouter</Link>
      </header>
      {recipes.length === 0 ? (
        <div className="carte p-8 text-center">
          <div className="text-4xl">🧑‍🍳</div>
          <p className="mt-3 font-medium">Le carnet est encore vide.</p>
          <p className="mt-1 text-encre-douce">Ajoutez une première recette depuis un site, une photo ou à la main.</p>
          <Link href="/ajouter" className="btn-primaire mt-5">Ajouter une recette</Link>
        </div>
      ) : (
        <RecipeList
          recipes={recipes.map((r) => ({
            id: r.id, title: r.title, category: r.category, difficulty: r.difficulty, tags: r.tags,
            totalMinutes: (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) + (r.rest_minutes ?? 0),
            photo: r.photos[0] ? urls[r.photos[0]] ?? null : null,
            search: [r.title, ...r.tags, ...r.ingredients.map((i) => i.name)].join(" "),
          }))}
        />
      )}
    </main>
  );
}
