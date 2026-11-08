"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

async function shareUrl(title: string, url: string) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return "partagé"; } catch { return null; }
  }
  await navigator.clipboard.writeText(url);
  return "copié";
}

/** Partage : lien pour la famille, ou lien public en lecture seule (sans compte). */
export function ShareMenu({ id, title, shareToken }: { id: string; title: string; shareToken: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(shareToken);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const publicUrl = (t: string) => `${location.origin}/p/${t}`;

  async function setPublic(enable: boolean) {
    setBusy(true); setMsg(null);
    const next = enable ? crypto.randomUUID() : null;
    const { error } = await createClient().from("recipes").update({ share_token: next }).eq("id", id);
    setBusy(false);
    if (error) {
      setMsg(error.message.includes("share_token") ? "Fonction pas encore activée : la base Supabase doit être mise à jour." : error.message);
      return;
    }
    setToken(next);
    router.refresh();
    if (next) {
      const r = await shareUrl(title, publicUrl(next));
      if (r === "copié") setMsg("Lien public copié !");
    }
  }

  return (
    <>
      <button className="rounded-lg px-2.5 py-1.5 hover:bg-papier" onClick={() => setOpen(true)}>Partager</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-papier p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="titre text-xl font-semibold">Partager « {title} »</h2>
            <button className="carte flex w-full items-start gap-3 p-4 text-left hover:border-tomate"
              onClick={async () => { const r = await shareUrl(title, location.href); if (r === "copié") setMsg("Lien copié !"); }}>
              <span className="text-2xl">👨‍👩‍👧</span>
              <span><span className="block font-semibold">Avec la famille</span>
                <span className="block text-sm text-encre-douce">Lien vers la recette dans le carnet (compte nécessaire).</span></span>
            </button>
            <div className="carte p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🌍</span>
                <div className="flex-1">
                  <span className="block font-semibold">Lien public</span>
                  <span className="block text-sm text-encre-douce">
                    Toute personne ayant le lien peut voir la recette (sans compte, sans pouvoir la modifier).
                  </span>
                </div>
              </div>
              {token ? (
                <div className="mt-3 space-y-2">
                  <input readOnly className="champ text-sm" value={publicUrl(token)} onFocus={(e) => e.target.select()} />
                  <div className="flex gap-2">
                    <button className="btn-primaire flex-1" onClick={async () => { const r = await shareUrl(title, publicUrl(token)); if (r === "copié") setMsg("Lien public copié !"); }}>
                      Envoyer le lien
                    </button>
                    <button className="btn-secondaire" disabled={busy} onClick={() => setPublic(false)}>Désactiver</button>
                  </div>
                </div>
              ) : (
                <button className="btn-secondaire mt-3 w-full" disabled={busy} onClick={() => setPublic(true)}>
                  {busy ? "…" : "Créer un lien public"}
                </button>
              )}
            </div>
            {msg && <p className="text-sm text-basilic">{msg}</p>}
            <button className="w-full py-2 text-encre-douce" onClick={() => setOpen(false)}>Fermer</button>
          </div>
        </div>
      )}
    </>
  );
}
