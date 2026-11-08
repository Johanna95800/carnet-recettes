import { z } from "zod";

export const CATEGORIES = [
  { value: "aperitif", label: "Apéritif", emoji: "🥂" },
  { value: "entree", label: "Entrée", emoji: "🥗" },
  { value: "plat", label: "Plat", emoji: "🍲" },
  { value: "accompagnement", label: "Accompagnement", emoji: "🥔" },
  { value: "dessert", label: "Dessert", emoji: "🍰" },
  { value: "boisson", label: "Boisson", emoji: "🍹" },
  { value: "sauce", label: "Sauce", emoji: "🫙" },
  { value: "petit-dejeuner", label: "Petit-déjeuner", emoji: "🥐" },
  { value: "autre", label: "Autre", emoji: "🍽️" },
] as const;

export const DIFFICULTIES = [
  { value: "tres-facile", label: "Très facile" },
  { value: "facile", label: "Facile" },
  { value: "moyen", label: "Moyen" },
  { value: "difficile", label: "Difficile" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];
export type Difficulty = (typeof DIFFICULTIES)[number]["value"];

const categoryValues = CATEGORIES.map((c) => c.value) as [Category, ...Category[]];
const difficultyValues = DIFFICULTIES.map((d) => d.value) as [Difficulty, ...Difficulty[]];

/** Schéma rempli par l'IA lors d'un import (photo ou URL). */
export const ExtractedRecipeSchema = z.object({
  found: z.boolean().describe("false si l'image/la page ne contient pas de recette lisible"),
  title: z.string(),
  description: z.string().nullable().describe("Courte présentation (1-2 phrases) si présente dans la source"),
  category: z.enum(categoryValues),
  difficulty: z.enum(difficultyValues).nullable(),
  servings: z.number().nullable().describe("Nombre de personnes / parts"),
  servings_unit: z.string().nullable().describe("ex. 'personnes', 'parts', 'pièces', 'verrines'"),
  prep_minutes: z.number().nullable().describe("Temps de travail actif uniquement (éplucher, mélanger…), sans cuisson ni attente"),
  cook_minutes: z.number().nullable().describe("Temps de cuisson (four, plaque…)"),
  rest_minutes: z.number().nullable().describe("Temps d'attente sans intervention : repos, refroidissement, réfrigération, congélation, levée, marinade, trempage…"),
  rest_label: z.string().nullable().describe("Nature du temps d'attente, un ou deux mots avec majuscule : 'Réfrigération', 'Refroidissement', 'Repos', 'Levée', 'Marinade', 'Congélation', 'Trempage'"),
  ingredients: z.array(
    z.object({
      quantity: z.number().nullable().describe("Valeur numérique (0.5 pour 1/2). null si 'une pincée', 'selon le goût'..."),
      unit: z.string().nullable().describe("g, kg, ml, cl, l, c. à soupe, c. à café, pincée, sachet, tranche... null pour un nombre d'unités (3 œufs)"),
      name: z.string(),
      note: z.string().nullable().describe("Précision : 'ramolli', 'en dés', 'facultatif'..."),
      group: z.string().nullable().describe("Sous-partie de la recette si la source en a (ex. 'Pâte', 'Garniture')"),
    }),
  ),
  steps: z.array(
    z.object({
      text: z.string(),
      group: z.string().nullable(),
    }),
  ),
  utensils: z.array(z.string()).describe("Ustensiles et matériel nécessaires"),
  tips: z.string().nullable().describe("Astuces, variantes, conseils de conservation"),
  tags: z.array(z.string()).describe("3 à 6 mots-clés utiles (ex. végétarien, rapide, hiver, chocolat)"),
  images: z
    .array(
      z.object({
        image_index: z.number().describe("Index (0-based) de l'image fournie"),
        rotation: z
          .enum(["0", "90", "180", "270"])
          .describe("Rotation dans le sens des aiguilles d'une montre à appliquer pour que le texte se lise à l'endroit"),
      }),
    )
    .describe("Une entrée par image fournie (vide pour une page web)"),
});
export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;

export type Ingredient = ExtractedRecipe["ingredients"][number];
export type Step = ExtractedRecipe["steps"][number];

export type SourceType = "url" | "photo-manuscrite" | "photo-livre" | "manuel";

export interface Recipe {
  id: string;
  family_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  category: Category;
  difficulty: Difficulty | null;
  servings: number | null;
  servings_unit: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  rest_minutes: number | null;
  rest_label: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  utensils: string[];
  tips: string | null;
  tags: string[];
  photos: string[];
  source_type: SourceType | null;
  source_url: string | null;
  source_label: string | null;
  created_at: string;
  updated_at: string;
}

/** Brouillon édité dans le formulaire avant enregistrement. */
export type RecipeDraft = Omit<Recipe, "id" | "family_id" | "created_by" | "created_at" | "updated_at">;

export function emptyDraft(): RecipeDraft {
  return {
    title: "",
    description: null,
    category: "plat",
    difficulty: null,
    servings: 4,
    servings_unit: "personnes",
    prep_minutes: null,
    cook_minutes: null,
    rest_minutes: null,
    rest_label: null,
    ingredients: [],
    steps: [],
    utensils: [],
    tips: null,
    tags: [],
    photos: [],
    source_type: "manuel",
    source_url: null,
    source_label: null,
  };
}

export function categoryLabel(c: string) {
  return CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[CATEGORIES.length - 1];
}
export function difficultyLabel(d: string | null) {
  return DIFFICULTIES.find((x) => x.value === d)?.label ?? null;
}

export const REST_LABELS = ["Repos", "Refroidissement", "Réfrigération", "Congélation", "Levée", "Marinade", "Trempage", "Infusion"];

/** Lit « 1h30 », « 12 h », « 45 », « 45 min » → minutes. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  const h = s.match(/^(\d+(?:\.\d+)?)\s*h(?:eures?)?\s*(\d+)?\s*(?:min)?$/);
  if (h) return Math.round(Number(h[1]) * 60 + Number(h[2] ?? 0));
  const m = s.match(/^(\d+)\s*(?:min(?:utes?)?|mn)?$/);
  if (m) return Number(m[1]);
  const d = s.match(/^(\d+(?:\.\d+)?)\s*j(?:ours?)?$/);
  if (d) return Math.round(Number(d[1]) * 1440);
  return NaN;
}

export function formatMinutes(m: number | null | undefined) {
  if (!m) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

const FRACTIONS: [number, string][] = [
  [0.25, "¼"], [0.333, "⅓"], [0.5, "½"], [0.667, "⅔"], [0.75, "¾"],
];
export function formatQuantity(q: number | null) {
  if (q == null) return "";
  const whole = Math.floor(q);
  const frac = q - whole;
  for (const [v, s] of FRACTIONS) {
    if (Math.abs(frac - v) < 0.04) return whole ? `${whole} ${s}` : s;
  }
  if (frac < 0.04) return String(whole);
  return String(Math.round(q * 10) / 10).replace(".", ",");
}
