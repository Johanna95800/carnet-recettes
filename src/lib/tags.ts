export const SUGGESTED_TAGS = [
  "Noël", "Fête", "Anniversaire", "Pâques", "Végétarien", "Vegan", "Sans gluten", "Sans lactose",
  "Rapide", "Facile", "Petit budget", "Été", "Hiver", "Pique-nique", "Apéro dînatoire", "Batch cooking",
  "Recette de famille", "Enfants",
];

const key = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Nettoie un tag : espaces, majuscule initiale. */
export function cleanTag(t: string) {
  const s = t.replace(/^#/, "").replace(/\s+/g, " ").trim();
  return s ? s[0].toLocaleUpperCase("fr") + s.slice(1) : "";
}

export const sameTag = (a: string, b: string) => key(a) === key(b);

/** Fusionne des listes de tags sans doublon (insensible à la casse et aux accents). */
export function mergeTags(...lists: string[][]) {
  const out: string[] = [];
  for (const t of lists.flat().map(cleanTag)) if (t && !out.some((o) => sameTag(o, t))) out.push(t);
  return out;
}
