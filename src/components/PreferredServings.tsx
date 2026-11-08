"use client";

import { usePreferredServings } from "@/lib/preferences";
import { ServingsStepper } from "./ServingsStepper";

export function PreferredServings() {
  const [pref, setPref] = usePreferredServings();
  return (
    <section className="carte p-5">
      <h2 className="font-semibold">Je cuisine habituellement pour…</h2>
      <p className="mt-1 text-sm text-encre-douce">
        Les recettes s&apos;ouvriront directement avec les quantités ajustées. Réglage propre à cet appareil.
      </p>
      <div className="mt-3 flex items-center gap-3">
        {pref ? (
          <>
            <ServingsStepper value={pref} onChange={setPref} label="Nombre de personnes habituel" />
            <span>personnes</span>
            <button className="ml-auto text-sm text-encre-douce underline" onClick={() => setPref(null)}>Désactiver</button>
          </>
        ) : (
          <button className="btn-secondaire" onClick={() => setPref(4)}>Choisir un nombre de personnes</button>
        )}
      </div>
    </section>
  );
}
