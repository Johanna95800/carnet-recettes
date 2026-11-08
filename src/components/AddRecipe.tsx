"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image-client";
import { emptyDraft, type RecipeDraft } from "@/lib/types";
import { RecipeForm } from "./RecipeForm";

type Mode = "url" | "manuscrite" | "livre";

const METHODS: { mode: Mode | "manuel"; icon: string; title: string; text: string }[] = [
  { mode: "url", icon: "🔗", title: "Depuis un site", text: "Collez l'adresse d'une recette en ligne" },
  { mode: "manuscrite", icon: "✍️", title: "Recette manuscrite", text: "Photographiez une fiche écrite à la main" },
  { mode: "livre", icon: "📚", title: "Livre ou magazine", text: "Photographiez la page (la photo du plat est récupérée)" },
  { mode: "manuel", icon: "⌨️", title: "Saisie libre", text: "Écrivez la recette vous-même" },
];

export function AddRecipe({ familyId }: { familyId: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    if (draft?.photos.length) createClient().storage.from("recipe-photos").remove(draft.photos);
    setDraft(null); setMode(null); setFiles([]); setUrl(""); setError(null);
  }

  async function analyse() {
    setBusy(true); setError(null);
    try {
      let res: Response;
      if (mode === "url") {
        res = await fetch("/api/import/url", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }),
        });
      } else {
        const fd = new FormData();
        fd.set("kind", mode!);
        for (const f of files) fd.append("photos", await resizeImage(f), "photo.jpg");
        res = await fetch("/api/import/photo", { method: "POST", body: fd });
      }
      const json = await res.json().catch(() => ({ error: "Réponse inattendue du serveur." }));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setDraft(json.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (draft) {
    return (
      <>
        {draft.source_type !== "manuel" && (
          <p className="carte mb-4 border-basilic/40 p-3 text-sm">
            ✨ Recette importée. Vérifiez et corrigez si besoin, puis enregistrez.
          </p>
        )}
        <RecipeForm initial={draft} familyId={familyId} onCancel={reset} />
      </>
    );
  }

  if (!mode) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {METHODS.map((m) => (
          <li key={m.mode}>
            <button className="carte flex w-full items-center gap-4 p-4 text-left transition hover:border-tomate"
              onClick={() => (m.mode === "manuel" ? setDraft(emptyDraft()) : setMode(m.mode))}>
              <span className="text-3xl">{m.icon}</span>
              <span>
                <span className="block font-semibold">{m.title}</span>
                <span className="block text-sm text-encre-douce">{m.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <button className="text-sm text-encre-douce" onClick={reset} disabled={busy}>← Autre méthode</button>
      {mode === "url" ? (
        <form className="carte space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); analyse(); }}>
          <label className="block space-y-1">
            <span className="etiquette">Adresse de la recette</span>
            <input className="champ" type="url" inputMode="url" placeholder="https://…" required value={url}
              onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button className="btn-primaire w-full" disabled={busy}>{busy ? "Lecture de la page…" : "Importer"}</button>
        </form>
      ) : (
        <div className="carte space-y-4 p-5">
          <p className="text-sm text-encre-douce">
            {mode === "manuscrite"
              ? "Prenez la fiche bien à plat, avec une bonne lumière. Plusieurs photos si la recette tient sur plusieurs pages."
              : "Cadrez toute la page (ou les deux pages). La photo du plat sera découpée automatiquement."}
          </p>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 4))} />
          <input id="camera" type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 4))} />
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor="camera" className="btn-secondaire cursor-pointer">📷 Prendre une photo</label>
            <button type="button" className="btn-secondaire" onClick={() => inputRef.current?.click()}>🖼️ Galerie</button>
          </div>
          {files.length > 0 && (
            <ul className="flex gap-2 overflow-x-auto">
              {files.map((f, i) => (
                <li key={i} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt="" className="h-24 w-24 rounded-xl object-cover" />
                  <button className="absolute right-1 top-1 rounded-md bg-black/60 px-1.5 text-xs text-white"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn-primaire w-full" disabled={busy || !files.length} onClick={analyse}>
            {busy ? "Lecture de la recette… (jusqu'à 1 min)" : `Analyser ${files.length > 1 ? `les ${files.length} photos` : "la photo"}`}
          </button>
        </div>
      )}
      {error && <p className="carte border-tomate/40 p-3 text-sm text-tomate">{error}</p>}
    </div>
  );
}
