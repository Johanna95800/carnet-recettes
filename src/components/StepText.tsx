"use client";

import { splitDurations } from "@/lib/durations";
import { scaleStepText } from "@/lib/scale";
import { useTimers } from "./Timers";

/** Texte d'une étape : quantités ajustées en couleur, durées cliquables (minuteur). */
export function StepText({ text, factor, label, big = false }: { text: string; factor: number; label: string; big?: boolean }) {
  const { start } = useTimers();
  return (
    <>
      {scaleStepText(text, factor).flatMap((part, i) =>
        part.scaled
          ? [<strong key={i} className="text-tomate">{part.text}</strong>]
          : splitDurations(part.text).map((p, j) =>
              p.minutes ? (
                <button key={`${i}-${j}`} type="button"
                  onClick={(e) => { e.stopPropagation(); start(label, p.minutes!); }}
                  className={`mx-0.5 inline-flex items-center gap-1 rounded-full border border-tomate/40 bg-tomate/10 px-2 font-semibold text-tomate ${big ? "py-1" : "py-0"}`}
                  title="Lancer un minuteur">
                  ⏱ {p.text}
                </button>
              ) : (
                <span key={`${i}-${j}`}>{p.text}</span>
              ),
            ),
      )}
    </>
  );
}
