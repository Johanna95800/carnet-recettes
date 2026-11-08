"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUGGESTED_TAGS, cleanTag, mergeTags, sameTag } from "@/lib/tags";

/** Saisie de tags en étiquettes, avec suggestions (tags de la famille + idées courantes). */
export function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const [familyTags, setFamilyTags] = useState<string[]>([]);

  useEffect(() => {
    createClient().from("recipes").select("tags").then(({ data }) => {
      setFamilyTags(mergeTags(...(data ?? []).map((r) => r.tags as string[])));
    });
  }, []);

  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map(cleanTag).filter(Boolean);
    if (parts.length) onChange(mergeTags(value, parts));
    setText("");
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));
  const suggestions = mergeTags(familyTags, SUGGESTED_TAGS).filter((t) => !value.some((v) => sameTag(v, t)));
  const typed = text.trim().toLowerCase();
  const shown = typed ? suggestions.filter((s) => s.toLowerCase().includes(typed)) : suggestions;

  return (
    <div className="space-y-2">
      <div className="champ flex min-h-12 flex-wrap items-center gap-1.5 py-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-tomate px-2.5 py-1 text-sm font-medium text-sur-tomate">
            {t}
            <button type="button" aria-label={`Retirer ${t}`} onClick={() => remove(t)} className="opacity-80">✕</button>
          </span>
        ))}
        <input className="min-w-28 flex-1 bg-transparent outline-none" placeholder={value.length ? "Ajouter…" : "Noël, végétarien…"}
          value={text} enterKeyHint="done"
          onChange={(e) => (/[,;]/.test(e.target.value) ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(text); }
            if (e.key === "Backspace" && !text && value.length) remove(value[value.length - 1]);
          }}
          onBlur={() => text.trim() && add(text)} />
      </div>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shown.slice(0, 14).map((t) => (
            <button key={t} type="button" onClick={() => add(t)}
              className="rounded-full border border-trait bg-papier px-2.5 py-1 text-sm text-encre-douce hover:border-tomate">
              + {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
