import type { Ingredient } from "@/lib/types";

const STOP = new Set(["frais", "fraiche", "fraîche", "entier", "entiers", "gros", "grosse", "petit", "petite", "doux", "demi", "sel",
  "poudre", "bien", "type", "pour", "avec", "sans", "fin", "fine", "extra", "huile"]);
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const stem = (w: string) => w.replace(/(aux|eaux|s|x)$/, "");

/** Ingrédients cités dans le texte d'une étape (« ajoutez la farine » → farine). */
export function ingredientsInStep(text: string, ingredients: Ingredient[]) {
  const words = new Set(norm(text).split(/[^a-z0-9]+/).filter(Boolean).map(stem));
  return ingredients
    .map((ing, index) => ({ ing, index }))
    .filter(({ ing }) => {
      const tokens = norm(ing.name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
      const keys = tokens.length ? tokens : norm(ing.name).split(/\s+/);
      // le premier mot significatif est le plus discriminant (« beurre » dans « beurre doux »)
      return words.has(stem(keys[0])) || (keys.length > 1 && keys.slice(1).every((k) => words.has(stem(k))));
    });
}
