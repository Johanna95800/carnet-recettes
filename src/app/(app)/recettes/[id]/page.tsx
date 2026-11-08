import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos-server";
import { categoryLabel, difficultyLabel, formatMinutes, type Recipe } from "@/lib/types";
import { RecipeView } from "@/components/RecipeView";
import { RecipeActions } from "@/components/RecipeActions";
import { PhotoGallery } from "@/components/PhotoGallery";
import { durationItems } from "@/components/Durations";
import { RecipeMarks } from "@/components/RecipeMarks";
import { RecipeComments } from "@/components/RecipeComments";
import { summarize, type MarkRow } from "@/lib/marks";

export default async function RecettePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getSession();
  const { data } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as Recipe;
  const urls = await signPhotos(supabase, r.photos);
  const [{ data: members }, { data: marks }, { data: comments }] = await Promise.all([
    supabase.from("family_members").select("user_id, display_name").eq("family_id", r.family_id),
    supabase.from("recipe_marks").select("recipe_id, user_id, favorite, cooked, rating").eq("recipe_id", r.id),
    supabase.from("recipe_comments").select("id, user_id, body, created_at").eq("recipe_id", r.id).order("created_at"),
  ]);
  const names: Record<string, string> = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.display_name || "Sans nom"]));
  const author = r.created_by ? { display_name: names[r.created_by] } : null;
  const markRows = (marks ?? []) as MarkRow[];
  const mineRow = markRows.find((m) => m.user_id === user!.id);
  const cat = categoryLabel(r.category);
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) + (r.rest_minutes ?? 0);

  return (
    <main>
      <PhotoGallery urls={r.photos.map((p) => urls[p]).filter(Boolean)} />
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-encre-douce">← Recettes</Link>
          <RecipeActions id={r.id} title={r.title} photos={r.photos} />
        </div>
        <p className="etiquette mt-3">{cat.emoji} {cat.label}</p>
        <h1 className="titre text-3xl font-semibold leading-tight">{r.title}</h1>
        {r.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.tags.map((t) => (
              <li key={t}>
                <Link href={`/?tag=${encodeURIComponent(t)}`} className="rounded-full border border-trait bg-papier px-2.5 py-1 text-sm hover:border-tomate">
                  🏷️ {t}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <RecipeMarks recipeId={r.id} summary={summarize(markRows, names)}
          mine={{ favorite: mineRow?.favorite ?? false, cooked: mineRow?.cooked ?? false, rating: mineRow?.rating ?? null }} />
        {r.description && <p className="mt-3 text-encre-douce">{r.description}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {durationItems(r).map((d) => (
            <div key={d.label} className="carte px-3 py-2">
              <dt className="text-xs text-encre-douce">{d.icon} {d.label}</dt>
              <dd className="font-semibold">{d.value}</dd>
            </div>
          ))}
          {difficultyLabel(r.difficulty) && (
            <div className="carte px-3 py-2">
              <dt className="text-xs text-encre-douce">📊 Difficulté</dt>
              <dd className="font-semibold">{difficultyLabel(r.difficulty)}</dd>
            </div>
          )}
        </dl>
        {total > 0 && durationItems(r).length > 1 && (
          <p className="mt-2 text-sm text-encre-douce">Temps total : {formatMinutes(total)}</p>
        )}

        <RecipeView recipe={r} />

        <RecipeComments recipeId={r.id} comments={(comments ?? []).map((c) => ({
          id: c.id, body: c.body, created_at: c.created_at,
          author: (c.user_id && names[c.user_id]) || "Ancien membre", mine: c.user_id === user!.id,
        }))} />

        <footer className="mt-8 space-y-1 border-t border-trait pt-4 text-sm text-encre-douce">
          {(r.source_label || r.source_url) && (
            <p>Source : {r.source_url
              ? <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline">{r.source_label ?? r.source_url}</a>
              : r.source_label}</p>
          )}
          {author?.display_name && <p>Ajoutée par {author.display_name}</p>}
        </footer>
      </div>
    </main>
  );
}
