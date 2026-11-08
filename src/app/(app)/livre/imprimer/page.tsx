import { getSession } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos-server";
import { categoryLabel, difficultyLabel, type Recipe } from "@/lib/types";
import { ingredientParts } from "@/lib/scale";
import { durationItems } from "@/components/Durations";
import { PrintButton } from "@/components/PrintButton";

export default async function Imprimer({ searchParams }: { searchParams: Promise<{ ids?: string; titre?: string }> }) {
  const { ids = "", titre } = await searchParams;
  const list = ids.split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 300);
  const { supabase, family } = await getSession();
  const { data } = list.length ? await supabase.from("recipes").select("*").in("id", list) : { data: [] };
  const byId = new Map(((data ?? []) as Recipe[]).map((r) => [r.id, r]));
  const recipes = list.map((id) => byId.get(id)).filter((r): r is Recipe => !!r);
  const urls = await signPhotos(supabase, recipes.map((r) => r.photos[0]));
  const isBook = recipes.length > 1;
  const bookTitle = titre || (isBook ? "Nos recettes" : recipes[0]?.title ?? "Recette");

  return (
    <div className="livre bg-white text-black">
      <PrintButton auto={!isBook} />
      {isBook && (
        <>
          <section className="page flex min-h-[90vh] flex-col items-center justify-center text-center">
            <div className="text-7xl">🍲</div>
            <h1 className="titre mt-6 text-5xl font-semibold leading-tight">{bookTitle}</h1>
            <p className="mt-4 text-lg text-neutral-600">{family!.name} · {new Date().getFullYear()}</p>
            <p className="mt-1 text-neutral-500">{recipes.length} recettes</p>
          </section>
          <section className="page px-8 py-10">
            <h2 className="titre text-3xl font-semibold">Sommaire</h2>
            <ol className="mt-6 space-y-1.5">
              {recipes.map((r, i) => (
                <li key={r.id} className="flex gap-2">
                  <span className="w-8 text-neutral-500">{i + 1}.</span>
                  <a href={`#r-${r.id}`} className="flex-1">{r.title}</a>
                  <span className="text-neutral-500">{categoryLabel(r.category).label}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      {recipes.map((r, i) => (
        <article key={r.id} id={`r-${r.id}`} className="page px-8 py-10">
          <p className="text-sm uppercase tracking-wider text-neutral-500">
            {isBook && `${i + 1} · `}{categoryLabel(r.category).label}
          </p>
          <h2 className="titre mt-1 text-4xl font-semibold leading-tight">{r.title}</h2>
          {r.description && <p className="mt-2 italic text-neutral-600">{r.description}</p>}
          <p className="mt-3 text-sm text-neutral-700">
            {[
              r.servings ? `Pour ${r.servings} ${r.servings_unit ?? "personnes"}` : null,
              ...durationItems(r).map((d) => `${d.label} : ${d.value}`),
              difficultyLabel(r.difficulty),
            ].filter(Boolean).join("  ·  ")}
          </p>
          {r.photos[0] && urls[r.photos[0]] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[r.photos[0]]} alt="" className="mt-5 max-h-[38vh] w-full rounded-lg object-cover" />
          )}
          <div className="mt-6 grid gap-8 sm:grid-cols-[2fr_3fr] print:grid-cols-[2fr_3fr]">
            <div>
              <h3 className="titre text-xl font-semibold">Ingrédients</h3>
              <ul className="mt-2 space-y-1 text-[15px]">
                {r.ingredients.map((ing, k) => {
                  const { amount, link } = ingredientParts(ing);
                  const newGroup = ing.group && ing.group !== r.ingredients[k - 1]?.group;
                  return (
                    <li key={k}>
                      {newGroup && <p className="mt-2 font-semibold">{ing.group}</p>}
                      • {amount && <strong>{amount} </strong>}{link}{ing.name}{ing.note ? ` (${ing.note})` : ""}
                    </li>
                  );
                })}
              </ul>
              {r.utensils.length > 0 && (
                <>
                  <h3 className="titre mt-5 text-xl font-semibold">Ustensiles</h3>
                  <p className="mt-1 text-[15px]">{r.utensils.join(", ")}</p>
                </>
              )}
            </div>
            <div>
              <h3 className="titre text-xl font-semibold">Préparation</h3>
              <ol className="mt-2 space-y-2 text-[15px] leading-relaxed">
                {r.steps.map((s, k) => (
                  <li key={k} className="flex gap-2">
                    <span className="font-semibold text-orange-700">{k + 1}.</span><span>{s.text}</span>
                  </li>
                ))}
              </ol>
              {r.tips && <p className="mt-4 rounded-lg bg-orange-50 p-3 text-[15px]">💡 {r.tips}</p>}
            </div>
          </div>
          {(r.source_label || r.source_url) && (
            <p className="mt-6 text-xs text-neutral-500">Source : {r.source_label ?? r.source_url}</p>
          )}
        </article>
      ))}
      {!recipes.length && <p className="p-10 text-center">Aucune recette sélectionnée.</p>}
    </div>
  );
}
