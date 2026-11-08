"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type MyMark = { favorite: boolean; cooked: boolean; rating: number | null };
export type MarkSummary = { avg: number | null; count: number; cookedBy: string[] };

/** Favori, « déjà faite » et note personnelle, plus la note moyenne de la famille. */
export function RecipeMarks({ recipeId, mine, summary }: { recipeId: string; mine: MyMark; summary: MarkSummary }) {
  const router = useRouter();
  const [m, setM] = useState<MyMark>(mine);
  const [error, setError] = useState<string | null>(null);

  async function save(next: MyMark) {
    const prev = m;
    setM(next);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("recipe_marks").upsert({
      recipe_id: recipeId, user_id: user!.id, ...next, updated_at: new Date().toISOString(),
    });
    if (error) {
      setM(prev);
      setError(error.message.includes("recipe_marks") ? "Fonction pas encore activée : la base Supabase doit être mise à jour." : error.message);
    } else router.refresh();
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => save({ ...m, favorite: !m.favorite })}
          className={`btn py-1.5 text-sm ${m.favorite ? "bg-tomate/10 text-tomate border border-tomate" : "btn-secondaire"}`}>
          {m.favorite ? "❤️ Favori" : "🤍 Favori"}
        </button>
        <button onClick={() => save({ ...m, cooked: !m.cooked })}
          className={`btn py-1.5 text-sm ${m.cooked ? "border border-basilic bg-basilic/10 text-basilic" : "btn-secondaire"}`}>
          {m.cooked ? "✓ Déjà faite" : "Pas encore faite"}
        </button>
        <div className="flex items-center" role="radiogroup" aria-label="Ma note">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={m.rating === n} aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
              onClick={() => save({ ...m, rating: m.rating === n ? null : n, cooked: true })}
              className={`px-0.5 text-2xl leading-none ${m.rating && n <= m.rating ? "text-amber-500" : "text-trait"}`}>★</button>
          ))}
        </div>
      </div>
      {(summary.count > 0 || summary.cookedBy.length > 0) && (
        <p className="text-sm text-encre-douce">
          {summary.avg != null && <>★ {summary.avg.toLocaleString("fr", { maximumFractionDigits: 1 })}/5 ({summary.count} avis) · </>}
          {summary.cookedBy.length > 0 && <>Déjà faite par {summary.cookedBy.join(", ")}</>}
        </p>
      )}
      {error && <p className="text-sm text-tomate">{error}</p>}
    </div>
  );
}
