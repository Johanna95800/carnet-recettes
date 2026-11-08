"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image-client";
import { PhotoEditor } from "./PhotoEditor";
import { CATEGORIES, DIFFICULTIES, REST_LABELS, formatMinutes, parseDuration, type Ingredient, type RecipeDraft } from "@/lib/types";

const BUCKET = "recipe-photos";

type Props = {
  initial: RecipeDraft;
  familyId: string;
  recipeId?: string;
  onCancel?: () => void;
};

export function RecipeForm({ initial, familyId, recipeId, onCancel }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [d, setD] = useState<RecipeDraft>(initial);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // photos envoyées pendant cette édition (pour nettoyer celles qu'on n'a finalement pas gardées)
  const sessionUploads = useRef<Set<string>>(new Set());

  async function upload(blob: Blob) {
    const path = `${familyId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    sessionUploads.current.add(path);
    return path;
  }

  const loadEditing = useCallback(async () => {
    const { data, error } = await supabase.storage.from(BUCKET).download(editing!);
    if (error || !data) throw error ?? new Error("photo");
    return data;
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveEdited(blob: Blob) {
    const old = editing!;
    const path = await upload(blob);
    setUrls((u) => ({ ...u, [path]: URL.createObjectURL(blob) }));
    setD((p) => ({ ...p, photos: p.photos.map((x) => (x === old ? path : x)) }));
    setEditing(null);
  }

  function cancel() {
    const orphans = [...sessionUploads.current];
    if (orphans.length) supabase.storage.from(BUCKET).remove(orphans);
    onCancel?.();
  }

  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const missing = d.photos.filter((p) => !urls[p]);
    if (!missing.length) return;
    supabase.storage.from(BUCKET).createSignedUrls(missing, 3600).then(({ data }) => {
      setUrls((u) => {
        const next = { ...u };
        data?.forEach((x) => { if (x.path && x.signedUrl) next[x.path] = x.signedUrl; });
        return next;
      });
    });
  }, [d.photos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      try {
        added.push(await upload(await resizeImage(f, 2000)));
      } catch {
        /* photo ignorée */
      }
    }
    set("photos", [...d.photos, ...added]);
    setUploading(false);
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const list = (v: string) => v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

  function updIng(i: number, patch: Partial<Ingredient>) {
    set("ingredients", d.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.title.trim()) { setError("Donnez un titre à la recette."); return; }
    setBusy(true); setError(null);
    const payload = {
      ...d,
      title: d.title.trim(),
      ingredients: d.ingredients.filter((i) => i.name.trim()),
      steps: d.steps.filter((s) => s.text.trim()),
    };
    const res = recipeId
      ? await supabase.from("recipes").update(payload).eq("id", recipeId).select("id").single()
      : await supabase.from("recipes").insert({ ...payload, family_id: familyId,
          created_by: (await supabase.auth.getUser()).data.user?.id }).select("id").single();
    if (res.error) { setError(res.error.message); setBusy(false); return; }
    const unused = [...initial.photos, ...sessionUploads.current].filter((p) => !d.photos.includes(p));
    if (unused.length) await supabase.storage.from(BUCKET).remove(unused);
    router.push(`/recettes/${res.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {/* Photos */}
      <section className="carte p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Photos</h2>
          <label className="btn-secondaire cursor-pointer py-1.5 text-sm">
            {uploading ? "Envoi…" : "+ Ajouter"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
          </label>
        </div>
        {d.photos.length > 0 && <p className="mt-1 text-xs text-encre-douce">✎ pour tourner ou recadrer · ★ pour choisir la photo principale</p>}
        {d.photos.length > 0 ? (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {d.photos.map((p, i) => (
              <li key={p} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[p]} alt="" className="h-28 w-28 rounded-xl bg-creme object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 text-xs text-white">Principale</span>}
                <button type="button" title="Retoucher (rotation, recadrage)"
                  className="absolute right-1 top-1 rounded-md bg-black/60 px-1.5 text-xs text-white"
                  onClick={() => setEditing(p)}>✎</button>
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  {i > 0 ? (
                    <button type="button" title="Mettre en photo principale" className="rounded-md bg-black/60 px-1.5 text-xs text-white"
                      onClick={() => set("photos", [p, ...d.photos.filter((x) => x !== p)])}>★</button>
                  ) : <span />}
                  <button type="button" title="Retirer" className="rounded-md bg-black/60 px-1.5 text-xs text-white"
                    onClick={() => set("photos", d.photos.filter((x) => x !== p))}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-encre-douce">Aucune photo.</p>}
      </section>

      {/* Infos générales */}
      <section className="carte space-y-4 p-4">
        <label className="block space-y-1">
          <span className="etiquette">Titre</span>
          <input className="champ text-lg font-semibold" value={d.title} onChange={(e) => set("title", e.target.value)} required />
        </label>
        <label className="block space-y-1">
          <span className="etiquette">Présentation</span>
          <textarea className="champ" rows={2} value={d.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="etiquette">Catégorie</span>
            <select className="champ" value={d.category} onChange={(e) => set("category", e.target.value as RecipeDraft["category"])}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="etiquette">Difficulté</span>
            <select className="champ" value={d.difficulty ?? ""} onChange={(e) => set("difficulty", (e.target.value || null) as RecipeDraft["difficulty"])}>
              <option value="">—</option>
              {DIFFICULTIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="etiquette">Pour combien</span>
            <div className="flex gap-2">
              <input className="champ w-20" inputMode="decimal" value={d.servings ?? ""} onChange={(e) => set("servings", num(e.target.value))} />
              <input className="champ" value={d.servings_unit ?? ""} placeholder="personnes" onChange={(e) => set("servings_unit", e.target.value || null)} />
            </div>
          </label>
          <div />
          <DurationField label="🔪 Préparation" value={d.prep_minutes} onChange={(v) => set("prep_minutes", v)} />
          <DurationField label="🔥 Cuisson" value={d.cook_minutes} onChange={(v) => set("cook_minutes", v)} />
          <label className="block space-y-1">
            <span className="etiquette">⏳ Type d&apos;attente</span>
            <input className="champ" list="rest-labels" placeholder="Repos, Réfrigération…" value={d.rest_label ?? ""}
              onChange={(e) => set("rest_label", e.target.value || null)} />
            <datalist id="rest-labels">{REST_LABELS.map((l) => <option key={l} value={l} />)}</datalist>
          </label>
          <DurationField label={`⏳ ${d.rest_label || "Attente"}`} value={d.rest_minutes} onChange={(v) => set("rest_minutes", v)} />
        </div>
      </section>

      {/* Ingrédients */}
      <section className="carte p-4">
        <h2 className="font-semibold">Ingrédients</h2>
        <ul className="mt-3 space-y-2">
          {d.ingredients.map((ing, i) => (
            <li key={i} className="flex gap-1.5">
              <input className="champ w-16 px-2" inputMode="decimal" placeholder="Qté" value={ing.quantity ?? ""}
                onChange={(e) => updIng(i, { quantity: num(e.target.value) })} />
              <input className="champ w-20 px-2" placeholder="unité" value={ing.unit ?? ""}
                onChange={(e) => updIng(i, { unit: e.target.value || null })} />
              <div className="min-w-0 flex-1 space-y-1">
                <input className="champ px-2" placeholder="ingrédient" value={ing.name}
                  onChange={(e) => updIng(i, { name: e.target.value })} />
                {(ing.note || ing.group) && (
                  <input className="champ px-2 py-1 text-sm" placeholder="précision" value={ing.note ?? ""}
                    onChange={(e) => updIng(i, { note: e.target.value || null })} />
                )}
              </div>
              <button type="button" className="px-1 text-encre-douce" aria-label="Supprimer"
                onClick={() => set("ingredients", d.ingredients.filter((_, j) => j !== i))}>✕</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-secondaire mt-3 py-1.5 text-sm"
          onClick={() => set("ingredients", [...d.ingredients, { quantity: null, unit: null, name: "", note: null, group: d.ingredients.at(-1)?.group ?? null }])}>
          + Ingrédient
        </button>
      </section>

      {/* Ustensiles */}
      <section className="carte space-y-1 p-4">
        <h2 className="font-semibold">Ustensiles</h2>
        <textarea className="champ" rows={2} placeholder="Un par ligne ou séparés par des virgules"
          defaultValue={d.utensils.join(", ")} onBlur={(e) => set("utensils", list(e.target.value))} />
      </section>

      {/* Étapes */}
      <section className="carte p-4">
        <h2 className="font-semibold">Étapes</h2>
        <ol className="mt-3 space-y-2">
          {d.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tomate text-xs font-semibold text-sur-tomate">{i + 1}</span>
              <textarea className="champ" rows={3} value={s.text}
                onChange={(e) => set("steps", d.steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <button type="button" className="px-1 text-encre-douce" aria-label="Supprimer"
                onClick={() => set("steps", d.steps.filter((_, j) => j !== i))}>✕</button>
            </li>
          ))}
        </ol>
        <button type="button" className="btn-secondaire mt-3 py-1.5 text-sm"
          onClick={() => set("steps", [...d.steps, { text: "", group: d.steps.at(-1)?.group ?? null }])}>+ Étape</button>
      </section>

      {/* Astuces & source */}
      <section className="carte space-y-4 p-4">
        <label className="block space-y-1">
          <span className="etiquette">Astuces, variantes</span>
          <textarea className="champ" rows={3} value={d.tips ?? ""} onChange={(e) => set("tips", e.target.value || null)} />
        </label>
        <label className="block space-y-1">
          <span className="etiquette">Mots-clés</span>
          <input className="champ" placeholder="végétarien, rapide, Noël…" defaultValue={d.tags.join(", ")}
            onBlur={(e) => set("tags", list(e.target.value))} />
        </label>
        <label className="block space-y-1">
          <span className="etiquette">Source</span>
          <input className="champ" placeholder="ex. Cahier de mamie, Elle à table n°142…" value={d.source_label ?? ""}
            onChange={(e) => set("source_label", e.target.value || null)} />
        </label>
      </section>

      {editing && (
        <PhotoEditor load={loadEditing} onSave={saveEdited} onClose={() => setEditing(null)} />
      )}
      {error && <p className="text-sm text-tomate">{error}</p>}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex gap-3 rounded-2xl bg-creme/90 py-2 backdrop-blur md:bottom-4">
        {onCancel && <button type="button" className="btn-secondaire flex-1" onClick={cancel}>Annuler</button>}
        <button className="btn-primaire flex-[2]" disabled={busy || uploading}>{busy ? "Enregistrement…" : "Enregistrer la recette"}</button>
      </div>
    </form>
  );
}

/** Champ de durée : accepte « 1h30 », « 12 h », « 45 »… */
function DurationField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value ? formatMinutes(value)! : "");
  const [bad, setBad] = useState(false);
  return (
    <label className="block space-y-1">
      <span className="etiquette">{label}</span>
      <input className={`champ ${bad ? "border-tomate" : ""}`} placeholder="ex. 1h30 ou 45" value={text}
        onChange={(e) => { setText(e.target.value); setBad(false); }}
        onBlur={() => {
          const v = parseDuration(text);
          if (Number.isNaN(v)) { setBad(true); return; }
          onChange(v || null);
          setText(v ? formatMinutes(v)! : "");
        }} />
    </label>
  );
}
