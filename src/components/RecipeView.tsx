"use client";

import { useEffect, useState } from "react";
import { formatQuantity, type Recipe } from "@/lib/types";

function groupBy<T extends { group: string | null }>(items: T[]) {
  const groups: { name: string | null; items: { item: T; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push({ item, index });
    else groups.push({ name: item.group, items: [{ item, index }] });
  });
  return groups;
}

export function RecipeView({ recipe: r }: { recipe: Recipe }) {
  const [servings, setServings] = useState(r.servings ?? 0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const [cooking, setCooking] = useState(false);
  const factor = r.servings && servings ? servings / r.servings : 1;

  // Mode cuisine : l'écran du téléphone ne se met pas en veille
  useEffect(() => {
    if (!cooking || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => { lock?.release(); };
  }, [cooking]);

  const toggle = (s: Set<number>, set: (v: Set<number>) => void, i: number) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i); else n.add(i);
    set(n);
  };

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between gap-2">
            <h2 className="titre text-xl font-semibold">Ingrédients</h2>
            {r.servings ? (
              <div className="flex items-center gap-1 rounded-xl border border-trait bg-papier">
                <button className="px-3 py-1.5 text-lg" onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Moins">−</button>
                <span className="min-w-20 text-center text-sm font-medium">{servings} {r.servings_unit ?? "pers."}</span>
                <button className="px-3 py-1.5 text-lg" onClick={() => setServings(servings + 1)} aria-label="Plus">+</button>
              </div>
            ) : null}
          </div>
          {groupBy(r.ingredients).map((g, gi) => (
            <div key={gi} className="mt-3">
              {g.name && <h3 className="etiquette mb-1">{g.name}</h3>}
              <ul className="space-y-1">
                {g.items.map(({ item: ing, index }) => (
                  <li key={index}>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1.5 ${checked.has(index) ? "text-encre-douce line-through" : ""}`}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-tomate)]" checked={checked.has(index)}
                        onChange={() => toggle(checked, setChecked, index)} />
                      <span>
                        {ing.quantity != null && <strong>{formatQuantity(ing.quantity * factor)} </strong>}
                        {ing.unit && <strong>{ing.unit} </strong>}
                        {ing.unit && ing.quantity != null && /^[aeiouyhéèêàâîôûœ]/i.test(ing.name) ? "d'" : ing.unit && ing.quantity != null ? "de " : ""}
                        {ing.name}
                        {ing.note && <span className="text-encre-douce"> ({ing.note})</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {r.utensils.length > 0 && (
          <section>
            <h2 className="titre text-xl font-semibold">Ustensiles</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {r.utensils.map((u) => <li key={u} className="rounded-full border border-trait bg-papier px-3 py-1 text-sm">{u}</li>)}
            </ul>
          </section>
        )}
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="titre text-xl font-semibold">Préparation</h2>
          <button className={`btn py-1.5 text-sm ${cooking ? "bg-basilic text-white" : "btn-secondaire"}`} onClick={() => setCooking(!cooking)}>
            {cooking ? "🔆 Écran allumé" : "👩‍🍳 Mode cuisine"}
          </button>
        </div>
        {groupBy(r.steps).map((g, gi) => (
          <div key={gi} className="mt-3">
            {g.name && <h3 className="etiquette mb-2">{g.name}</h3>}
            <ol className="space-y-3">
              {g.items.map(({ item: s, index }) => (
                <li key={index}>
                  <button onClick={() => toggle(done, setDone, index)}
                    className={`flex w-full gap-3 text-left ${cooking ? "text-lg" : ""} ${done.has(index) ? "opacity-45" : ""}`}>
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done.has(index) ? "bg-basilic text-white" : "bg-tomate text-sur-tomate"}`}>
                      {done.has(index) ? "✓" : index + 1}
                    </span>
                    <span className="leading-relaxed">{s.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {r.tips && (
          <aside className="carte mt-6 bg-creme p-4">
            <h3 className="font-semibold">💡 Astuces</h3>
            <p className="mt-1 whitespace-pre-line">{r.tips}</p>
          </aside>
        )}
      </section>
    </div>
  );
}
