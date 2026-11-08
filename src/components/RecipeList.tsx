"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, categoryLabel, difficultyLabel } from "@/lib/types";

export type RecipeCard = {
  id: string; title: string; category: string; difficulty: string | null; tags: string[];
  durations: string[]; photo: string | null; search: string;
};

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function RecipeList({ recipes }: { recipes: RecipeCard[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const present = useMemo(() => new Set(recipes.map((r) => r.category)), [recipes]);

  const shown = recipes.filter((r) => {
    if (cat && r.category !== cat) return false;
    if (!q.trim()) return true;
    const hay = norm(r.search);
    return norm(q).split(/\s+/).every((w) => hay.includes(w));
  });

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
      {shown.length === 0 && <p className="py-10 text-center text-encre-douce">Aucune recette ne correspond.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((r) => {
          const c = categoryLabel(r.category);
          return (
            <li key={r.id}>
              <Link href={`/recettes/${r.id}`} className="carte block overflow-hidden transition hover:border-tomate">
                <div className="flex aspect-[4/3] items-center justify-center bg-creme text-4xl">
                  {r.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : c.emoji}
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 font-semibold leading-snug">{r.title}</h2>
                  <p className="mt-1 text-xs text-encre-douce">
                    {[c.label, difficultyLabel(r.difficulty)].filter(Boolean).join(" · ")}
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
