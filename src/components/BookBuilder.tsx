"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, categoryLabel } from "@/lib/types";
import { mergeTags, sameTag } from "@/lib/tags";

type R = { id: string; title: string; category: string; tags: string[]; favorite: boolean };

export function BookBuilder({ recipes, familyName }: { recipes: R[]; familyName: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(`Les recettes de la ${familyName.toLowerCase().startsWith("famille") ? familyName : `famille ${familyName}`}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const tags = useMemo(() => mergeTags(...recipes.map((r) => r.tags)), [recipes]);
  const cats = CATEGORIES.filter((c) => recipes.some((r) => r.category === c.value));

  const selectWhere = (f: (r: R) => boolean) => setSelected(new Set(recipes.filter(f).map((r) => r.id)));
  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  function generate() {
    // ordre du livre : par catégorie (apéritif → dessert…), puis alphabétique
    const order = CATEGORIES.map((c) => c.value as string);
    const ids = recipes.filter((r) => selected.has(r.id))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.title.localeCompare(b.title, "fr"))
      .map((r) => r.id);
    router.push(`/livre/imprimer?titre=${encodeURIComponent(title)}&ids=${ids.join(",")}`);
  }

  const Quick = ({ label, f }: { label: string; f: (r: R) => boolean }) => (
    <button className="shrink-0 rounded-full border border-trait bg-papier px-3 py-1 text-sm hover:border-tomate" onClick={() => selectWhere(f)}>{label}</button>
  );

  return (
    <div className="mt-5 space-y-4">
      <label className="block space-y-1">
        <span className="etiquette">Titre du livre</span>
        <input className="champ" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="space-y-2">
        <span className="etiquette">Sélection rapide</span>
        <div className="flex flex-wrap gap-1.5">
          <Quick label="Toutes" f={() => true} />
          <Quick label="❤️ Mes favoris" f={(r) => r.favorite} />
          {cats.map((c) => <Quick key={c.value} label={`${c.emoji} ${c.label}`} f={(r) => r.category === c.value} />)}
          {tags.map((t) => <Quick key={t} label={`🏷️ ${t}`} f={(r) => r.tags.some((x) => sameTag(x, t))} />)}
          {selected.size > 0 && <button className="px-2 text-sm text-encre-douce underline" onClick={() => setSelected(new Set())}>Tout décocher</button>}
        </div>
      </div>
      <ul className="carte divide-y divide-trait">
        {recipes.map((r) => (
          <li key={r.id}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-tomate)]" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              <span className="flex-1">{r.title}</span>
              <span className="text-sm text-encre-douce">{categoryLabel(r.category).emoji}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-2xl bg-creme/90 py-2 backdrop-blur md:bottom-4">
        <button className="btn-primaire w-full" disabled={!selected.size} onClick={generate}>
          Créer le livre ({selected.size} recette{selected.size > 1 ? "s" : ""})
        </button>
      </div>
    </div>
  );
}
