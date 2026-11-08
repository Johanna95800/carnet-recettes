import { formatQuantity, type Ingredient } from "@/lib/types";

/** Unités de « personnes » : seules celles-ci reçoivent le nombre de personnes préféré. */
export function isPeopleUnit(unit: string | null) {
  if (!unit) return true;
  return /^(pers|personne|convive|part|portion|assiette)/i.test(unit.trim());
}

type Kind = "mass" | "volume" | "spoon" | "count" | "other";

const MASS: Record<string, number> = { mg: 0.001, g: 1, gr: 1, gramme: 1, grammes: 1, kg: 1000, kilo: 1000, kilos: 1000 };
const VOLUME: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, litre: 1000, litres: 1000 };

function normUnit(u: string) {
  return u.trim().toLowerCase().replace(/\.$/, "");
}

function kindOf(unit: string | null): Kind {
  if (!unit) return "count";
  const u = normUnit(unit);
  if (u in MASS) return "mass";
  if (u in VOLUME) return "volume";
  if (/(cuill|c\.?\s?à|cs$|cc$|cas$|cac$|pinc|soupe|café)/.test(u)) return "spoon";
  return "other";
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

function roundGrams(g: number) {
  if (g < 10) return Math.max(0.5, roundTo(g, 0.5));
  if (g < 50) return roundTo(g, 1);
  if (g < 250) return roundTo(g, 5);
  if (g < 1000) return roundTo(g, 10);
  return roundTo(g, 50);
}

/** Exprime une masse (g) ou un volume (ml) dans l'unité la plus lisible. */
function prettyMetric(base: number, kind: "mass" | "volume", originalUnit: string) {
  if (kind === "mass") {
    const g = roundGrams(base);
    if (g >= 1000) return { quantity: g / 1000, unit: "kg" };
    if (g < 1 && MASS[normUnit(originalUnit)] === 0.001) return { quantity: Math.round(g * 1000), unit: "mg" };
    return { quantity: g, unit: "g" };
  }
  const ml = roundGrams(base);
  const orig = normUnit(originalUnit);
  if (ml >= 1000) return { quantity: ml / 1000, unit: "l" };
  // garde les cl si la recette les utilise (habituel en France)
  if ((orig === "cl" || orig === "l" || orig === "litre" || orig === "litres") && ml >= 10) {
    return { quantity: roundTo(ml / 10, ml < 100 ? 0.5 : 1), unit: "cl" };
  }
  if (orig === "dl" && ml >= 100) return { quantity: roundTo(ml / 100, 0.5), unit: "dl" };
  return { quantity: ml, unit: "ml" };
}

export type ScaledIngredient = Ingredient & { approx: boolean };

export function scaleIngredient(ing: Ingredient, factor: number): ScaledIngredient {
  if (ing.quantity == null || factor === 1) return { ...ing, approx: false };
  const exact = ing.quantity * factor;
  const kind = kindOf(ing.unit);
  let quantity: number;
  let unit = ing.unit;

  switch (kind) {
    case "mass":
    case "volume": {
      const table = kind === "mass" ? MASS : VOLUME;
      const base = exact * table[normUnit(ing.unit!)];
      ({ quantity, unit } = prettyMetric(base, kind, ing.unit!));
      return { ...ing, quantity, unit, approx: false };
    }
    case "count":
      // œufs, oignons… : on reste sur des unités entières (ou ½ / ¼ en dessous de 1)
      quantity = exact < 1 ? Math.max(0.25, roundTo(exact, 0.25)) : Math.max(1, Math.round(exact));
      break;
    case "spoon":
    case "other":
      quantity = exact < 2 ? Math.max(0.25, roundTo(exact, 0.25)) : roundTo(exact, 0.5);
      break;
  }
  return { ...ing, quantity, unit, approx: Math.abs(quantity - exact) / exact > 0.05 };
}

/** Quantité affichable : décimales pour g/kg/ml/cl/l, fractions (½, ¾…) pour le reste. */
export function formatAmount(q: number, unit: string | null) {
  const k = kindOf(unit);
  if (k === "mass" || k === "volume") {
    return String(Math.round(q * 100) / 100).replace(".", ",");
  }
  return formatQuantity(q);
}

/** Texte « 200 g de farine » prêt à afficher. */
export function ingredientParts(ing: Ingredient) {
  const qty = ing.quantity != null ? formatAmount(ing.quantity, ing.unit) : "";
  const unit = ing.unit ?? "";
  const link = ing.quantity != null && ing.unit ? (/^[aeiouyhéèêàâîôûœ]/i.test(ing.name) ? "d'" : "de ") : "";
  return { amount: [qty, unit].filter(Boolean).join(" "), link };
}

/** Recalcule les quantités métriques écrites dans le texte d'une étape (« 50 cl de lait »). */
export function scaleStepText(text: string, factor: number): { text: string; scaled: boolean }[] {
  if (factor === 1) return [{ text, scaled: false }];
  const re = /(?<![\d/,.])(\d+(?:[.,]\d+)?)\s?(kg|mg|g|gr|ml|cl|dl|l)(?![\p{L}'’])/giu;
  const out: { text: string; scaled: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const kind = kindOf(m[2]);
    if (kind !== "mass" && kind !== "volume") continue;
    const table = kind === "mass" ? MASS : VOLUME;
    const base = Number(m[1].replace(",", ".")) * factor * table[normUnit(m[2])];
    const p = prettyMetric(base, kind, m[2]);
    out.push({ text: text.slice(last, m.index), scaled: false });
    out.push({ text: `${formatAmount(p.quantity, p.unit)} ${p.unit}`, scaled: true });
    last = m.index! + m[0].length;
  }
  out.push({ text: text.slice(last), scaled: false });
  return out.filter((p) => p.text);
}

/** Filet de sécurité : « 350°F » → « 180 °C » (arrondi à 5) si une recette en contient encore. */
export function convertFahrenheit(text: string) {
  return text.replace(/(\d{3})\s?°\s?F\b/g, (_, f) => `${Math.round(((Number(f) - 32) * 5) / 9 / 5) * 5} °C`);
}
