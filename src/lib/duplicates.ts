const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "a", "au", "aux", "et", "en", "a", "un", "une", "facon", "maison", "recette", "ma", "mon", "the", "with"]);

function tokens(title: string) {
  return new Set(
    title.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
      .split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w))
      .map((w) => w.replace(/(s|x)$/, "")),
  );
}

/** Similarité de deux titres (0 à 1) : mots communs, sans les petits mots ni les accents. */
export function titleSimilarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  A.forEach((w) => { if (B.has(w)) common++; });
  // un titre entièrement contenu dans l'autre (« Tarte tatin » / « Tarte tatin de mamie ») compte fort
  return Math.max(common / (A.size + B.size - common), common / Math.min(A.size, B.size) >= 1 && Math.min(A.size, B.size) >= 2 ? 0.8 : 0);
}

export type Existing = { id: string; title: string; source_url: string | null };

export function findDuplicates(title: string, sourceUrl: string | null, existing: Existing[]) {
  return existing.filter((e) =>
    (sourceUrl && e.source_url && e.source_url.replace(/[?#].*$/, "") === sourceUrl.replace(/[?#].*$/, ""))
    || titleSimilarity(title, e.title) >= 0.6);
}
