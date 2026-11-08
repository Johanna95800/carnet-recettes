import { formatMinutes } from "@/lib/types";

type T = { prep_minutes: number | null; cook_minutes: number | null; rest_minutes: number | null; rest_label: string | null };

/** Liste des temps, chacun avec son libellé (jamais un total ambigu). */
export function durationItems(r: T) {
  return [
    { icon: "🔪", label: "Préparation", value: formatMinutes(r.prep_minutes) },
    { icon: "🔥", label: "Cuisson", value: formatMinutes(r.cook_minutes) },
    { icon: restIcon(r.rest_label), label: r.rest_label || "Repos", value: formatMinutes(r.rest_minutes) },
  ].filter((x): x is { icon: string; label: string; value: string } => !!x.value);
}

function restIcon(label: string | null) {
  const l = (label ?? "").toLowerCase();
  if (/frig|frais|congel|froid/.test(l)) return "❄️";
  if (/lev|pous/.test(l)) return "🫓";
  if (/marin|tremp|infus/.test(l)) return "🫙";
  return "⏳";
}
