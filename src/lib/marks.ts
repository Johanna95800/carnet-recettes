export type MarkRow = { recipe_id: string; user_id: string; favorite: boolean; cooked: boolean; rating: number | null };

export function summarize(rows: MarkRow[], names: Record<string, string>) {
  const rated = rows.filter((r) => r.rating);
  return {
    avg: rated.length ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length : null,
    count: rated.length,
    cookedBy: rows.filter((r) => r.cooked).map((r) => names[r.user_id] ?? "Quelqu'un"),
  };
}
