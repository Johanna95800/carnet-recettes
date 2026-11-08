import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { RecipeForm } from "@/components/RecipeForm";
import type { Recipe } from "@/lib/types";

export default async function Modifier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSession();
  const { data } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const { id: _id, family_id, created_by: _c, created_at: _ca, updated_at: _u, ...draft } = data as Recipe;
  return (
    <main className="px-4 pt-6">
      <Link href={`/recettes/${id}`} className="text-sm text-encre-douce">← Retour</Link>
      <h1 className="titre mb-5 mt-2 text-3xl font-semibold">Modifier la recette</h1>
      <RecipeForm initial={draft} familyId={family_id} recipeId={id} />
    </main>
  );
}
