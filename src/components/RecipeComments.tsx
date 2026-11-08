"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type CommentView = { id: string; author: string; mine: boolean; body: string; created_at: string };

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function RecipeComments({ recipeId, comments }: { recipeId: string; comments: CommentView[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError(null);
    const { error } = await createClient().from("recipe_comments").insert({ recipe_id: recipeId, body: body.trim() });
    setBusy(false);
    if (error) {
      setError(error.message.includes("recipe_comments") ? "Fonction pas encore activée : la base Supabase doit être mise à jour." : error.message);
      return;
    }
    setBody("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce commentaire ?")) return;
    await createClient().from("recipe_comments").delete().eq("id", id);
    router.refresh();
  }

  return (
    <section className="mt-8">
      <h2 className="titre text-xl font-semibold">💬 Notes de la famille</h2>
      {comments.length === 0 && (
        <p className="mt-2 text-sm text-encre-douce">Une astuce, une variante, un souvenir ? Laissez une note pour les autres.</p>
      )}
      <ul className="mt-3 space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="carte p-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">{c.author}</span>
              <span className="text-encre-douce">{dateFr(c.created_at)}</span>
            </div>
            <p className="mt-1 whitespace-pre-line">{c.body}</p>
            {c.mine && (
              <button className="mt-1 text-xs text-encre-douce underline" onClick={() => remove(c.id)}>Supprimer</button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="mt-3 space-y-2">
        <textarea className="champ" rows={2} maxLength={4000} placeholder="Ex. : j'ai mis 80 g de sucre au lieu de 100, c'est parfait."
          value={body} onChange={(e) => setBody(e.target.value)} />
        {error && <p className="text-sm text-tomate">{error}</p>}
        <button className="btn-secondaire" disabled={busy || !body.trim()}>{busy ? "Envoi…" : "Publier la note"}</button>
      </form>
    </section>
  );
}
