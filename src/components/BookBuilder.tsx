"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/types";
import { mergeTags, sameTag } from "@/lib/tags";

type R = { id: string; title: string; category: string; tags: string[]; favorite: boolean };

export function BookBuilder({ recipes, familyName }: { recipes: R[]; familyName: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(`Les recettes de la ${familyName.toLowerCase().startsWith("famille") ? familyName : `famille ${familyName}`}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const tags = useMemo(() => mergeTags(...recipes.map((r) => r.tags)), [recipes]);
  const cats = CATEGORIES.filter((c) => recipes.some((r) => r.category === c.value));

  const idsWhere = (f: (r: R) => boolean) => recipes.filter(f).map((r) => r.id);
  const allIn = (ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id));
  /** Ajoute le groupe à la sélection, ou le retire s'il est déjà entièrement coché. */
  const toggleGroup = (ids: string[]) => {
    const n = new Set(selected);
    if (allIn(ids)) ids.forEach((id) => n.delete(id)); else ids.forEach((id) => n.add(id));
    setSelected(n);
  };
  const toggle = (id: string) => toggleGroup([id]);
  const everything = recipes.map((r) => r.id);

  function generate() {
    // ordre du livre : par catégorie (apéritif → dessert…), puis alphabétique
    const order = CATEGORIES.map((c) => c.value as string);
    const ids = recipes.filter((r) => selected.has(r.id))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.title.localeCompare(b.title, "fr"))
      .map((r) => r.id);
    router.push(`/livre/imprimer?titre=${encodeURIComponent(title)}&ids=${ids.join(",")}`);
  }

  const Quick = ({ label, f }: { label: string; f: (r: R) => boolean }) => {
    const ids = idsWhere(f);
    const on = allIn(ids);
    return (
      <button onClick={() => toggleGroup(ids)} aria-pressed={on}
        className={`shrink-0 rounded-full border px-3 py-1 text-sm ${on ? "border-tomate bg-tomate/10 font-medium text-tomate" : "border-trait bg-papier hover:border-tomate"}`}>
        {on ? "✓ " : ""}{label} <span className="opacity-60">({ids.length})</span>
      </button>
    );
  };

  return (
    <div className="mt-5 space-y-4">
      <label className="block space-y-1">
        <span className="etiquette">Titre du livre</span>
        <input className="champ" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="etiquette">{selected.size} / {recipes.length} sélectionnée{selected.size > 1 ? "s" : ""}</span>
        <button className="btn-secondaire py-1.5 text-sm" onClick={() => setSelected(allIn(everything) ? new Set() : new Set(everything))}>
          {allIn(everything) ? "☐ Tout désélectionner" : "☑ Tout sélectionner"}
        </button>
      </div>
      <div className="space-y-2">
        <span className="etiquette">Ajouter ou retirer d&apos;un coup</span>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => <Quick key={c.value} label={`${c.emoji} ${c.label}`} f={(r) => r.category === c.value} />)}
          <Quick label="❤️ Mes favoris" f={(r) => r.favorite} />
          {tags.map((t) => <Quick key={t} label={`🏷️ ${t}`} f={(r) => r.tags.some((x) => sameTag(x, t))} />)}
        </div>
      </div>
      {cats.map((c) => {
        const inCat = recipes.filter((r) => r.category === c.value);
        const ids = inCat.map((r) => r.id);
        const some = ids.some((id) => selected.has(id));
        return (
          <section key={c.value} className="carte overflow-hidden">
            <label className="flex cursor-pointer items-center gap-3 bg-creme px-4 py-2.5 font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-tomate)]" checked={allIn(ids)}
                ref={(el) => { if (el) el.indeterminate = some && !allIn(ids); }}
                onChange={() => toggleGroup(ids)} />
              <span className="flex-1">{c.emoji} {c.label}</span>
              <span className="text-sm font-normal text-encre-douce">{ids.filter((id) => selected.has(id)).length} / {ids.length}</span>
            </label>
            <ul className="divide-y divide-trait">
              {inCat.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 pl-11">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-tomate)]" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    <span className="flex-1">{r.title}</span>
                    {r.favorite && <span aria-label="favori">❤️</span>}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-2xl bg-creme/90 py-2 backdrop-blur md:bottom-4">
        <button className="btn-primaire w-full" disabled={!selected.size} onClick={generate}>
          Créer le livre ({selected.size} recette{selected.size > 1 ? "s" : ""})
        </button>
      </div>
    </div>
  );
}
