"use client";

import { useState } from "react";
import { zipSync, strToU8 } from "fflate";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, difficultyLabel, formatMinutes, type Recipe } from "@/lib/types";
import { ingredientParts } from "@/lib/scale";

const slug = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "recette";

/** Version lisible sans l'application (texte Markdown). */
function toMarkdown(r: Recipe, photoFiles: string[]) {
  const lines = [`# ${r.title}`, ""];
  const meta = [
    categoryLabel(r.category).label,
    r.servings ? `pour ${r.servings} ${r.servings_unit ?? "personnes"}` : null,
    r.prep_minutes ? `préparation ${formatMinutes(r.prep_minutes)}` : null,
    r.cook_minutes ? `cuisson ${formatMinutes(r.cook_minutes)}` : null,
    r.rest_minutes ? `${(r.rest_label ?? "repos").toLowerCase()} ${formatMinutes(r.rest_minutes)}` : null,
    difficultyLabel(r.difficulty),
  ].filter(Boolean);
  lines.push(`*${meta.join(" · ")}*`, "");
  if (r.description) lines.push(r.description, "");
  photoFiles.forEach((p) => lines.push(`![photo](../${p})`));
  if (photoFiles.length) lines.push("");
  lines.push("## Ingrédients", "");
  r.ingredients.forEach((i) => {
    const { amount, link } = ingredientParts(i);
    lines.push(`- ${amount ? `${amount} ${link}` : ""}${i.name}${i.note ? ` (${i.note})` : ""}`);
  });
  if (r.utensils.length) lines.push("", "## Ustensiles", "", r.utensils.join(", "));
  lines.push("", "## Préparation", "");
  r.steps.forEach((s, k) => lines.push(`${k + 1}. ${s.text}`));
  if (r.tips) lines.push("", "## Astuces", "", r.tips);
  if (r.tags.length) lines.push("", `Tags : ${r.tags.join(", ")}`);
  if (r.source_url || r.source_label) lines.push("", `Source : ${r.source_label ?? ""} ${r.source_url ?? ""}`.trim());
  return lines.join("\n") + "\n";
}

export function BackupButton({ familyId, familyName }: { familyId: string; familyName: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const supabase = createClient();
      setStatus("Lecture des recettes…");
      const [{ data: recipes, error }, { data: comments }, { data: marks }, { data: members }] = await Promise.all([
        supabase.from("recipes").select("*").eq("family_id", familyId).order("title"),
        supabase.from("recipe_comments").select("*"),
        supabase.from("recipe_marks").select("*"),
        supabase.from("family_members").select("user_id, display_name").eq("family_id", familyId),
      ]);
      if (error) throw error;
      const list = (recipes ?? []) as Recipe[];
      const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
      const paths = list.flatMap((r) => r.photos);
      let done = 0;
      // photos téléchargées 4 par 4
      for (let i = 0; i < paths.length; i += 4) {
        await Promise.all(paths.slice(i, i + 4).map(async (p) => {
          const { data } = await supabase.storage.from("recipe-photos").download(p);
          if (data) files[`photos/${p.split("/").pop()}`] = [new Uint8Array(await data.arrayBuffer()), { level: 0 }];
          done++;
        }));
        setStatus(`Photos : ${done} / ${paths.length}`);
      }
      list.forEach((r, k) => {
        const photoFiles = r.photos.map((p) => `photos/${p.split("/").pop()}`).filter((f) => files[f]);
        files[`recettes/${String(k + 1).padStart(3, "0")}-${slug(r.title)}.md`] = strToU8(toMarkdown(r, photoFiles));
      });
      files["sauvegarde.json"] = strToU8(JSON.stringify({
        format: "carnet-recettes/1",
        exported_at: new Date().toISOString(),
        family: familyName,
        members,
        recipes: list,
        comments: (comments ?? []).filter((c) => list.some((r) => r.id === c.recipe_id)),
        marks: (marks ?? []).filter((m) => list.some((r) => r.id === m.recipe_id)),
      }, null, 2));
      files["LISEZ-MOI.txt"] = strToU8(
        `Sauvegarde du carnet de recettes « ${familyName} » du ${new Date().toLocaleDateString("fr-FR")}.\n\n` +
        `- recettes/ : chaque recette en texte lisible (s'ouvre avec n'importe quel éditeur de texte)\n` +
        `- photos/ : toutes les photos\n- sauvegarde.json : les données complètes (pour une restauration)\n`);
      setStatus("Création du fichier…");
      const zip = zipSync(files);
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `carnet-recettes-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus(`Sauvegarde téléchargée : ${list.length} recettes, ${paths.length} photos.`);
    } catch (e) {
      setStatus(`Échec de la sauvegarde : ${e instanceof Error ? e.message : "erreur"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="carte p-5">
      <h2 className="font-semibold">💾 Sauvegarde</h2>
      <p className="mt-1 text-sm text-encre-douce">
        Télécharge toutes les recettes (en texte lisible et en données complètes) et toutes les photos dans un fichier .zip.
      </p>
      <button className="btn-secondaire mt-3" onClick={run} disabled={busy}>{busy ? "En cours…" : "Télécharger une sauvegarde"}</button>
      {status && <p className="mt-2 text-sm text-encre-douce">{status}</p>}
    </section>
  );
}
