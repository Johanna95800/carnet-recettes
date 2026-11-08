"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, categoryLabel, difficultyLabel } from "@/lib/types";
import { mergeTags, sameTag } from "@/lib/tags";

export type RecipeCard = {
  id: string; title: string; category: string; difficulty: string | null; tags: string[];
  durations: string[]; photo: string | null; search: string;
  created_at: string; favorite: boolean; cooked: boolean; cookedByAnyone: boolean; rating: number | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function RecipeList({ recipes, initialTag }: { recipes: RecipeCard[]; initialTag: string | null }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(initialTag);
  const [mine, setMine] = useState<"favoris" | "faites" | "a-tester" | null>(null);
  const [sort, setSort] = useState<"recent" | "note" | "alpha">("recent");
  const present = useMemo(() => new Set(recipes.map((r) => r.category)), [recipes]);
  // tags triés du plus utilisé au moins utilisé
  const allTags = useMemo(() => {
    const tags = mergeTags(...recipes.map((r) => r.tags));
    const count = (t: string) => recipes.filter((r) => r.tags.some((x) => sameTag(x, t))).length;
    return tags.sort((a, b) => count(b) - count(a) || a.localeCompare(b, "fr"));
  }, [recipes]);

  const shown = recipes.filter((r) => {
    if (cat && r.category !== cat) return false;
    if (tag && !r.tags.some((t) => sameTag(t, tag))) return false;
    if (mine === "favoris" && !r.favorite) return false;
    if (mine === "faites" && !r.cooked) return false;
    if (mine === "a-tester" && r.cookedByAnyone) return false;
    if (!q.trim()) return true;
    const hay = norm(r.search);
    return norm(q).split(/\s+/).every((w) => hay.includes(w));
  });

  shown.sort((a, b) =>
    sort === "note" ? (b.rating ?? 0) - (a.rating ?? 0) || b.created_at.localeCompare(a.created_at)
    : sort === "alpha" ? a.title.localeCompare(b.title, "fr")
    : b.created_at.localeCompare(a.created_at));

  return (
    <>
      <input className="champ mb-3" type="search" placeholder="Rechercher une recette, un ingrédient…"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={!cat} onClick={() => setCat(null)}>Toutes</Chip>
        {CATEGORIES.filter((c) => present.has(c.value)).map((c) => (
          <Chip key={c.value} active={cat === c.value} onClick={() => setCat(cat === c.value ? null : c.value)}>
            {c.emoji} {c.label}
          </Chip>
        ))}
      </div>
      {allTags.length > 0 && (
        <div className="-mx-4 -mt-3 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {allTags.map((t) => {
            const on = !!tag && sameTag(tag, t);
            return (
              <button key={t} onClick={() => setTag(on ? null : t)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-sm ${on ? "border-tomate bg-tomate/10 font-medium text-tomate" : "border-trait text-encre-douce"}`}>
                🏷️ {t}{on ? " ✕" : ""}
              </button>
            );
          })}
        </div>
      )}
      <div className="-mx-4 -mt-3 mb-5 flex items-center gap-1.5 overflow-x-auto px-4 pb-1">
        {([["favoris", "❤️ Mes favoris"], ["faites", "✓ Déjà faites"], ["a-tester", "🆕 Jamais testées"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setMine(mine === k ? null : k)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-sm ${mine === k ? "border-tomate bg-tomate/10 font-medium text-tomate" : "border-trait text-encre-douce"}`}>
            {label}{mine === k ? " ✕" : ""}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Trier"
          className="ml-auto shrink-0 rounded-full border border-trait bg-papier px-2.5 py-1 text-sm text-encre-douce">
          <option value="recent">Plus récentes</option>
          <option value="note">Mieux notées</option>
          <option value="alpha">A → Z</option>
        </select>
      </div>
      {shown.length === 0 && <p className="py-10 text-center text-encre-douce">Aucune recette ne correspond.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((r) => {
          const c = categoryLabel(r.category);
          return (
            <li key={r.id}>
              <Link href={`/recettes/${r.id}`} className="carte block overflow-hidden transition hover:border-tomate">
                <div className="relative flex aspect-[4/3] items-center justify-center bg-creme text-4xl">
                  {r.favorite && <span className="absolute right-1.5 top-1.5 z-10 text-base drop-shadow">❤️</span>}
                  {r.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : c.emoji}
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 font-semibold leading-snug">{r.title}</h2>
                  <p className="mt-1 text-xs text-encre-douce">
                    {[c.label, difficultyLabel(r.difficulty), r.rating != null ? `★ ${r.rating.toLocaleString("fr", { maximumFractionDigits: 1 })}` : null].filter(Boolean).join(" · ")}
                  </p>
                  {r.durations.length > 0 && (
                    <p className="mt-0.5 text-xs text-encre-douce">{r.durations.join("  ")}</p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${active ? "border-tomate bg-tomate text-sur-tomate" : "border-trait bg-papier"}`}>
      {children}
    </button>
  );
}
