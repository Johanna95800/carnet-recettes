"use client";

import { useEffect, useState } from "react";
import type { Recipe } from "@/lib/types";
import { ingredientParts, scaleIngredient } from "@/lib/scale";
import { ingredientsInStep } from "@/lib/match";
import { StepText } from "./StepText";

/** Mode cuisine plein écran : une étape à la fois, en grand, écran toujours allumé. */
export function CookMode({ recipe: r, factor, servingsLabel, onClose }: {
  recipe: Recipe; factor: number; servingsLabel: string | null; onClose: () => void;
}) {
  // -1 = page des ingrédients, steps.length = fin
  const [i, setI] = useState(-1);
  const last = r.steps.length;
  const go = (d: number) => setI((v) => Math.min(last, Math.max(-1, v + d)));

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = () => navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    acquire();
    // le verrou saute quand on change d'appli : on le reprend au retour
    const onVis = () => document.visibilityState === "visible" && acquire();
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      lock?.release();
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [touchX, setTouchX] = useState<number | null>(null);
  const step = r.steps[i];
  const used = step ? ingredientsInStep(step.text, r.ingredients) : [];

  const IngLine = ({ index }: { index: number }) => {
    const ing = scaleIngredient(r.ingredients[index], factor);
    const { amount, link } = ingredientParts(ing);
    return <li>{amount && <strong>{ing.approx ? "≈ " : ""}{amount} </strong>}{link}{ing.name}{ing.note && <span className="opacity-70"> ({ing.note})</span>}</li>;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-creme" role="dialog" aria-modal aria-label="Mode cuisine"
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX == null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
        setTouchX(null);
      }}>
      <header className="flex items-center gap-3 border-b border-trait px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-lg" aria-label="Quitter le mode cuisine">✕</button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{r.title}</p>
          <p className="text-xs text-encre-douce">
            {i < 0 ? "Ingrédients" : i >= last ? "Terminé" : `Étape ${i + 1} / ${last}`}{servingsLabel ? ` · ${servingsLabel}` : ""}
          </p>
        </div>
        <span className="text-xs text-encre-douce">🔆 écran allumé</span>
      </header>
      <div className="h-1 bg-trait"><div className="h-full bg-tomate transition-all" style={{ width: `${((i + 1) / (last + 1)) * 100}%` }} /></div>

      <main className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-2xl">
          {i < 0 && (
            <>
              <h2 className="titre text-2xl font-semibold">Avant de commencer</h2>
              <ul className="mt-4 space-y-2 text-xl">{r.ingredients.map((_, k) => <IngLine key={k} index={k} />)}</ul>
              {r.utensils.length > 0 && (
                <>
                  <h3 className="mt-6 font-semibold text-encre-douce">Ustensiles</h3>
                  <p className="mt-1 text-lg">{r.utensils.join(" · ")}</p>
                </>
              )}
            </>
          )}
          {step && (
            <>
              {step.group && <p className="etiquette mb-2">{step.group}</p>}
              <p className="text-2xl leading-relaxed md:text-3xl">
                <StepText text={step.text} factor={factor} label={`${r.title} — étape ${i + 1}`} big />
              </p>
              {used.length > 0 && (
                <div className="carte mt-8 p-4">
                  <p className="etiquette">Pour cette étape</p>
                  <ul className="mt-2 space-y-1 text-lg">{used.map(({ index }) => <IngLine key={index} index={index} />)}</ul>
                </div>
              )}
            </>
          )}
          {i >= last && (
            <div className="pt-10 text-center">
              <div className="text-6xl">🍽️</div>
              <h2 className="titre mt-4 text-3xl font-semibold">Bon appétit !</h2>
              {r.tips && <p className="mt-4 whitespace-pre-line text-encre-douce">💡 {r.tips}</p>}
              <button className="btn-primaire mt-8" onClick={onClose}>Quitter le mode cuisine</button>
            </div>
          )}
        </div>
      </main>

      <footer className="grid grid-cols-2 gap-3 border-t border-trait px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <button className="btn-secondaire py-4 text-lg" onClick={() => go(-1)} disabled={i < 0}>← Précédent</button>
        <button className="btn-primaire py-4 text-lg" onClick={() => go(1)} disabled={i >= last}>
          {i < 0 ? "Commencer →" : i === last - 1 ? "Terminer ✓" : "Suivant →"}
        </button>
      </footer>
    </div>
  );
}
