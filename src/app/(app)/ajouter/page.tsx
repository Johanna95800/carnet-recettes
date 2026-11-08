import { getSession } from "@/lib/supabase/server";
import { AddRecipe } from "@/components/AddRecipe";

export default async function Ajouter() {
  const { family } = await getSession();
  return (
    <main className="px-4 pt-6">
      <h1 className="titre mb-5 text-3xl font-semibold">Ajouter une recette</h1>
      <AddRecipe familyId={family!.id} />
    </main>
  );
}
