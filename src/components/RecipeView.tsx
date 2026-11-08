"use client";

import { useEffect, useState } from "react";
import type { Recipe } from "@/lib/types";
import { ingredientParts, isPeopleUnit, scaleIngredient } from "@/lib/scale";
import { StepText } from "./StepText";
import { CookMode } from "./CookMode";
import { usePreferredServings } from "@/lib/preferences";
import { ServingsStepper } from "./ServingsStepper";

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
  const [pref] = usePreferredServings();
  const [servings, setServings] = useState(r.servings ?? 0);
  const [touched, setTouched] = useState(false);
  // ouvre la recette ajustée au nombre de personnes habituel (si la recette est exprimée en personnes)
  useEffect(() => {
    if (!touched && pref && r.servings && isPeopleUnit(r.servings_unit)) setServings(pref);
  }, [pref]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeServings = (v: number) => { setTouched(true); setServings(v); };
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const [cooking, setCooking] = useState(false);
  const factor = r.servings && servings ? servings / r.servings : 1;
  const unit = r.servings_unit || "personnes";


  const toggle = (s: Set<number>, set: (v: Set<number>) => void, i: number) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i); else n.add(i);
    set(n);
  };

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-6">
        <section>
          {r.servings ? (
            <div className="carte mb-5 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-medium">Pour</span>
                <ServingsStepper value={servings} onChange={changeServings} label={`Nombre de ${unit}`} />
                <span className="font-medium">{unit}</span>
              </div>
              {factor !== 1 && (
                <div className="mt-3 space-y-1 text-sm text-encre-douce">
                  <p>
                    Quantités recalculées (recette d&apos;origine : {r.servings} {unit}).{" "}
                    <button className="underline" onClick={() => changeServings(r.servings!)}>Revenir à l&apos;origine</button>
                  </p>
                  <p>⚠️ Pensez à adapter la taille du moule et à surveiller la cuisson.</p>
                </div>
              )}
            </div>
          ) : null}
          <h2 className="titre text-xl font-semibold">Ingrédients</h2>
          {groupBy(r.ingredients).map((g, gi) => (
            <div key={gi} className="mt-3">
              {g.name && <h3 className="etiquette mb-1">{g.name}</h3>}
              <ul className="space-y-1">
                {g.items.map(({ item: original, index }) => {
                  const ing = scaleIngredient(original, factor);
                  const { amount, link } = ingredientParts(ing);
                  return (
                  <li key={index}>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1.5 ${checked.has(index) ? "text-encre-douce line-through" : ""}`}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-tomate)]" checked={checked.has(index)}
                        onChange={() => toggle(checked, setChecked, index)} />
                      <span>
                        {amount && <strong>{ing.approx ? "≈ " : ""}{amount} </strong>}
                        {link}{ing.name}
                        {ing.note && <span className="text-encre-douce"> ({ing.note})</span>}
                      </span>
                    </label>
                  </li>
                  );
                })}
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
          <button className="btn-primaire py-1.5 text-sm" onClick={() => setCooking(true)}>👩‍🍳 Mode cuisine</button>
        </div>
        {groupBy(r.steps).map((g, gi) => (
          <div key={gi} className="mt-3">
            {g.name && <h3 className="etiquette mb-2">{g.name}</h3>}
            <ol className="space-y-3">
              {g.items.map(({ item: s, index }) => (
                <li key={index}>
                  <div role="button" tabIndex={0} onClick={() => toggle(done, setDone, index)}
                    onKeyDown={(e) => { if (e.key === "Enter") toggle(done, setDone, index); }}
                    className={`flex w-full cursor-pointer gap-3 text-left ${done.has(index) ? "opacity-45" : ""}`}>
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done.has(index) ? "bg-basilic text-white" : "bg-tomate text-sur-tomate"}`}>
                      {done.has(index) ? "✓" : index + 1}
                    </span>
                    <span className="leading-relaxed">
                      <StepText text={s.text} factor={factor} label={`${r.title} — étape ${index + 1}`} />
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {cooking && (
          <CookMode recipe={r} factor={factor} onClose={() => setCooking(false)}
            servingsLabel={r.servings ? `${servings} ${unit}` : null} />
        )}
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
