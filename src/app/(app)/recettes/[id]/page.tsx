import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos-server";
import { categoryLabel, difficultyLabel, formatMinutes, type Recipe } from "@/lib/types";
import { RecipeView } from "@/components/RecipeView";
import { RecipeActions } from "@/components/RecipeActions";

export default async function RecettePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSession();
  const { data } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as Recipe;
  const urls = await signPhotos(supabase, r.photos);
  const { data: author } = r.created_by
    ? await supabase.from("family_members").select("display_name").eq("user_id", r.created_by).eq("family_id", r.family_id).maybeSingle()
    : { data: null };
  const cat = categoryLabel(r.category);
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) + (r.rest_minutes ?? 0);

  return (
    <main>
      {r.photos.length > 0 ? (
        <div className="flex snap-x snap-mandatory overflow-x-auto md:mt-4 md:rounded-2xl">
          {r.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={urls[p]} alt="" className="aspect-[4/3] max-h-[60vh] w-full shrink-0 snap-center object-cover" />
          ))}
        </div>
      ) : null}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-encre-douce">← Recettes</Link>
          <RecipeActions id={r.id} title={r.title} photos={r.photos} />
        </div>
        <p className="etiquette mt-3">{cat.emoji} {cat.label}</p>
        <h1 className="titre text-3xl font-semibold leading-tight">{r.title}</h1>
        {r.description && <p className="mt-2 text-encre-douce">{r.description}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Préparation", formatMinutes(r.prep_minutes)],
            ["Cuisson", formatMinutes(r.cook_minutes)],
            ["Repos", formatMinutes(r.rest_minutes)],
            ["Total", formatMinutes(total)],
            ["Difficulté", difficultyLabel(r.difficulty)],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="carte px-3 py-2">
              <dt className="text-xs text-encre-douce">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <RecipeView recipe={r} />

        <footer className="mt-8 space-y-1 border-t border-trait pt-4 text-sm text-encre-douce">
          {r.tags.length > 0 && <p>{r.tags.map((t) => `#${t}`).join(" ")}</p>}
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
