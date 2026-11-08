import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos-server";
import { categoryLabel, difficultyLabel, formatMinutes, type Recipe } from "@/lib/types";
import { PhotoGallery } from "@/components/PhotoGallery";
import { durationItems } from "@/components/Durations";
import { RecipeView } from "@/components/RecipeView";
import { TimerProvider } from "@/components/Timers";

async function load(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_recipe", { token });
  const r = (data as Recipe[] | null)?.[0];
  return r ? { supabase, r } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const found = await load((await params).token);
  return found
    ? { title: `${found.r.title} — Carnet de recettes`, description: found.r.description ?? undefined, robots: { index: false } }
    : { title: "Recette introuvable" };
}

/** Recette partagée publiquement : lecture seule, sans compte. */
export default async function RecettePublique({ params }: { params: Promise<{ token: string }> }) {
  const found = await load((await params).token);
  if (!found) notFound();
  const { supabase, r } = found;
  const urls = await signPhotos(supabase, r.photos);
  const cat = categoryLabel(r.category);
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) + (r.rest_minutes ?? 0);

  return (
    <TimerProvider>
      <div className="mx-auto max-w-3xl pb-12">
        <PhotoGallery urls={r.photos.map((p) => urls[p]).filter(Boolean)} />
        <div className="px-4 pt-4">
          <p className="etiquette">{cat.emoji} {cat.label}</p>
          <h1 className="titre text-3xl font-semibold leading-tight">{r.title}</h1>
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
          <footer className="mt-10 border-t border-trait pt-4 text-center text-sm text-encre-douce">
            🍲 Recette partagée depuis un carnet de recettes familial
            {r.source_url && (
              <> · <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline">source</a></>
            )}
          </footer>
        </div>
      </div>
    </TimerProvider>
  );
}
