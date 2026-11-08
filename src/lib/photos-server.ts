import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/import/photos";

/** URL signées (valables 1 h) pour afficher des photos du bucket privé. */
export async function signPhotos(supabase: SupabaseClient, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600);
  const map: Record<string, string> = {};
  data?.forEach((d) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
  return map;
}
