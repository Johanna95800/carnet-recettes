"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RecipeActions({ id, title, photos }: { id: string; title: string; photos: string[] }) {
  const router = useRouter();
  async function share() {
    const url = location.href;
    if (navigator.share) { try { await navigator.share({ title, url }); } catch { /* annulé */ } }
    else { await navigator.clipboard.writeText(url); alert("Lien copié !"); }
  }
  async function remove() {
    if (!confirm(`Supprimer « ${title} » du carnet ?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    if (photos.length) await supabase.storage.from("recipe-photos").remove(photos);
    router.replace("/");
    router.refresh();
  }
  return (
    <div className="flex gap-1 text-sm">
      <button className="rounded-lg px-2.5 py-1.5 hover:bg-papier" onClick={share}>Partager</button>
      <Link className="rounded-lg px-2.5 py-1.5 hover:bg-papier" href={`/recettes/${id}/modifier`}>Modifier</Link>
      <button className="rounded-lg px-2.5 py-1.5 text-tomate hover:bg-papier" onClick={remove}>Supprimer</button>
    </div>
  );
}
